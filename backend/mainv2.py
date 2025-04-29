import base64
import os
import json
import uuid
import asyncio
from fastapi import FastAPI, HTTPException, Query, Path
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from ldap3 import Server, Connection, ALL, SUBTREE
import aioredis

# --- Configuration ---
LDAP_URL = os.getenv('LDAP_URL', 'ldap://dc.example.com')
LDAP_USER = os.getenv('LDAP_USER', 'CN=svc_account,OU=Service Accounts,DC=example,DC=com')
LDAP_PASS = os.getenv('LDAP_PASS', 'SecretPassword')
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost')

# --- FastAPI App ---
app = FastAPI(title="AD Query with Efficient Pagination")

# --- Redis & LDAP connections ---
@app.on_event("startup")
async def startup():
    # Redis pool
    app.state.redis = await aioredis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)

    # LDAP connection
    server = Server(LDAP_URL, get_info=ALL)
    conn = Connection(server, user=LDAP_USER, password=LDAP_PASS, auto_bind=True)
    app.state.ldap = conn

@app.on_event("shutdown")
async def shutdown():
    await app.state.redis.close()
    app.state.ldap.unbind()

# --- Pydantic models ---
class ADQueryRequest(BaseModel):
    filter: str  # 'computers', 'users', or 'groups'
    query: str
    attributes: list[str]
    ou_paths: list[str] | None = None
    page_size: int | None = 50

class PaginatedResponse(BaseModel):
    results: list[dict]
    total_count: int | None
    current_page: int
    page_size: int
    has_next_page: bool
    session_id: str

# --- Helpers ---
async def get_session_key(session_id: str) -> str:
    return f"session:{session_id}"

async def ldap_page(ou: str | None, filter_cond: str, attrs: list[str], page_size: int, cookie: bytes | None):
    conn: Connection = app.state.ldap
    conn.search(
        search_base=ou or conn.server.info.other['defaultNamingContext'][0],
        search_filter=filter_cond,
        search_scope=SUBTREE,
        attributes=attrs,
        paged_size=page_size,
        paged_cookie=cookie
    )
    entries = [entry.entry_to_json() for entry in conn.response if entry.get('type') == 'searchResEntry']
    # extract cookie for next page
    controls = conn.result.get('controls', {})
    cookie_out = None
    if '1.2.840.113556.1.4.319' in controls:
        cookie_out = controls['1.2.840.113556.1.4.319']['value']['cookie']
    has_more = bool(cookie_out)
    return entries, cookie_out, has_more

# --- Endpoints ---
@app.post("/api/ad/query", response_model=PaginatedResponse)
async def start_query(req: ADQueryRequest):
    # Validate filter
    if req.filter not in {'computers', 'users', 'groups'}:
        raise HTTPException(400, "Invalid filter type")
    page_size = max(10, min(200, req.page_size or 50))
    # Build an LDAP filter string
    base_filter = {
        'computers': f"(&(objectClass=computer)(cn=*{req.query}*))",
        'users':     f"(&(objectClass=user)(|(cn=*{req.query}*)(sAMAccountName=*{req.query}*)))",
        'groups':    f"(&(objectClass=group)(cn=*{req.query}*))"
    }[req.filter]
    ou_list = req.ou_paths or [None]
    session_id = str(uuid.uuid4())
    session_key = await get_session_key(session_id)

    # Prepare session data
    await app.state.redis.hset(session_key, mapping={
        'filter': base_filter,
        'attributes': json.dumps(req.attributes),
        'ous': json.dumps(ou_list),
        'page_size': page_size,
        'current_index': 0,  # how many items served
    })
    # Store per-OU cookies
    for ou in ou_list:
        await app.state.redis.hset(session_key + ":cookies", ou or "_ROOT_", "")

    # Fetch first page
    results = []
    next_page_items = []
    total_fetched = 0
    has_more_global = False
    for ou in ou_list:
        cookie = b""
        entries, cookie_out, has_more = await ldap_page(ou, base_filter, req.attributes, page_size, cookie)
        results.extend(entries)
        total_fetched += len(entries)
        has_more_global = has_more_global or has_more
        # persist this OU's cookie
        await app.state.redis.hset(session_key + ":cookies", ou or "_ROOT_", cookie_out or "")
        if total_fetched >= page_size:
            break

    # Cache page1
    await app.state.redis.rpush(session_key + ":pages", json.dumps(results[:page_size]))
    # Respond
    return PaginatedResponse(
        results=[json.loads(r) for r in await app.state.redis.lindex(session_key + ":pages", 0)],
        total_count=None,               # you can add a separate count logic if needed
        current_page=1,
        page_size=page_size,
        has_next_page=has_more_global,
        session_id=session_id
    )

@app.get("/api/ad/query/page/{session_id}", response_model=PaginatedResponse)
async def fetch_page(
    session_id: str = Path(...),
    page: int = Query(1, ge=1)
):
    session_key = await get_session_key(session_id)
    exists = await app.state.redis.exists(session_key)
    if not exists:
        raise HTTPException(404, "Session not found or expired")
    page_list = session_key + ":pages"
    # If page cached, return
    if await app.state.redis.llen(page_list) >= page:
        data = await app.state.redis.lindex(page_list, page-1)
        results = json.loads(data)
        return PaginatedResponse(
            results=results,
            total_count=None,
            current_page=page,
            page_size=int(await app.state.redis.hget(session_key, 'page_size')),
            has_next_page=True,
            session_id=session_id
        )
    # Otherwise build next page
    page_size = int(await app.state.redis.hget(session_key, 'page_size'))
    base_filter = await app.state.redis.hget(session_key, 'filter')
    attrs = json.loads(await app.state.redis.hget(session_key, 'attributes'))
    ou_list = json.loads(await app.state.redis.hget(session_key, 'ous'))

    results = []
    total_fetched = (page-1) * page_size
    has_more_global = False
    for ou in ou_list:
        # skip OUs already exhausted
        cookie_raw = await app.state.redis.hget(session_key + ":cookies", ou or "_ROOT_")
        cookie = base64.b64decode(cookie_raw) if cookie_raw else b""
        entries, cookie_out, has_more = await ldap_page(ou, base_filter, attrs, page_size, cookie)
        await app.state.redis.hset(session_key + ":cookies", ou or "_ROOT_", cookie_out or "")
        if total_fetched + len(entries) <= total_fetched + page_size:
            results.extend(entries)
            total_fetched += len(entries)
            has_more_global = has_more_global or has_more
        if total_fetched >= page * page_size:
            break

    # Cache the new page
    await app.state.redis.rpush(page_list, json.dumps(results[:page_size]))
    return PaginatedResponse(
        results=results[:page_size],
        total_count=None,
        current_page=page,
        page_size=page_size,
        has_next_page=has_more_global,
        session_id=session_id
    )

@app.get("/api/ad/query/all/{session_id}")
async def get_all(session_id: str, max_results: int = Query(10000, ge=0)):
    session_key = await get_session_key(session_id)
    exists = await app.state.redis.exists(session_key)
    if not exists:
        raise HTTPException(404, "Session not found or expired")

    # Stream all cached pages, then fetch until done
    async def streamer():
        page_index = 0
        while True:
            page_data = await app.state.redis.lindex(session_key + ":pages", page_index)
            if page_data:
                yield page_data + '\n'
                page_index += 1
            else:
                # no cached page: attempt fetch next
                try:
                    await fetch_page(session_id, page_index+1)
                except HTTPException:
                    break
        # End of stream
    return StreamingResponse(streamer(), media_type="application/x-ndjson")
