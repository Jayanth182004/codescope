from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.auth import UserCreate, UserLogin, TokenRefresh, TokenOut, UserOut, UserUpdate
from app.schemas.envelope import APIEnvelope
from app.repositories.user_repository import UserRepository
from app.repositories.session_repository import SessionRepository
from app.core.security import verify_password, create_access_token, create_refresh_token, decode_token
from app.core.exceptions import APIError
from app.dependencies.auth import get_current_user
from app.models.models import User

router = APIRouter(prefix="/auth", tags=["Authentication"])
user_router = APIRouter(prefix="/users", tags=["Users"])

@router.post("/register", response_model=APIEnvelope[TokenOut])
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    existing_user = UserRepository.get_by_email(db, user_in.email)
    if existing_user:
        raise APIError("Email address is already registered", status_code=400)
    
    user = UserRepository.create(db, user_in)
    
    access_token = create_access_token({"sub": user.id})
    refresh_token = create_refresh_token({"sub": user.id})
    
    SessionRepository.create_session(db, user.id, refresh_token)
    
    return APIEnvelope(
        success=True,
        message="User registered successfully",
        data=TokenOut(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserOut.from_orm(user)
        )
    )

@router.post("/login", response_model=APIEnvelope[TokenOut])
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = UserRepository.get_by_email(db, credentials.email)
    if not user or not verify_password(credentials.password, user.password_hash):
        raise APIError("Incorrect email or password combination", status_code=400)
        
    access_token = create_access_token({"sub": user.id})
    refresh_token = create_refresh_token({"sub": user.id})
    
    SessionRepository.create_session(db, user.id, refresh_token)
    
    return APIEnvelope(
        success=True,
        message="Login successful",
        data=TokenOut(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserOut.from_orm(user)
        )
    )

@router.post("/refresh", response_model=APIEnvelope[TokenOut])
def refresh_token(payload: TokenRefresh, db: Session = Depends(get_db)):
    db_session = SessionRepository.get_session(db, payload.refresh_token)
    if not db_session:
        raise APIError("Invalid or expired refresh token session", status_code=401)
        
    claims = decode_token(payload.refresh_token)
    if not claims or not claims.get("refresh"):
        raise APIError("Invalid token claim parameters", status_code=401)
        
    user_id = claims.get("sub")
    user = UserRepository.get_by_id(db, user_id)
    if not user:
        raise APIError("User account not found", status_code=401)
        
    # Invalidate previous token and write a new session
    SessionRepository.revoke_session(db, payload.refresh_token)
    
    new_access_token = create_access_token({"sub": user.id})
    new_refresh_token = create_refresh_token({"sub": user.id})
    
    SessionRepository.create_session(db, user.id, new_refresh_token)
    
    return APIEnvelope(
        success=True,
        message="Token session refreshed successfully",
        data=TokenOut(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            user=UserOut.from_orm(user)
        )
    )

@router.post("/logout", response_model=APIEnvelope[None])
def logout(payload: TokenRefresh, db: Session = Depends(get_db)):
    SessionRepository.revoke_session(db, payload.refresh_token)
    return APIEnvelope(success=True, message="Session logged out successfully")

@router.post("/forgot-password", response_model=APIEnvelope[None])
def forgot_password():
    # Placeholder mock endpoint supporting client request parameters
    return APIEnvelope(success=True, message="If the email exists, a password reset link has been dispatched.")

@router.post("/reset-password", response_model=APIEnvelope[None])
def reset_password():
    return APIEnvelope(success=True, message="Password successfully reset.")

@user_router.get("/me", response_model=APIEnvelope[UserOut])
def get_me(current_user: User = Depends(get_current_user)):
    return APIEnvelope(
        success=True,
        message="Current user profile retrieved",
        data=UserOut.from_orm(current_user)
    )

@user_router.patch("/me", response_model=APIEnvelope[UserOut])
def update_profile(
    profile_in: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if profile_in.email:
        existing = UserRepository.get_by_email(db, profile_in.email)
        if existing and existing.id != current_user.id:
            raise APIError("Email address is already in use by another user", status_code=400)
            
    updated_user = UserRepository.update(
        db, 
        current_user, 
        name=profile_in.name, 
        email=profile_in.email
    )
    return APIEnvelope(
        success=True,
        message="Profile updated successfully",
        data=UserOut.from_orm(updated_user)
    )
