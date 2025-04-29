import base64
from datetime import datetime, timedelta
import os
import json
import uuid
from fastapi import FastAPI, HTTPException, Query, Path, Body, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from ldap3 import Server, Connection, ALL, SUBTREE, NTLM, SIMPLE
from typing import List, Optional, Dict, Any, Union
import secrets
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from contextlib import asynccontextmanager
from fastapi import FastAPI
from redis.asyncio import Redis


# --- Configuration ---
# Default LDAP server
DEFAULT_LDAP_SERVER = 'IST-ADC5.ad.bu.edu'
# Auto-prefix ldap:// if not already present
def format_ldap_url(server_name):
    if not server_name:
        return f"ldap://{DEFAULT_LDAP_SERVER}"
    if not server_name.startswith(("ldap://", "ldaps://")):
        return f"ldap://{server_name}"
    return server_name

LDAP_SERVER = os.getenv('LDAP_SERVER', DEFAULT_LDAP_SERVER)
LDAP_URL = format_ldap_url(LDAP_SERVER)
LDAP_USER = os.getenv('LDAP_USER', '')
LDAP_PASS = os.getenv('LDAP_PASS', '')
SERVER_SECRET_KEY = os.getenv('AD_AUTH_SECRET_KEY', secrets.token_hex(32))
SALT = os.getenv('AD_AUTH_SALT', secrets.token_hex(16)).encode()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Redis pool
    app.state.redis = Redis(host="localhost", encoding="utf-8", port=6379, decode_responses=True)
    
    # LDAP connection
    server = Server(app_config["ldap_url"], get_info=ALL)
    conn = Connection(server, user=LDAP_USER, password=LDAP_PASS, auto_bind=True)
    app.state.ldap = conn
    
    yield
    # close connections
    await app.state.redis.close()
    app.state.ldap.unbind()

# --- FastAPI App ---
app = FastAPI(
    title="AD Query with Efficient Pagination and Authentication",
    lifespan=lifespan
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5000", ],  # React app's address
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Global Configuration Storage ---
# This allows updating configuration at runtime
app_config = {
    "ldap_server": LDAP_SERVER,
    "ldap_url": LDAP_URL
}

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
    is_count_exact: bool = True

class AuthRequest(BaseModel):
    username: str
    domain: str
    password: str
    
class LdapServerConfig(BaseModel):
    server_name: str

class AuthResponse(BaseModel):
    success: bool
    message: str
    user_info: Dict[str, Any] | None = None
    token: Dict[str, Any] | None = None

class ExportRequest(BaseModel):
    session_id: str
    format: str = "csv"
    selected_only: bool = False
    selected_ids: List[str] | None = None

# --- Authentication Utilities ---
def derive_key(server_secret: str):
    """Derive a key from the server secret"""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=SALT,
        iterations=100000,
    )
    return kdf.derive(server_secret.encode())

def decrypt_password(encrypted_data: str, server_key: str) -> str:
    """Decrypt a password using AES-GCM"""
    try:
        encrypted_bytes = base64.b64decode(encrypted_data)
        iv = encrypted_bytes[:12]  # Extract IV (first 12 bytes)
        ciphertext = encrypted_bytes[12:]  # Remaining is ciphertext

        key = derive_key(server_key)
        aesgcm = AESGCM(key)
        plaintext = aesgcm.decrypt(iv, ciphertext, None)

        return plaintext.decode()
    except Exception as e:
        print(f"Decryption error: {str(e)}")
        raise HTTPException(status_code=400, detail="Decryption failed")

def authenticate_with_ad(username: str, password: str, domain: str):
    """Authenticate a user against Active Directory"""
    try:
        server = Server(domain)
        conn = Connection(
            server=server,
            user=f"{username}@{domain}", # SIMPLE pattern; NTLM should use user=
#           user=f"{domain}\\{username}", Use this instead of the above if auth=NTLM instead of SIMPLE
            password=password,
            authentication=SIMPLE,
            auto_bind=True,
            check_names=False,
            raise_exceptions=False
        )
        user_info = get_user_info(conn, username, domain)
        conn.unbind()
        return True, user_info
    except Exception as e:
        print(f"AD authentication error: {str(e)}")
        return False, None

def get_user_info(conn:Connection, username, domain):
    """Get user information from Active Directory"""
    domain_parts = domain.split('.')
    search_base = ','.join([f"DC={part}" for part in domain_parts])
    try:
            
        conn.search(
            search_base=search_base,
            search_filter=f"(&(objectClass=user)(sAMAccountName={username}))",
            attributes=['distinguishedName', 'memberOf', 'mail', 'displayName', 'department', 'title']
        )
        
        if len(conn.entries) > 0:
            user_entry = conn.entries[0]
            groups = [dn.split(',')[0].replace('CN=', '') for dn in user_entry.memberOf] if hasattr(user_entry, 'memberOf') else []
            return {
                'username': username,
                'distinguishedName': user_entry.distinguishedName.value if hasattr(user_entry, 'distinguishedName') else None,
                'displayName': user_entry.displayName.value if hasattr(user_entry, 'displayName') else username,
                'email': user_entry.mail.value if hasattr(user_entry, 'mail') else None,
                'department': user_entry.department.value if hasattr(user_entry, 'department') else None,
                'title': user_entry.title.value if hasattr(user_entry, 'title') else None,
                'groups': groups
            }
        return {
            'username': username,
            'distinguishedName': None,
            'groups': []
        }
    except Exception as e:
        print(f"ERROR attempting to get_user_info: {str(e)}")
        raise

# --- Helpers ---
async def get_session_key(session_id: str) -> str:
    return f"session:{session_id}"

async def count_ad_objects(conn, ou: str | None, filter_cond: str) -> tuple[int, bool]:
    """Count AD objects matching the filter, return count and whether it's exact"""
    try:
        conn.search(
            search_base=ou or conn.server.info.other['defaultNamingContext'][0],
            search_filter=filter_cond,
            search_scope=SUBTREE,
            attributes=['distinguishedName'],
            size_limit=1
        )
        # This is an estimation as we're not actually doing a full count
        # but for lightweight queries it should be accurate
        return len(conn.entries), True
    except Exception as e:
        # If count fails, provide an estimate
        print(f"Count estimation failed: {str(e)}")
        return 1000, False

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

async def export_to_csv(session_id: str, selected_ids: List[str] = None):
    """Export session results to CSV"""
    session_key = await get_session_key(session_id)
    
    # Get all pages
    page_list = session_key + ":pages"
    
    all_results = []
    page_count = await app.state.redis.llen(page_list)
    
    for i in range(page_count):
        page_data = await app.state.redis.lindex(page_list, i)
        results = json.loads(page_data)
        all_results.extend(results)
    
    # Filter by selected IDs if provided
    if selected_ids:
        all_results = [item for item in all_results if item.get('distinguishedName') in selected_ids]
    
    # Generate CSV content
    if not all_results:
        return "No data to export"
    
    # Get fields from first result
    fields = list(all_results[0].keys())
    csv_content = ",".join(fields) + "\n"
    
    for item in all_results:
        row = []
        for field in fields:
            value = item.get(field, "")
            # Handle values with commas by quoting
            if isinstance(value, str) and (',' in value or '"' in value):
                value = f'"{value.replace('"', '""')}"'
            row.append(str(value) if value is not None else "")
        csv_content += ",".join(row) + "\n"
    
    return csv_content

async def export_to_json(session_id: str, selected_ids: List[str] = None):
    """Export session results to JSON"""
    session_key = await get_session_key(session_id)
    
    # Get all pages
    page_list = session_key + ":pages"
    
    all_results = []
    page_count = await app.state.redis.llen(page_list)
    
    for i in range(page_count):
        page_data = await app.state.redis.lindex(page_list, i)
        results = json.loads(page_data)
        all_results.extend(results)
    
    # Filter by selected IDs if provided
    if selected_ids:
        all_results = [item for item in all_results if item.get('distinguishedName') in selected_ids]
    
    return json.dumps(all_results, indent=2)

# --- Session Management ---
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import uuid
import time
from typing import Optional

# Security scheme
security = HTTPBearer()

# Session management
async def create_session(user_info: dict) -> str:
    session_id = str(uuid.uuid4())
    session_data = {
        "user_info": json.dumps(user_info),
        "created_at": time.time(),
        "expires_at": time.time() + 3600  # 1 hour expiry
    }
    
    # Store in Redis
    session_key = f"user_session:{session_id}"
    await app.state.redis.hset(session_key, mapping=session_data)
    await app.state.redis.expire(session_key, 3600)  # 1 hour TTL
    
    return session_id

async def validate_session(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    session_id = credentials.credentials
    session_key = f"user_session:{session_id}"
    
    # Check if session exists
    exists = await app.state.redis.exists(session_key)
    if not exists:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session"
        )
    
    # Get session data
    session_data = await app.state.redis.hgetall(session_key)
    
    # Check if session expired
    if float(session_data.get("expires_at", 0)) < time.time():
        await app.state.redis.delete(session_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired"
        )
    
    # Refresh session TTL
    await app.state.redis.expire(session_key, 3600)
    
    # Update expiry time
    new_expires = time.time() + 3600
    await app.state.redis.hset(session_key, "expires_at", new_expires)
    
    # Return user info
    return json.loads(session_data.get("user_info", "{}"))

# --- Endpoints ---
@app.get("/api/health")
def health_check():
    """API Health Check"""
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

@app.post("/api/auth/refresh")
async def refresh_session(current_user: dict = Depends(validate_session)):
    """Refresh the user's session"""
    # Session is already refreshed in the validate_session dependency
    return {
        "success": True,
        "message": "Session refreshed successfully",
        "user_info": current_user
    }

@app.post("/api/auth/logout")
async def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Invalidate the user's session"""
    session_id = credentials.credentials
    session_key = f"user_session:{session_id}"
    
    # Delete the session
    await app.state.redis.delete(session_key)
    
    return {
        "success": True,
        "message": "Logged out successfully"
    }

@app.get("/api/ad/attributes/{object_type}")
async def get_attributes(object_type: str):
    """Get available attributes for a specific AD object type"""
    # Default attributes for different object types
    DEFAULT_ATTRIBUTES = {
        "computers": ["Name", "OperatingSystem", "LastLogonDate", "IPv4Address", "DistinguishedName", "Enabled", "ManagedBy", "Description"],
        "users": ["Name", "SamAccountName", "EmailAddress", "Enabled", "LastLogonDate", "DistinguishedName", "Department", "Title"],
        "groups": ["Name", "GroupCategory", "GroupScope", "Description", "DistinguishedName", "ManagedBy"]
    }
    
    if object_type not in DEFAULT_ATTRIBUTES:
        raise HTTPException(status_code=400, detail="Invalid object type")
    
    return {"attributes": DEFAULT_ATTRIBUTES[object_type]}

@app.post("/api/ad/query", response_model=PaginatedResponse)
async def start_query(req: ADQueryRequest,
                      user_info: dict = Depends(validate_session)):
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

    # Calculate total count (estimate)
    total_count = 0
    is_count_exact = True
    for ou in ou_list:
        count, is_exact = await count_ad_objects(app.state.ldap, ou, base_filter)
        total_count += count
        if not is_exact:
            is_count_exact = False

    # Prepare session data
    await app.state.redis.hset(session_key, mapping={
        'filter': base_filter,
        'attributes': json.dumps(req.attributes),
        'ous': json.dumps(ou_list),
        'page_size': page_size,
        'current_index': 0,  # how many items served
        'total_count': total_count,
        'is_count_exact': json.dumps(is_count_exact)
    })
    
    # Set TTL for session keys (30 minutes)
    await app.state.redis.expire(session_key, 1800)
    
    # Store per-OU cookies
    for ou in ou_list:
        await app.state.redis.hset(session_key + ":cookies", ou or "_ROOT_", "")
    
    # Set TTL for cookies
    await app.state.redis.expire(session_key + ":cookies", 1800)

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

    # Create pages list
    page_list = session_key + ":pages"
    await app.state.redis.rpush(page_list, json.dumps(results[:page_size]))
    await app.state.redis.expire(page_list, 1800)  # Set TTL
    
    # Calculate total pages
    total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1
    
    # Respond
    return PaginatedResponse(
        results=[json.loads(r) for r in results[:page_size]],
        total_count=total_count,
        current_page=1,
        page_size=page_size,
        has_next_page=has_more_global,
        session_id=session_id,
        is_count_exact=is_count_exact
    )

@app.get("/api/ad/query/page/{session_id}", response_model=PaginatedResponse)
async def fetch_page(
    session_id: str = Path(...),
    page_number: int = Query(1, ge=1)
):
    session_key = await get_session_key(session_id)
    exists = await app.state.redis.exists(session_key)
    if not exists:
        raise HTTPException(404, "Session not found or expired")
    
    page_size = int(await app.state.redis.hget(session_key, 'page_size'))
    total_count = int(await app.state.redis.hget(session_key, 'total_count'))
    is_count_exact = json.loads(await app.state.redis.hget(session_key, 'is_count_exact'))
    
    # Calculate total pages
    total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1
    
    if page_number > total_pages:
        raise HTTPException(status_code=400, detail=f"Page number exceeds total pages: {total_pages}")
    
    page_list = session_key + ":pages"
    # If page cached, return
    if await app.state.redis.llen(page_list) >= page_number:
        data = await app.state.redis.lindex(page_list, page_number-1)
        results = json.loads(data)
        return PaginatedResponse(
            results=results,
            total_count=total_count,
            current_page=page_number,
            page_size=page_size,
            has_next_page=page_number < total_pages,
            session_id=session_id,
            is_count_exact=is_count_exact
        )
    
    # Otherwise build next page
    base_filter = await app.state.redis.hget(session_key, 'filter')
    attrs = json.loads(await app.state.redis.hget(session_key, 'attributes'))
    ou_list = json.loads(await app.state.redis.hget(session_key, 'ous'))

    results = []
    has_more_global = False
    
    # We need to fetch pages sequentially
    current_page = await app.state.redis.llen(page_list)
    
    while current_page < page_number:
        page_results = []
        for ou in ou_list:
            # Get cookie for the current OU
            cookie_raw = await app.state.redis.hget(session_key + ":cookies", ou or "_ROOT_")
            if not cookie_raw:
                continue  # Skip OUs without cookies (already exhausted)
                
            cookie = base64.b64decode(cookie_raw) if cookie_raw else b""
            entries, cookie_out, has_more = await ldap_page(ou, base_filter, attrs, page_size, cookie)
            
            # Update cookie
            await app.state.redis.hset(session_key + ":cookies", ou or "_ROOT_", cookie_out or "")
            
            page_results.extend(entries)
            has_more_global = has_more_global or has_more
            
            if len(page_results) >= page_size:
                break
        
        # Cache the new page
        current_page += 1
        await app.state.redis.rpush(page_list, json.dumps(page_results[:page_size]))
        
        # If we've reached the requested page, break
        if current_page >= page_number:
            results = page_results[:page_size]
            break

    return PaginatedResponse(
        results=results,
        total_count=total_count,
        current_page=page_number,
        page_size=page_size,
        has_next_page=has_more_global and page_number < total_pages,
        session_id=session_id,
        is_count_exact=is_count_exact
    )

@app.get("/api/ad/query/all/{session_id}")
async def get_all_results(
    session_id: str = Path(...),
    max_results: int = Query(10000, ge=0)
):
    """
    Get all results for a query session.
    This may involve multiple AD queries to fetch all pages.
    Use max_results parameter to limit the total number of results.
    """
    session_key = await get_session_key(session_id)
    exists = await app.state.redis.exists(session_key)
    if not exists:
        raise HTTPException(404, "Session not found or expired")
    
    # We need to fetch more pages
    total_count = int(await app.state.redis.hget(session_key, 'total_count'))
    page_size = int(await app.state.redis.hget(session_key, 'page_size'))
    is_count_exact = json.loads(await app.state.redis.hget(session_key, 'is_count_exact'))
    
    # Calculate how many pages we need
    pages_needed = (min(total_count, max_results) + page_size - 1) // page_size
    
    # Get current pages count
    page_list = session_key + ":pages"
    current_pages = await app.state.redis.llen(page_list)
    
    # Fetch additional pages if needed
    for page in range(current_pages + 1, pages_needed + 1):
        try:
            await fetch_page(session_id, page)
        except HTTPException:
            break
    
    # Get all results
    all_results = []
    fetched_page_count = await app.state.redis.llen(page_list)
    
    for i in range(fetched_page_count):
        page_data = await app.state.redis.lindex(page_list, i)
        results = json.loads(page_data)
        all_results.extend(results)
    
    # Apply max_results limit
    if max_results > 0:
        all_results = all_results[:max_results]
    
    return {
        "results": all_results,
        "total_count": total_count,
        "is_complete": len(all_results) >= total_count,
        "is_count_exact": is_count_exact,
        "fetched_count": len(all_results)
    }

@app.post("/api/ad/query/export/{session_id}")
async def export_results(
    session_id: str = Path(...),
    export_params: ExportRequest = Body(...)
):
    """
    Export query results in the specified format.
    Can export all results or only selected items.
    """
    # Verify session exists
    session_key = await get_session_key(session_id)
    exists = await app.state.redis.exists(session_key)
    if not exists:
        raise HTTPException(404, "Session not found or expired")
    
    # Call appropriate export function based on format
    if export_params.format.lower() == "csv":
        content = await export_to_csv(
            session_id, 
            export_params.selected_ids if export_params.selected_only else None
        )
        media_type = "text/csv"
        filename = f"ad_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    elif export_params.format.lower() == "json":
        content = await export_to_json(
            session_id, 
            export_params.selected_ids if export_params.selected_only else None
        )
        media_type = "application/json"
        filename = f"ad_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    else:
        raise HTTPException(400, "Unsupported export format. Use 'csv' or 'json'.")
    
    # Generate download response
    headers = {
        'Content-Disposition': f'attachment; filename="{filename}"'
    }
    
    # Return file content
    return StreamingResponse(
        iter([content]),
        media_type=media_type,
        headers=headers
    )

@app.post("/api/auth/verify", response_model=AuthResponse)
async def verify_credentials(auth_request: AuthRequest):
    """Verify AD credentials and return user info if valid"""
    try:
        success, user_info = authenticate_with_ad(
            auth_request.username,
            auth_request.password,
            auth_request.domain
        )

        if success:
            # Create a session
            session_id = await create_session(user_info)
            
            return {
                "success": True,
                "message": "Authentication successful",
                "user_info": user_info,
                "token": session_id  # Return token to client
            }
        return {
            "success": False,
            "message": "Authentication failed. Invalid credentials.",
            "user_info": None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Authentication error")
    
@app.post("/api/auth/test-connection")
async def test_connection(credentials: AuthRequest):
    """Test AD connection with the provided credentials"""
    try:
        success, _ = authenticate_with_ad(credentials.username, credentials.password, credentials.domain)
        return {
            "connected": success,
            "message": "Connection successful" if success else "Connection failed"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Connection test error: {str(e)}")

@app.post("/api/config/ldap-server")
async def set_ldap_server(config: LdapServerConfig):
    """Set the LDAP server"""
    try:
        # Update the global configuration
        app_config["ldap_server"] = config.server_name
        app_config["ldap_url"] = format_ldap_url(config.server_name)
        
        # Reconnect to the new LDAP server
        if hasattr(app.state, 'ldap') and app.state.ldap is not None:
            app.state.ldap.unbind()
            
        server = Server(app_config["ldap_url"], get_info=ALL)
        conn = Connection(server, user=LDAP_USER, password=LDAP_PASS, auto_bind=True)
        app.state.ldap = conn
        
        return {
            "success": True,
            "message": f"LDAP server set to {app_config['ldap_url']}",
            "current_config": {
                "ldap_server": app_config["ldap_server"],
                "ldap_url": app_config["ldap_url"]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to set LDAP server: {str(e)}")

@app.get("/api/config/ldap-server")
async def get_ldap_server():
    """Get the current LDAP server configuration"""
    return {
        "ldap_server": app_config["ldap_server"],
        "ldap_url": app_config["ldap_url"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)