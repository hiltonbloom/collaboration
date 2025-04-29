from fastapi import FastAPI, HTTPException, Depends, Request
from pydantic import BaseModel
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os
import base64
import ldap3
from ldap3 import Server, Connection, NTLM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

# Models
class AuthRequest(BaseModel):
    username: str
    domain: str
    encrypted_credential: str

class AuthResponse(BaseModel):
    success: bool
    message: str
    user_info: dict

# Secret key for server-side encryption (in production, store securely)

SERVER_SECRET_KEY = os.getenv('AD_AUTH_SECRET_KEY', 'your-secret-key-here')
SALT = os.getenv('AD_AUTH_SALT', 'your-salt-here').encode()

# Encryption/Decryption utils
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

# Active Directory authentication
def authenticate_with_ad(username: str, password: str, domain: str):
    """Authenticate a user against Active Directory"""
    try:
        server_address = f"{domain}"
        server = Server(server_address, get_info=ldap3.ALL)
        conn = Connection(
            server,
            user=f"{domain}\\{username}",
            password=password,
            authentication=NTLM,
            auto_bind=True
        )
        user_info = get_user_info(conn, username, domain)
        conn.unbind()
        return True, user_info
    except ldap3.core.exceptions.LDAPBindError as e:
        print(f"LDAP bind error: {str(e)}")
        return False, None
    except Exception as e:
        print(f"AD authentication error: {str(e)}")
        return False, None

def get_user_info(conn, username, domain):
    """Get user information from Active Directory"""
    domain_parts = domain.split('.')
    search_base = ','.join([f"DC={part}" for part in domain_parts])
    conn.search(
        search_base=search_base,
        search_filter=f"(&(objectClass=user)(sAMAccountName={username}))",
        attributes=['distinguishedName', 'memberOf', 'mail', 'displayName', 'department', 'title']
    )
    
    if len(conn.entries) > 0:
        user_entry = conn.entries[0]
        groups = [dn.split(',')[0].replace('CN=', '') for dn in user_entry.memberOf]
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

# FastAPI endpoint for verifying credentials
@app.post("/api/auth/verify")
async def verify_credentials(auth_request: AuthRequest):
    """Verify AD credentials and return user info if valid"""
    try:
        password = decrypt_password(auth_request.encrypted_credential, SERVER_SECRET_KEY)
        success, user_info = authenticate_with_ad(
            auth_request.username, password, auth_request.domain
        )
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

# Test Connection endpoint to check LDAP credentials
@app.post("/api/auth/test-connection")
async def test_connection(credentials: AuthRequest):
    """Test AD connection with the provided credentials"""
    try:
        password = decrypt_password(credentials.encrypted_credential, SERVER_SECRET_KEY)
        success, _ = authenticate_with_ad(credentials.username, password, credentials.domain)
        return {
            "connected": success,
            "message": "Connection successful" if success else "Connection failed"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Connection test error: {str(e)}")
