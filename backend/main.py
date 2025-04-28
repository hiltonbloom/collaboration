from fastapi import FastAPI, HTTPException, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import subprocess
import json
import re

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


# Default attributes for different object types
DEFAULT_ATTRIBUTES = {
    "computers": ["Name", "OperatingSystem", "LastLogonDate", "IPv4Address", "DistinguishedName", "Enabled", "ManagedBy", "Description"],
    "users": ["Name", "SamAccountName", "EmailAddress", "Enabled", "LastLogonDate", "DistinguishedName", "Department", "Title"],
    "groups": ["Name", "GroupCategory", "GroupScope", "Description", "DistinguishedName", "ManagedBy"]
}

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

@app.get("/api/ad/attributes/{object_type}")
def get_attributes(object_type: str):
    """Get available attributes for a specific AD object type"""
    if object_type not in DEFAULT_ATTRIBUTES:
        raise HTTPException(status_code=400, detail="Invalid object type")
    
    return {"attributes": DEFAULT_ATTRIBUTES[object_type]}

@app.post("/api/ad/query")
def query_ad(request: ADQueryRequest):
    """Query Active Directory based on filter type, search query, and optional OU paths"""
    # Validate the query string
    if not re.match(r'^[a-zA-Z0-9\s\-@._]*$', request.query):
        raise HTTPException(status_code=400, detail="Invalid query format")

    attributes_list = ",".join(request.attributes)
    filter_type = request.filter.lower()
    all_results = []

    # Supported filters
    valid_filters = ["computers", "users", "groups"]
    if filter_type not in valid_filters:
        raise HTTPException(status_code=400, detail="Invalid filter type")

    # Handle each OU path or a default query if none provided
    ou_paths = request.ou_paths or [None]

    for ou in ou_paths:
        if ou and not re.match(r'^[a-zA-Z0-9=,.\- ]+$', ou):
            raise HTTPException(status_code=400, detail=f"Invalid OU path: {ou}")

        if filter_type == "computers":
            base_command = (
                f'Get-ADComputer '
                f'{"-SearchBase \'" + ou + "\' " if ou else ""}'
                f'-Filter "Name -like \'*{request.query}*\'" '
                f'-Properties {attributes_list}'
            )

        elif filter_type == "users":
            base_command = (
                f'Get-ADUser '
                f'{"-SearchBase \'" + ou + "\' " if ou else ""}'
                f'-Filter "Name -like \'*{request.query}*\' -or SamAccountName -like \'*{request.query}*\'" '
                f'-Properties {attributes_list}'
            )

        elif filter_type == "groups":
            base_command = (
                f'Get-ADGroup '
                f'{"-SearchBase \'" + ou + "\' " if ou else ""}'
                f'-Filter "Name -like \'*{request.query}*\'" '
                f'-Properties {attributes_list}'
            )

        # Wrap in full command
        command = f"""
        {base_command} |
        Select-Object -Property {attributes_list} |
        ConvertTo-Json
        """

        try:
            result = execute_powershell(command)
            parsed = json.loads(result)

            if isinstance(parsed, dict):
                parsed = [parsed]
            elif parsed is None:
                parsed = []

            all_results.extend(parsed)

        except json.JSONDecodeError as e:
            raise HTTPException(status_code=500, detail=f"Failed to parse PowerShell output for OU: {ou or 'Default'}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error querying OU {ou or 'Default'}: {str(e)}")

    return {
        "results": all_results,
        "totalCount": len(all_results),
        "availableAttributes": request.attributes
    }

@app.get("/api/ad/machines-in-ou")
def get_machines_in_ou(ou_path: Optional[str] = Query("OU=BUMC-Imaged,OU=BUMC,DC=ad,DC=bu,DC=edu")):
    """Get all computer objects in a specific Organizational Unit (OU)"""
    # Sanitize input (basic)
    if not re.match(r'^[a-zA-Z=, ]+$', ou_path):
        raise HTTPException(status_code=400, detail="Invalid OU path format")

    # PowerShell command
    command = f"""
    $OUPath = "{ou_path}";
    Get-ADComputer -SearchBase $OUPath -Filter * |
    Select-Object Name, DistinguishedName, Enabled |
    ConvertTo-Json
    """

    try:
        result = execute_powershell(command)
        machines = json.loads(result)

        if not isinstance(machines, list):
            machines = [machines]

        return {
            "results": machines,
            "totalCount": len(machines)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get machines: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)