import uuid
from datetime import UTC, datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from app.modules.auth.models import User, Session as UserSession
from app.modules.auth.schemas import UserCreate
from app.core.security import get_password_hash
from app.core.config import settings

class UserRepository:
    @staticmethod
    def get_by_email(db: Session, email: str) -> Optional[User]:
        return db.query(User).filter(User.email == email).first()

    @staticmethod
    def get_by_id(db: Session, user_id: str) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def create(db: Session, user_in: UserCreate) -> User:
        user_id = str(uuid.uuid4())
        hashed_password = get_password_hash(user_in.password)
        db_user = User(
            id=user_id,
            email=user_in.email,
            name=user_in.name,
            password_hash=hashed_password
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user

    @staticmethod
    def update(db: Session, db_user: User, name: Optional[str] = None, email: Optional[str] = None) -> User:
        if name:
            db_user.name = name
        if email:
            db_user.email = email
        db.commit()
        db.refresh(db_user)
        return db_user


class SessionRepository:
    @staticmethod
    def create_session(db: Session, user_id: str, refresh_token: str) -> UserSession:
        session_id = str(uuid.uuid4())
        expires_at = datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        db_session = UserSession(
            id=session_id,
            user_id=user_id,
            refresh_token=refresh_token,
            expires_at=expires_at
        )
        db.add(db_session)
        db.commit()
        db.refresh(db_session)
        return db_session

    @staticmethod
    def get_session(db: Session, refresh_token: str) -> Optional[UserSession]:
        return db.query(UserSession).filter(
            UserSession.refresh_token == refresh_token,
            UserSession.is_revoked == False
        ).first()

    @staticmethod
    def revoke_session(db: Session, refresh_token: str) -> None:
        session = db.query(UserSession).filter(UserSession.refresh_token == refresh_token).first()
        if session:
            session.is_revoked = True
            db.commit()
