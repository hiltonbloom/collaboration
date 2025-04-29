from fastapi import FastAPI, HTTPException, Body, Query, Path, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union
import subprocess
import json
import re
import uuid
import time
from datetime import datetime, timedelta
import base64

app = FastAPI(title="Active Directory Query API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React app's address
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class ADQueryRequest(BaseModel):
    filter: str  # 'computers', 'users', or 'groups'
    query: str
    attributes: List[str]
    ou_paths: Optional[List[str]] = None  # Accept multiple OUs
    page_size: Optional[int] = 50  # Default page size

class PaginatedResponse(BaseModel):
    results: List[Dict[str, Any]]
    total_count: int
    current_page: int
    total_pages: int
    has_next_page: bool
    session_id: str
    is_count_exact: bool

class PageRequest(BaseModel):
    session_id: str
    page_number: int = 1

# Default attributes for different object types
DEFAULT_ATTRIBUTES = {
    "computers": ["Name", "OperatingSystem", "LastLogonDate", "IPv4Address", "DistinguishedName", "Enabled", "ManagedBy", "Description"],
    "users": ["Name", "SamAccountName", "EmailAddress", "Enabled", "LastLogonDate", "DistinguishedName", "Department", "Title"],
    "groups": ["Name", "GroupCategory", "GroupScope", "Description", "DistinguishedName", "ManagedBy"]
}

# In-memory session store with TTL
class SessionStore:
    def __init__(self, ttl_seconds=1800):  # Default 30 minute TTL
        self.sessions = {}
        self.ttl_seconds = ttl_seconds
    
    def create_session(self, query_params):
        session_id = str(uuid.uuid4())
        self.sessions[session_id] = {
            'query_params': query_params,
            'created_at': datetime.now(),
            'last_accessed': datetime.now(),
            'pages_fetched': 0,
            'total_count': 0,
            'is_count_exact': False,
            'pagination_cookies': {},
            'all_results': [],
            'is_complete': False
        }
        return session_id
    
    def get_session(self, session_id):
        if session_id not in self.sessions:
            return None
        
        session = self.sessions[session_id]
        # Check if expired
        if datetime.now() - session['created_at'] > timedelta(seconds=self.ttl_seconds):
            del self.sessions[session_id]
            return None
        
        # Update last accessed time
        session['last_accessed'] = datetime.now()
        return session
    
    def update_session(self, session_id, data):
        if session_id in self.sessions:
            self.sessions[session_id].update(data)
            self.sessions[session_id]['last_accessed'] = datetime.now()
    
    def cleanup_expired(self):
        # Clean up expired sessions
        now = datetime.now()
        expired = [sid for sid, session in self.sessions.items() 
                  if now - session['created_at'] > timedelta(seconds=self.ttl_seconds)]
        
        for sid in expired:
            del self.sessions[sid]

# Create session store
session_store = SessionStore()

# Helper function to execute PowerShell commands
def execute_powershell(command: str) -> str:
    try:
        # Use PowerShell to execute the command
        process = subprocess.run(
            ["powershell", "-Command", command],
            capture_output=True,
            text=True,
            check=True
        )
        return process.stdout
    except subprocess.CalledProcessError as e:
        print(f"PowerShell error: {e.stderr}")
        raise HTTPException(status_code=500, detail=f"PowerShell error: {e.stderr}")

@app.get("/")
def read_root():
    return {"message": "Active Directory Query API"}

@app.get("/api/health")
def health_check():
    """API Health Check"""
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

@app.get("/api/ad/attributes/{object_type}")
def get_attributes(object_type: str):
    """Get available attributes for a specific AD object type"""
    if object_type not in DEFAULT_ATTRIBUTES:
        raise HTTPException(status_code=400, detail="Invalid object type")
    
    return {"attributes": DEFAULT_ATTRIBUTES[object_type]}

# AD Query with pagination
@app.post("/api/ad/query")
def query_ad(request: ADQueryRequest):
    """
    Initial query to Active Directory with pagination.
    Returns the first page of results and a session ID for subsequent page requests.
    """
    # Validate the query string
    if not re.match(r'^[a-zA-Z0-9\s\-@._]*$', request.query):
        raise HTTPException(status_code=400, detail="Invalid query format")

    # Ensure page size is reasonable
    page_size = min(max(10, request.page_size or 50), 200)  # Between 10 and 200
    
    # Create a session for this query
    session_id = session_store.create_session({
        'filter': request.filter,
        'query': request.query,
        'attributes': request.attributes,
        'ou_paths': request.ou_paths,
        'page_size': page_size
    })
    
    # Get first page of results
    results, total_count, is_exact, has_more, pagination_cookie = get_ad_page(
        request.filter,
        request.query,
        request.attributes,
        request.ou_paths,
        page_size,
        None,  # No pagination cookie for first page
        True    # Get total count estimate
    )
    
    # Update session with results
    session_store.update_session(session_id, {
        'total_count': total_count,
        'is_count_exact': is_exact,
        'pages_fetched': 1,
        'all_results': results.copy(),
        'is_complete': not has_more,
        'pagination_cookies': {1: None, 2: pagination_cookie if has_more else None}
    })
    
    # Calculate total pages
    total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1
    
    return PaginatedResponse(
        results=results,
        total_count=total_count,
        current_page=1,
        total_pages=total_pages,
        has_next_page=has_more,
        session_id=session_id,
        is_count_exact=is_exact
    )

@app.get("/api/ad/query/page/{session_id}")
def get_page(
    session_id: str = Path(..., title="Session ID from initial query"),
    page_number: int = Query(1, ge=1, title="Page number to retrieve")
):
    """
    Get a specific page of results for an existing query session.
    Page numbers start at 1 (first page).
    """
    # Get the session
    session = session_store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    
    # Check if page number is valid
    page_size = session['query_params']['page_size']
    total_count = session['total_count']
    total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1
    
    if page_number > total_pages:
        raise HTTPException(status_code=400, detail=f"Page number exceeds total pages: {total_pages}")
    
    # Check if we already have this page in the session
    if len(session['all_results']) >= page_number * page_size:
        # Calculate the slice for this page
        start_idx = (page_number - 1) * page_size
        end_idx = min(start_idx + page_size, len(session['all_results']))
        page_results = session['all_results'][start_idx:end_idx]
        
        return PaginatedResponse(
            results=page_results,
            total_count=total_count,
            current_page=page_number,
            total_pages=total_pages,
            has_next_page=page_number < total_pages,
            session_id=session_id,
            is_count_exact=session['is_count_exact']
        )
    
    # We need to fetch this page
    # Find the closest pagination cookie we have
    current_page = session['pages_fetched']
    if page_number <= current_page:
        # We should already have this page, but we don't - something went wrong
        raise HTTPException(status_code=500, detail="Page should be in cache but isn't")
    
    # We need to fetch pages sequentially until we reach the requested page
    while current_page < page_number:
        # Get the cookie for the next page
        cookie = session['pagination_cookies'].get(current_page + 1)
        if not cookie:
            raise HTTPException(status_code=500, detail="Pagination cookie not found")
        
        # Fetch the next page
        results, _, _, has_more, next_cookie = get_ad_page(
            session['query_params']['filter'],
            session['query_params']['query'],
            session['query_params']['attributes'],
            session['query_params']['ou_paths'],
            page_size,
            cookie,
            False  # Don't need count for subsequent pages
        )
        
        # Update the session
        current_page += 1
        session['pages_fetched'] = current_page
        session['all_results'].extend(results)
        
        if has_more:
            session['pagination_cookies'][current_page + 1] = next_cookie
        else:
            session['is_complete'] = True
        
        session_store.update_session(session_id, session)
    
    # Calculate the slice for this page
    start_idx = (page_number - 1) * page_size
    end_idx = min(start_idx + page_size, len(session['all_results']))
    page_results = session['all_results'][start_idx:end_idx]
    
    return PaginatedResponse(
        results=page_results,
        total_count=total_count,
        current_page=page_number,
        total_pages=total_pages,
        has_next_page=page_number < total_pages,
        session_id=session_id,
        is_count_exact=session['is_count_exact']
    )

@app.get("/api/ad/query/all/{session_id}")
def get_all_results(
    session_id: str = Path(..., title="Session ID from initial query"),
    max_results: int = Query(10000, ge=0, title="Maximum number of results to return (0 for unlimited)")
):
    """
    Get all results for a query session.
    This may involve multiple AD queries to fetch all pages.
    Use max_results parameter to limit the total number of results.
    """
    # Get the session
    session = session_store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    
    # If we already have all results, return them
    if session['is_complete']:
        results = session['all_results']
        if max_results > 0:
            results = results[:max_results]
        
        return {
            "results": results,
            "total_count": session['total_count'],
            "is_complete": True,
            "is_count_exact": session['is_count_exact'],
            "fetched_count": len(results)
        }
    
    # We need to fetch more pages
    query_params = session['query_params']
    page_size = query_params['page_size']
    current_results = session['all_results']
    current_page = session['pages_fetched']
    
    # Continue fetching until we have all results or reach max_results
    while True:
        # Check if we've reached max_results
        if max_results > 0 and len(current_results) >= max_results:
            break
        
        # Get the cookie for the next page
        cookie = session['pagination_cookies'].get(current_page + 1)
        if not cookie:
            # No more pages
            session['is_complete'] = True
            break
        
        # Fetch the next page
        results, _, _, has_more, next_cookie = get_ad_page(
            query_params['filter'],
            query_params['query'],
            query_params['attributes'],
            query_params['ou_paths'],
            page_size,
            cookie,
            False  # Don't need count for subsequent pages
        )
        
        # Update progress
        current_page += 1
        current_results.extend(results)
        
        # Update cookies
        if has_more:
            session['pagination_cookies'][current_page + 1] = next_cookie
        else:
            session['is_complete'] = True
            break
    
    # Update session
    session['pages_fetched'] = current_page
    session['all_results'] = current_results
    session_store.update_session(session_id, session)
    
    # Return results
    results = session['all_results']
    if max_results > 0:
        results = results[:max_results]
    
    return {
        "results": results,
        "total_count": session['total_count'],
        "is_complete": session['is_complete'],
        "is_count_exact": session['is_count_exact'],
        "fetched_count": len(results)
    }

@app.get("/api/ad/query/export/{session_id}")
def export_results(
    session_id: str = Path(..., title="Session ID from initial query"),
    format: str = Query("csv", title="Export format (csv or json)"),
    selected_only: bool = Query(False, title="Export only selected items"),
    selected_ids: List[str] = Query(None, title="IDs of selected items when selected_only is True")
):
    """
    Export query results in the specified format.
    Can export all results or only selected items.
    """
    # This is a placeholder - in a real implementation, this would generate a file
    # and return a download URL or stream the file directly
    return {"message": "Export API not yet implemented"}

# Helper function to get a single page of AD results with pagination
def get_ad_page(
    filter_type: str,
    query: str,
    attributes: List[str],
    ou_paths: Optional[List[str]],
    page_size: int,
    pagination_cookie: Optional[str],
    get_count: bool
) -> tuple:
    """
    Get a single page of AD results with pagination.
    Returns a tuple of (results, total_count, is_count_exact, has_more, next_page_cookie)
    """
    attributes_list = ",".join(attributes)
    filter_type = filter_type.lower()
    all_results = []
    total_count = 0
    is_count_exact = True
    
    # Supported filters
    valid_filters = ["computers", "users", "groups"]
    if filter_type not in valid_filters:
        raise HTTPException(status_code=400, detail="Invalid filter type")
    
    # Handle empty search query
    search_query = query.strip()
    
    # Handle each OU path or a default query if none provided
    ou_paths = ou_paths or [None]
    
    # First, get count if requested
    if get_count:
        count_command = ""
        for ou in ou_paths:
            if ou and not re.match(r'^[a-zA-Z0-9=,.\- ]+$', ou):
                raise HTTPException(status_code=400, detail=f"Invalid OU path: {ou}")
                
            # Create appropriate filter based on filter_type and whether search_query is empty
            if filter_type == "computers":
                filter_condition = f"Name -like '*{search_query}*'" if search_query else "Name -like '*'"
                count_command += f"""
                Get-ADComputer {"-SearchBase '" + ou + "' " if ou else ""} -Filter "{filter_condition}" | Measure-Object | Select-Object -ExpandProperty Count;
                """
            elif filter_type == "users":
                if search_query:
                    filter_condition = f"Name -like '*{search_query}*' -or SamAccountName -like '*{search_query}*'"
                else:
                    filter_condition = "Name -like '*'"
                    
                count_command += f"""
                Get-ADUser {"-SearchBase '" + ou + "' " if ou else ""} -Filter "{filter_condition}" | Measure-Object | Select-Object -ExpandProperty Count;
                """
            elif filter_type == "groups":
                filter_condition = f"Name -like '*{search_query}*'" if search_query else "Name -like '*'"
                count_command += f"""
                Get-ADGroup {"-SearchBase '" + ou + "' " if ou else ""} -Filter "{filter_condition}" | Measure-Object | Select-Object -ExpandProperty Count;
                """
        
        try:
            count_result = execute_powershell(count_command)
            counts = [int(c.strip()) for c in count_result.strip().split('\n') if c.strip()]
            total_count = sum(counts)
        except Exception as e:
            # If count fails, we'll set an approximate count
            print(f"Count estimation failed: {str(e)}")
            total_count = 1000  # Default estimate
            is_count_exact = False
    
    # Now get the actual page of results
    pagination_command = ""
    for ou in ou_paths:
        if ou and not re.match(r'^[a-zA-Z0-9=,.\- ]+$', ou):
            continue  # Skip invalid OUs, already validated above
            
        # Create appropriate filter based on filter_type
        if filter_type == "computers":
            filter_condition = f"Name -like '*{search_query}*'" if search_query else "Name -like '*'"
            pagination_command += f"""
            $SearchParams = @{{
                'SearchBase' = {("'" + ou + "'") if ou else "$null"}
                'Filter' = "{filter_condition}"
                'Properties' = "{attributes_list}"
                'ResultPageSize' = {page_size}
            }}
            """
        elif filter_type == "users":
            if search_query:
                filter_condition = f"Name -like '*{search_query}*' -or SamAccountName -like '*{search_query}*'"
            else:
                filter_condition = "Name -like '*'"
                
            pagination_command += f"""
            $SearchParams = @{{
                'SearchBase' = {("'" + ou + "'") if ou else "$null"}
                'Filter' = "{filter_condition}"
                'Properties' = "{attributes_list}"
                'ResultPageSize' = {page_size}
            }}
            """
        elif filter_type == "groups":
            filter_condition = f"Name -like '*{search_query}*'" if search_query else "Name -like '*'"
            pagination_command += f"""
            $SearchParams = @{{
                'SearchBase' = {("'" + ou + "'") if ou else "$null"}
                'Filter' = "{filter_condition}"
                'Properties' = "{attributes_list}"
                'ResultPageSize' = {page_size}
            }}
            """
        
        # Add pagination cookie if provided
        cookie_param = ""
        if pagination_cookie:
            cookie_param = f"""
            $Cookie = [System.Convert]::FromBase64String('{pagination_cookie}')
            $SearchParams['SearchPager'] = New-Object System.DirectoryServices.Protocols.PageResultRequestControl -ArgumentList $Cookie
            """
        
        # Execute search based on filter type
        search_cmd = ""
        if filter_type == "computers":
            search_cmd = "Get-ADComputer @SearchParams"
        elif filter_type == "users":
            search_cmd = "Get-ADUser @SearchParams"
        elif filter_type == "groups":
            search_cmd = "Get-ADGroup @SearchParams"
        
        pagination_command += f"""
        {cookie_param}
        
        # Execute the search
        $SearchResults = {search_cmd} | Select-Object -Property {attributes_list}
        
        # Get pagination cookie for next page
        $Cookie = [System.Convert]::ToBase64String($SearchParams['SearchPager'].Cookie) 
        
        # Return results and cookie
        $Results = @{{
            'Items' = $SearchResults
            'Cookie' = $Cookie
            'HasMoreResults' = ($Cookie -ne '') 
        }}
        
        $Results | ConvertTo-Json -Depth 3
        """
    
    try:
        result = execute_powershell(pagination_command)
        # Parse JSON result
        parsed = json.loads(result)
    
        # Handle different result formats
        if isinstance(parsed, dict):
            items = parsed.get('Items', [])
            if items is None:
                items = []
            elif isinstance(items, dict):
                items = [items]  # Convert single item to array
            cookie = parsed.get('Cookie', '')
            has_more = parsed.get('HasMoreResults', False)
        
            all_results.extend(items or [])
            next_cookie = cookie if has_more else None
        else:
            # Unexpected format - log more info for debugging
            print(f"Unexpected result format: {type(parsed)}")
            print(f"Result content: {parsed}")
            raise HTTPException(status_code=500, detail="Unexpected result format from PowerShell")
    
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse PowerShell output: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error querying AD: {str(e)}")
    
    return all_results, total_count, is_count_exact, has_more, next_cookie

# Cleanup expired sessions periodically
@app.on_event("startup")
async def startup_event():
    # Add any startup tasks here
    pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)