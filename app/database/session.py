from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def apply_sqlite_compatibility_upgrades() -> None:
    """Bridge pre-Alembic developer databases without touching production."""
    if not settings.DATABASE_URL.startswith("sqlite"):
        return
    inspector = inspect(engine)
    if "repositories" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("repositories")}
    if "extracted_path" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE repositories ADD COLUMN extracted_path VARCHAR(2048)"))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
