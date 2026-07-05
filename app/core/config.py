import os
from typing import List
from pydantic import AnyHttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "CodeScope AI"
    API_V1_STR: str = "/api/v1"
    
    # Security
    # In production, replace these with secure environment variables
    SECRET_KEY: str = os.getenv("SECRET_KEY", "codescope_super_secret_signing_key_387d89f2e3c09b7")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days for developer ease
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    # Primary relational DB — PostgreSQL in all environments
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://codescope_user:codescope_secure_pass_387@localhost:5432/codescope_dev")

    # File uploads  configurable for cloud storage in production
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")
    MAX_ZIP_SIZE_BYTES: int = int(os.getenv("MAX_ZIP_SIZE_BYTES", str(100 * 1024 * 1024)))
    MAX_EXTRACTED_SIZE_BYTES: int = int(os.getenv("MAX_EXTRACTED_SIZE_BYTES", str(500 * 1024 * 1024)))
    MAX_ZIP_FILES: int = int(os.getenv("MAX_ZIP_FILES", "20000"))
    MAX_ANALYSIS_FILES: int = int(os.getenv("MAX_ANALYSIS_FILES", "50000"))
    MAX_ANALYZED_FILE_SIZE_BYTES: int = int(os.getenv("MAX_ANALYZED_FILE_SIZE_BYTES", str(5 * 1024 * 1024)))
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # ── Neo4j Knowledge Graph ────────────────────────────────────────────────
    # URI must use the bolt:// or neo4j:// scheme for the driver.
    # neo4j+s:// enables TLS in production.
    NEO4J_URI: str = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    NEO4J_USERNAME: str = os.getenv("NEO4J_USERNAME", "neo4j")
    NEO4J_PASSWORD: str = os.getenv("NEO4J_PASSWORD", "codescope_neo4j_pass")
    NEO4J_DATABASE: str = os.getenv("NEO4J_DATABASE", "neo4j")

    # Graph tuning — safe for repositories up to ~100k nodes
    GRAPH_BATCH_SIZE: int = int(os.getenv("GRAPH_BATCH_SIZE", "500"))
    GRAPH_MAX_DEPTH: int = int(os.getenv("GRAPH_MAX_DEPTH", "8"))
    GRAPH_MAX_SUBGRAPH_NODES: int = int(os.getenv("GRAPH_MAX_SUBGRAPH_NODES", "5000"))

    model_config = SettingsConfigDict(case_sensitive=True)

settings = Settings()
