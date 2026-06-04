import re
from datetime import datetime
from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator

Visibility = Literal["Private", "Internal", "Public"]


def clean_name(value: str) -> str:
    value = " ".join(value.split())
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._ -]{1,118}[A-Za-z0-9]", value):
        raise ValueError("name must be 3-120 characters and use letters, numbers, spaces, '.', '_' or '-'")
    return value


def clean_tags(values: list[str]) -> list[str]:
    normalized = []
    for value in values:
        tag = value.strip().lower()
        if not re.fullmatch(r"[a-z0-9][a-z0-9._-]{0,31}", tag):
            raise ValueError("tags must be 1-32 lowercase letters, numbers, '.', '_' or '-'")
        if tag not in normalized:
            normalized.append(tag)
    if len(normalized) > 20:
        raise ValueError("a repository may have at most 20 tags")
    return normalized


class RepositoryCreate(BaseModel):
    project_id: str = Field(min_length=1)
    name: str
    description: str | None = Field(default=None, max_length=2000)
    visibility: Visibility = "Private"
    tags: list[str] = Field(default_factory=list)
    notes: str | None = Field(default=None, max_length=10000)

    _name = field_validator("name")(clean_name)
    _tags = field_validator("tags")(clean_tags)


class ConnectGitRepo(RepositoryCreate):
    git_url: str = Field(max_length=2048)
    git_branch: str = Field(default="main", min_length=1, max_length=255)

    @field_validator("git_url")
    @classmethod
    def validate_git_url(cls, value: str) -> str:
        value = value.strip()
        parsed = urlparse(value)
        if parsed.scheme not in {"https", "http"} or not parsed.hostname:
            raise ValueError("git_url must be an absolute HTTP(S) URL")
        if parsed.username or parsed.password:
            raise ValueError("credentials must not be embedded in git_url")
        if parsed.hostname in {"localhost", "127.0.0.1", "::1"}:
            raise ValueError("local Git hosts are not allowed")
        return value

    @field_validator("git_branch")
    @classmethod
    def validate_branch(cls, value: str) -> str:
        value = value.strip()
        if not re.fullmatch(r"(?!.*\.\.)(?!.*//)[A-Za-z0-9._/-]+", value):
            raise ValueError("invalid Git branch name")
        return value


class RepositoryUpdate(BaseModel):
    name: str | None = None
    description: str | None = Field(default=None, max_length=2000)
    visibility: Visibility | None = None
    git_branch: str | None = Field(default=None, min_length=1, max_length=255)
    tags: list[str] | None = None
    notes: str | None = Field(default=None, max_length=10000)

    _name = field_validator("name")(lambda value: clean_name(value) if value is not None else value)
    _tags = field_validator("tags")(lambda value: clean_tags(value) if value is not None else value)


class RepositoryFavoriteToggle(BaseModel):
    favorite: bool


class RepositoryArchiveToggle(BaseModel):
    archive: bool


class RepositorySettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    repository_id: str
    auto_analyze: bool
    notify_on_change: bool
    default_branch: str
    analysis_depth: str


class RepositorySettingsUpdate(BaseModel):
    auto_analyze: bool | None = None
    notify_on_change: bool | None = None
    default_branch: str | None = Field(default=None, min_length=1, max_length=255)
    analysis_depth: Literal["shallow", "deep"] | None = None


class RepositoryMetadataOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    total_files: int
    total_folders: int
    extracted_size_bytes: int
    archive_sha256: str | None
    generated_at: datetime


class RepositoryOut(BaseModel):
    id: str
    project_id: str
    workspace_id: str
    name: str
    description: str | None
    repo_type: str
    status: str
    visibility: str
    git_url: str | None
    git_branch: str | None
    original_filename: str | None
    file_size_bytes: int | None
    language: str | None
    tags: list[str] = Field(default_factory=list)
    notes: str | None
    is_archived: bool
    is_favorite: bool = False
    created_at: datetime
    updated_at: datetime
    settings: RepositorySettingsOut | None = None
    metadata: RepositoryMetadataOut | None = None


class RepositoryActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    repository_id: str
    action: str
    details: str | None
    created_at: datetime


class RepositoryUploadHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    repository_id: str
    filename: str
    file_size_bytes: int | None
    status: str
    error_message: str | None
    uploaded_at: datetime


class RepositoryListMeta(BaseModel):
    total: int
    limit: int
    offset: int


class RepositoryListOut(BaseModel):
    items: list[RepositoryOut]
    pagination: RepositoryListMeta
