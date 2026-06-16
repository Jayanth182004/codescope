from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.core.security import decode_token
from app.core.exceptions import APIError
from app.modules.auth.repository import UserRepository
from app.modules.auth.models import User

security_scheme = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> User:
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise APIError("Invalid or expired authentication credentials", status_code=401)
    
    user_id = payload.get("sub")
    if not user_id:
        raise APIError("Invalid credentials format", status_code=401)
        
    user = UserRepository.get_by_id(db, user_id)
    if not user:
        raise APIError("User account not found", status_code=401)
        
    return user
