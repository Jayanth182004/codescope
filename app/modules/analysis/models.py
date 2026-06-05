from datetime import UTC, datetime

from sqlalchemy import BigInteger, Boolean, CheckConstraint, Column, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database.session import Base


def utc_now():
    return datetime.now(UTC)


class AnalysisRun(Base):
    __tablename__ = "analysis_runs"
    __table_args__ = (
        CheckConstraint("status IN ('pending','running','completed','completed_with_warnings','failed','cancelled')", name="ck_analysis_run_status"),
        Index("ix_analysis_runs_repository_started", "repository_id", "started_at"),
    )
    id = Column(String, primary_key=True)
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    requested_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(32), nullable=False, default="pending")
    files_discovered = Column(Integer, nullable=False, default=0)
    files_parsed = Column(Integer, nullable=False, default=0)
    errors_count = Column(Integer, nullable=False, default=0)
    warnings_json = Column(Text, nullable=False, default="[]")
    error_message = Column(Text)
    started_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    completed_at = Column(DateTime(timezone=True))
    duration_ms = Column(Integer)
    repository = relationship("Repository")


class RepositoryFolder(Base):
    __tablename__ = "repository_folders"
    __table_args__ = (UniqueConstraint("analysis_run_id", "path", name="uq_analysis_folder_run_path"), Index("ix_analysis_folder_repo_path", "repository_id", "path"))
    id = Column(String, primary_key=True)
    analysis_run_id = Column(String, ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    path = Column(String(2048), nullable=False)
    name = Column(String(255), nullable=False)
    depth = Column(Integer, nullable=False)
    parent_path = Column(String(2048))
    children_count = Column(Integer, nullable=False, default=0)
    total_files = Column(Integer, nullable=False, default=0)
    total_size_bytes = Column(BigInteger, nullable=False, default=0)


class RepositoryFile(Base):
    __tablename__ = "repository_files"
    __table_args__ = (UniqueConstraint("analysis_run_id", "path", name="uq_analysis_file_run_path"), Index("ix_analysis_file_repo_language", "repository_id", "language"))
    id = Column(String, primary_key=True)
    analysis_run_id = Column(String, ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    folder_path = Column(String(2048))
    path = Column(String(2048), nullable=False)
    name = Column(String(255), nullable=False)
    extension = Column(String(32), nullable=False, default="")
    size_bytes = Column(BigInteger, nullable=False)
    encoding = Column(String(32))
    language = Column(String(32), nullable=False)
    content_hash = Column(String(64), nullable=False)
    lines_of_code = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True))
    modified_at = Column(DateTime(timezone=True))
    parse_status = Column(String(32), nullable=False, default="not_applicable")
    parse_error = Column(Text)


class RepositoryLanguage(Base):
    __tablename__ = "repository_languages"
    __table_args__ = (UniqueConstraint("analysis_run_id", "language", name="uq_analysis_language_run"),)
    id = Column(String, primary_key=True)
    analysis_run_id = Column(String, ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    language = Column(String(32), nullable=False)
    file_count = Column(Integer, nullable=False)
    lines_of_code = Column(Integer, nullable=False)
    size_bytes = Column(BigInteger, nullable=False)
    percentage = Column(Float, nullable=False)


class RepositoryFunction(Base):
    __tablename__ = "repository_functions"
    __table_args__ = (Index("ix_analysis_function_repo_name", "repository_id", "name"), Index("ix_analysis_function_run_file", "analysis_run_id", "file_path"))
    id = Column(String, primary_key=True)
    analysis_run_id = Column(String, ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path = Column(String(2048), nullable=False)
    module = Column(String(1024), nullable=False)
    class_name = Column(String(255))
    name = Column(String(255), nullable=False)
    qualified_name = Column(String(2048), nullable=False)
    line_number = Column(Integer, nullable=False)
    start_line = Column(Integer, nullable=False)
    end_line = Column(Integer, nullable=False)
    visibility = Column(String(16), nullable=False)
    is_async = Column(Boolean, nullable=False, default=False)
    decorators_json = Column(Text, nullable=False, default="[]")
    parameters_json = Column(Text, nullable=False, default="[]")
    return_type = Column(Text)
    docstring = Column(Text)


class RepositoryClass(Base):
    __tablename__ = "repository_classes"
    __table_args__ = (Index("ix_analysis_class_repo_name", "repository_id", "name"),)
    id = Column(String, primary_key=True)
    analysis_run_id = Column(String, ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path = Column(String(2048), nullable=False)
    module = Column(String(1024), nullable=False)
    name = Column(String(255), nullable=False)
    qualified_name = Column(String(2048), nullable=False)
    line_number = Column(Integer, nullable=False)
    start_line = Column(Integer, nullable=False)
    end_line = Column(Integer, nullable=False)
    visibility = Column(String(16), nullable=False)
    bases_json = Column(Text, nullable=False, default="[]")
    decorators_json = Column(Text, nullable=False, default="[]")
    docstring = Column(Text)


class RepositoryModule(Base):
    __tablename__ = "repository_modules"
    __table_args__ = (UniqueConstraint("analysis_run_id", "name", name="uq_analysis_module_run_name"), Index("ix_analysis_module_repo_name", "repository_id", "name"))
    id = Column(String, primary_key=True)
    analysis_run_id = Column(String, ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path = Column(String(2048), nullable=False)
    name = Column(String(1024), nullable=False)
    package = Column(String(1024))
    is_package = Column(Boolean, nullable=False, default=False)
    docstring = Column(Text)


class RepositoryImport(Base):
    __tablename__ = "repository_imports"
    __table_args__ = (Index("ix_analysis_import_repo_module", "repository_id", "module"), Index("ix_analysis_import_run_file", "analysis_run_id", "file_path"))
    id = Column(String, primary_key=True)
    analysis_run_id = Column(String, ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path = Column(String(2048), nullable=False)
    module = Column(String(1024), nullable=False)
    imported_name = Column(String(1024))
    alias = Column(String(255))
    level = Column(Integer, nullable=False, default=0)
    line_number = Column(Integer, nullable=False)


class RepositoryMetrics(Base):
    __tablename__ = "repository_metrics"
    id = Column(String, primary_key=True)
    analysis_run_id = Column(String, ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False, unique=True)
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    total_files = Column(Integer, nullable=False)
    total_folders = Column(Integer, nullable=False)
    lines_of_code = Column(Integer, nullable=False)
    languages = Column(Integer, nullable=False)
    functions = Column(Integer, nullable=False)
    classes = Column(Integer, nullable=False)
    modules = Column(Integer, nullable=False)
    packages = Column(Integer, nullable=False)
    imports = Column(Integer, nullable=False)
    largest_file_path = Column(String(2048))
    largest_file_size = Column(BigInteger, nullable=False, default=0)
    largest_folder_path = Column(String(2048))
    largest_folder_size = Column(BigInteger, nullable=False, default=0)
