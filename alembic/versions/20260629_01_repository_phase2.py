"""Repository management and upload engine.

Revision ID: 20260629_01
Revises: None
"""
from alembic import op
import sqlalchemy as sa

revision = "20260629_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The prototype predates Alembic. Existing core tables are adopted; this
    # migration defines the Phase 2 repository-owned tables for PostgreSQL.
    op.create_table("repositories",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("workspace_id", sa.String(), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("owner_id", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("name", sa.String(120), nullable=False), sa.Column("description", sa.Text()),
        sa.Column("repo_type", sa.String(16), nullable=False), sa.Column("status", sa.String(16), nullable=False),
        sa.Column("visibility", sa.String(16), nullable=False), sa.Column("git_url", sa.String(2048)),
        sa.Column("git_branch", sa.String(255)), sa.Column("upload_path", sa.String(2048)),
        sa.Column("extracted_path", sa.String(2048)), sa.Column("original_filename", sa.String(255)),
        sa.Column("file_size_bytes", sa.BigInteger()), sa.Column("language", sa.String(64)), sa.Column("notes", sa.Text()),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("project_id", "name", name="uq_repository_project_name"),
    )
    op.create_index("ix_repositories_project_status", "repositories", ["project_id", "status"])
    op.create_index("ix_repositories_workspace_updated", "repositories", ["workspace_id", "updated_at"])
    op.create_table("repository_metadata", sa.Column("id", sa.String(), primary_key=True), sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), unique=True, nullable=False), sa.Column("total_files", sa.Integer(), nullable=False), sa.Column("total_folders", sa.Integer(), nullable=False), sa.Column("extracted_size_bytes", sa.BigInteger(), nullable=False), sa.Column("archive_sha256", sa.String(64)), sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False))
    op.create_table("repository_settings", sa.Column("id", sa.String(), primary_key=True), sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), unique=True, nullable=False), sa.Column("auto_analyze", sa.Boolean(), nullable=False), sa.Column("notify_on_change", sa.Boolean(), nullable=False), sa.Column("default_branch", sa.String(255), nullable=False), sa.Column("analysis_depth", sa.String(16), nullable=False))
    op.create_table("repository_tags", sa.Column("id", sa.String(), primary_key=True), sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False), sa.Column("name", sa.String(64), nullable=False), sa.UniqueConstraint("repository_id", "name", name="uq_repository_tag_name"))
    op.create_table("repository_favorites", sa.Column("id", sa.String(), primary_key=True), sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("user_id", "repository_id", name="uq_repository_favorite"))
    op.create_table("repository_activity", sa.Column("id", sa.String(), primary_key=True), sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False), sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL")), sa.Column("action", sa.String(80), nullable=False), sa.Column("details", sa.Text()), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_table("repository_uploads", sa.Column("id", sa.String(), primary_key=True), sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False), sa.Column("uploaded_by", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL")), sa.Column("filename", sa.String(255), nullable=False), sa.Column("storage_path", sa.String(2048)), sa.Column("file_size_bytes", sa.BigInteger()), sa.Column("sha256", sa.String(64)), sa.Column("status", sa.String(16), nullable=False), sa.Column("error_message", sa.Text()), sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False))


def downgrade() -> None:
    for table in ("repository_uploads", "repository_activity", "repository_favorites", "repository_tags", "repository_settings", "repository_metadata", "repositories"):
        op.drop_table(table)
