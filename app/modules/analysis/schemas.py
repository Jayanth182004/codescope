import json
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class AnalysisStartRequest(BaseModel):
    force: bool = False


class AnalysisRunOut(ORMModel):
    id: str
    repository_id: str
    status: str
    files_discovered: int
    files_parsed: int
    errors_count: int
    warnings: list[dict] = Field(default_factory=list)
    error_message: str | None
    started_at: datetime
    completed_at: datetime | None
    duration_ms: int | None


class FileOut(ORMModel):
    id: str; path: str; name: str; extension: str; size_bytes: int
    encoding: str | None; language: str; content_hash: str; lines_of_code: int
    created_at: datetime | None; modified_at: datetime | None
    parse_status: str; parse_error: str | None


class FunctionOut(ORMModel):
    id: str; file_path: str; module: str; class_name: str | None; name: str; qualified_name: str
    line_number: int; start_line: int; end_line: int; visibility: str; is_async: bool
    decorators: list[str] = Field(default_factory=list); parameters: list[dict] = Field(default_factory=list)
    return_type: str | None; docstring: str | None


class ClassOut(ORMModel):
    id: str; file_path: str; module: str; name: str; qualified_name: str
    line_number: int; start_line: int; end_line: int; visibility: str
    bases: list[str] = Field(default_factory=list); decorators: list[str] = Field(default_factory=list); docstring: str | None


class ModuleOut(ORMModel):
    id: str; file_path: str; name: str; package: str | None; is_package: bool; docstring: str | None


class ImportOut(ORMModel):
    id: str; file_path: str; module: str; imported_name: str | None; alias: str | None; level: int; line_number: int


class LanguageOut(ORMModel):
    language: str; file_count: int; lines_of_code: int; size_bytes: int; percentage: float


class MetricsOut(ORMModel):
    total_files: int; total_folders: int; lines_of_code: int; languages: int
    functions: int; classes: int; modules: int; packages: int; imports: int
    largest_file_path: str | None; largest_file_size: int
    largest_folder_path: str | None; largest_folder_size: int


class AnalysisReportOut(BaseModel):
    run: AnalysisRunOut
    metrics: MetricsOut | None
    languages: list[LanguageOut]


class PageOut(BaseModel):
    items: list
    total: int
    limit: int
    offset: int


def run_out(run) -> AnalysisRunOut:
    return AnalysisRunOut(
        id=run.id, repository_id=run.repository_id, status=run.status,
        files_discovered=run.files_discovered, files_parsed=run.files_parsed,
        errors_count=run.errors_count, warnings=json.loads(run.warnings_json or "[]"),
        error_message=run.error_message, started_at=run.started_at,
        completed_at=run.completed_at, duration_ms=run.duration_ms,
    )


def function_out(row) -> FunctionOut:
    return FunctionOut(
        id=row.id, file_path=row.file_path, module=row.module, class_name=row.class_name,
        name=row.name, qualified_name=row.qualified_name, line_number=row.line_number,
        start_line=row.start_line, end_line=row.end_line, visibility=row.visibility,
        is_async=row.is_async, decorators=json.loads(row.decorators_json or "[]"),
        parameters=json.loads(row.parameters_json or "[]"), return_type=row.return_type, docstring=row.docstring,
    )


def class_out(row) -> ClassOut:
    return ClassOut(
        id=row.id, file_path=row.file_path, module=row.module, name=row.name,
        qualified_name=row.qualified_name, line_number=row.line_number,
        start_line=row.start_line, end_line=row.end_line, visibility=row.visibility,
        bases=json.loads(row.bases_json or "[]"), decorators=json.loads(row.decorators_json or "[]"), docstring=row.docstring,
    )
