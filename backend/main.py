import base64
from datetime import datetime, timedelta
import os
import json
import uuid
from fastapi import FastAPI, HTTPException, Query, Path, Body, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from redis.asyncio import Redis
from ldap3 import Server, Connection, ALL, SUBTREE, NTLM, SIMPLE
from typing import List, Optional, Dict, Any, Union
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from contextlib import asynccontextmanager
import time
from typing import Optional

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Redis pool
    app.state.redis = Redis(host="localhost", encoding="utf-8", port=6379, decode_responses=True)
    
    yield
    # close connections
    await app.state.redis.close()

# --- FastAPI App ---
app = FastAPI(
    title="Carousel Components!",
    lifespan=lifespan
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:5000", ],  # React app addresses
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic models ---
class AuthRequest(BaseModel):
    username: str
    password: str
    
class AuthResponse(BaseModel):
    success: bool
    message: str
    user_info: Dict[str, Any] | None = None
    token: Dict[str, Any] | None = None

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


# FastAPI endpoint for verifying credentials
@app.post("/api/auth/verify")
async def verify_credentials(auth_request: AuthRequest):
    """Verify AD credentials and return user info if valid"""
    try:
        #password = decrypt_password(auth_request.encrypted_credential, SERVER_SECRET_KEY)
        if auth_request.username == 'admin' and auth_request.password == 'admin':
            success = True
            user_info = {
                'username': auth_request.username,
                'token': 'rjiaofaifefejijiemfwaoi'
            }
        if success:
            return {
                "success": True,
                "message": "Authentication successful",
                "user_info": user_info
            }
        return {
            "success": False,
            "message": "Authentication failed. Invalid credentials."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Authentication error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=2222)