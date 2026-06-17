from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, field_validator
import re


# ──────────────────────────────────────────────
# Repository Create / Update
# ──────────────────────────────────────────────

class RepositoryCreate(BaseModel):
    """Create a bare repository record (no file, no git URL yet)."""
    project_id:   str
    name:         str
    description:  Optional[str] = None
    visibility:   Optional[str] = "Private"
    tags:         Optional[List[str]] = []
    notes:        Optional[str] = None


class ConnectGitRepo(BaseModel):
    """Payload for connecting a remote Git repository."""
    project_id:   str
    name:         str
    description:  Optional[str] = None
    git_url:      str
    git_branch:   Optional[str] = "main"
    visibility:   Optional[str] = "Private"
    tags:         Optional[List[str]] = []
    notes:        Optional[str] = None

    @field_validator("git_url")
    @classmethod
    def validate_git_url(cls, v: str) -> str:
        pattern = r"^https?://.+"
        if not re.match(pattern, v):
            raise ValueError("git_url must start with http:// or https://")
        return v.strip()


class RepositoryUpdate(BaseModel):
    """Partial update — all fields optional."""
    name:         Optional[str]  = None
    description:  Optional[str]  = None
    visibility:   Optional[str]  = None
    git_branch:   Optional[str]  = None
    tags:         Optional[List[str]] = None
    notes:        Optional[str]  = None
    language:     Optional[str]  = None


class RepositoryFavoriteToggle(BaseModel):
    favorite: bool


class RepositoryArchiveToggle(BaseModel):
    archive: bool


# ──────────────────────────────────────────────
# Settings Schemas
# ──────────────────────────────────────────────

class RepositorySettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:               str
    repository_id:    str
    auto_analyze:     bool
    notify_on_change: bool
    default_branch:   str
    analysis_depth:   str


class RepositorySettingsUpdate(BaseModel):
    auto_analyze:     Optional[bool] = None
    notify_on_change: Optional[bool] = None
    default_branch:   Optional[str]  = None
    analysis_depth:   Optional[str]  = None


# ──────────────────────────────────────────────
# Repository Output
# ──────────────────────────────────────────────

class RepositoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:                str
    project_id:        str
    workspace_id:      str
    name:              str
    description:       Optional[str]
    repo_type:         str
    status:            str
    visibility:        str
    git_url:           Optional[str]
    git_branch:        Optional[str]
    original_filename: Optional[str]
    file_size_bytes:   Optional[int]
    language:          Optional[str]
    tags:              Optional[List[str]]
    notes:             Optional[str]
    is_archived:       bool
    is_favorite:       bool = False
    created_at:        datetime
    updated_at:        datetime
    settings:          Optional[RepositorySettingsOut] = None


# ──────────────────────────────────────────────
# Activity Log Output
# ──────────────────────────────────────────────

class RepositoryActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:            str
    repository_id: str
    action:        str
    details:       Optional[str]
    created_at:    datetime


# ──────────────────────────────────────────────
# Upload History Output
# ──────────────────────────────────────────────

class RepositoryUploadHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:              str
    repository_id:   str
    filename:        str
    file_size_bytes: Optional[int]
    status:          str
    error_message:   Optional[str]
    uploaded_at:     datetime
