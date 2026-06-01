"""Repository static analysis engine.

Revision ID: 20260629_02
Revises: 20260629_01
"""
from alembic import op
import sqlalchemy as sa

revision = "20260629_02"
down_revision = "20260629_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "analysis_runs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("requested_by", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("files_discovered", sa.Integer(), nullable=False),
        sa.Column("files_parsed", sa.Integer(), nullable=False),
        sa.Column("errors_count", sa.Integer(), nullable=False),
        sa.Column("warnings_json", sa.Text(), nullable=False),
        sa.Column("error_message", sa.Text()),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("duration_ms", sa.Integer()),
        sa.CheckConstraint("status IN ('pending','running','completed','completed_with_warnings','failed','cancelled')", name="ck_analysis_run_status"),
    )
    op.create_index("ix_analysis_runs_repository_id", "analysis_runs", ["repository_id"])
    op.create_index("ix_analysis_runs_repository_started", "analysis_runs", ["repository_id", "started_at"])

    op.create_table(
        "repository_folders",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("analysis_run_id", sa.String(), sa.ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("path", sa.String(2048), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("depth", sa.Integer(), nullable=False),
        sa.Column("parent_path", sa.String(2048)),
        sa.Column("children_count", sa.Integer(), nullable=False),
        sa.Column("total_files", sa.Integer(), nullable=False),
        sa.Column("total_size_bytes", sa.BigInteger(), nullable=False),
        sa.UniqueConstraint("analysis_run_id", "path", name="uq_analysis_folder_run_path"),
    )
    op.create_index("ix_repository_folders_analysis_run_id", "repository_folders", ["analysis_run_id"])
    op.create_index("ix_repository_folders_repository_id", "repository_folders", ["repository_id"])
    op.create_index("ix_analysis_folder_repo_path", "repository_folders", ["repository_id", "path"])

    op.create_table(
        "repository_files",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("analysis_run_id", sa.String(), sa.ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("folder_path", sa.String(2048)),
        sa.Column("path", sa.String(2048), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("extension", sa.String(32), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("encoding", sa.String(32)),
        sa.Column("language", sa.String(32), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("lines_of_code", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("modified_at", sa.DateTime(timezone=True)),
        sa.Column("parse_status", sa.String(32), nullable=False),
        sa.Column("parse_error", sa.Text()),
        sa.UniqueConstraint("analysis_run_id", "path", name="uq_analysis_file_run_path"),
    )
    op.create_index("ix_repository_files_analysis_run_id", "repository_files", ["analysis_run_id"])
    op.create_index("ix_repository_files_repository_id", "repository_files", ["repository_id"])
    op.create_index("ix_analysis_file_repo_language", "repository_files", ["repository_id", "language"])

    op.create_table(
        "repository_languages",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("analysis_run_id", sa.String(), sa.ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("language", sa.String(32), nullable=False),
        sa.Column("file_count", sa.Integer(), nullable=False),
        sa.Column("lines_of_code", sa.Integer(), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("percentage", sa.Float(), nullable=False),
        sa.UniqueConstraint("analysis_run_id", "language", name="uq_analysis_language_run"),
    )
    op.create_index("ix_repository_languages_analysis_run_id", "repository_languages", ["analysis_run_id"])
    op.create_index("ix_repository_languages_repository_id", "repository_languages", ["repository_id"])

    op.create_table(
        "repository_functions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("analysis_run_id", sa.String(), sa.ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_path", sa.String(2048), nullable=False),
        sa.Column("module", sa.String(1024), nullable=False),
        sa.Column("class_name", sa.String(255)),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("qualified_name", sa.String(2048), nullable=False),
        sa.Column("line_number", sa.Integer(), nullable=False),
        sa.Column("start_line", sa.Integer(), nullable=False),
        sa.Column("end_line", sa.Integer(), nullable=False),
        sa.Column("visibility", sa.String(16), nullable=False),
        sa.Column("is_async", sa.Boolean(), nullable=False),
        sa.Column("decorators_json", sa.Text(), nullable=False),
        sa.Column("parameters_json", sa.Text(), nullable=False),
        sa.Column("return_type", sa.Text()),
        sa.Column("docstring", sa.Text()),
    )
    op.create_index("ix_repository_functions_analysis_run_id", "repository_functions", ["analysis_run_id"])
    op.create_index("ix_repository_functions_repository_id", "repository_functions", ["repository_id"])
    op.create_index("ix_analysis_function_repo_name", "repository_functions", ["repository_id", "name"])
    op.create_index("ix_analysis_function_run_file", "repository_functions", ["analysis_run_id", "file_path"])

    op.create_table(
        "repository_classes",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("analysis_run_id", sa.String(), sa.ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_path", sa.String(2048), nullable=False),
        sa.Column("module", sa.String(1024), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("qualified_name", sa.String(2048), nullable=False),
        sa.Column("line_number", sa.Integer(), nullable=False),
        sa.Column("start_line", sa.Integer(), nullable=False),
        sa.Column("end_line", sa.Integer(), nullable=False),
        sa.Column("visibility", sa.String(16), nullable=False),
        sa.Column("bases_json", sa.Text(), nullable=False),
        sa.Column("decorators_json", sa.Text(), nullable=False),
        sa.Column("docstring", sa.Text()),
    )
    op.create_index("ix_repository_classes_analysis_run_id", "repository_classes", ["analysis_run_id"])
    op.create_index("ix_repository_classes_repository_id", "repository_classes", ["repository_id"])
    op.create_index("ix_analysis_class_repo_name", "repository_classes", ["repository_id", "name"])

    op.create_table(
        "repository_modules",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("analysis_run_id", sa.String(), sa.ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_path", sa.String(2048), nullable=False),
        sa.Column("name", sa.String(1024), nullable=False),
        sa.Column("package", sa.String(1024)),
        sa.Column("is_package", sa.Boolean(), nullable=False),
        sa.Column("docstring", sa.Text()),
        sa.UniqueConstraint("analysis_run_id", "name", name="uq_analysis_module_run_name"),
    )
    op.create_index("ix_repository_modules_analysis_run_id", "repository_modules", ["analysis_run_id"])
    op.create_index("ix_repository_modules_repository_id", "repository_modules", ["repository_id"])
    op.create_index("ix_analysis_module_repo_name", "repository_modules", ["repository_id", "name"])

    op.create_table(
        "repository_imports",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("analysis_run_id", sa.String(), sa.ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_path", sa.String(2048), nullable=False),
        sa.Column("module", sa.String(1024), nullable=False),
        sa.Column("imported_name", sa.String(1024)),
        sa.Column("alias", sa.String(255)),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("line_number", sa.Integer(), nullable=False),
    )
    op.create_index("ix_repository_imports_analysis_run_id", "repository_imports", ["analysis_run_id"])
    op.create_index("ix_repository_imports_repository_id", "repository_imports", ["repository_id"])
    op.create_index("ix_analysis_import_repo_module", "repository_imports", ["repository_id", "module"])
    op.create_index("ix_analysis_import_run_file", "repository_imports", ["analysis_run_id", "file_path"])

    op.create_table(
        "repository_metrics",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("analysis_run_id", sa.String(), sa.ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("total_files", sa.Integer(), nullable=False),
        sa.Column("total_folders", sa.Integer(), nullable=False),
        sa.Column("lines_of_code", sa.Integer(), nullable=False),
        sa.Column("languages", sa.Integer(), nullable=False),
        sa.Column("functions", sa.Integer(), nullable=False),
        sa.Column("classes", sa.Integer(), nullable=False),
        sa.Column("modules", sa.Integer(), nullable=False),
        sa.Column("packages", sa.Integer(), nullable=False),
        sa.Column("imports", sa.Integer(), nullable=False),
        sa.Column("largest_file_path", sa.String(2048)),
        sa.Column("largest_file_size", sa.BigInteger(), nullable=False),
        sa.Column("largest_folder_path", sa.String(2048)),
        sa.Column("largest_folder_size", sa.BigInteger(), nullable=False),
    )
    op.create_index("ix_repository_metrics_repository_id", "repository_metrics", ["repository_id"])


def downgrade() -> None:
    for table in (
        "repository_metrics",
        "repository_imports",
        "repository_modules",
        "repository_classes",
        "repository_functions",
        "repository_languages",
        "repository_files",
        "repository_folders",
        "analysis_runs",
    ):
        op.drop_table(table)
