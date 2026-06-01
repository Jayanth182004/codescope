"""Create graph sync runs table.

Revision ID: 20260704_04
Revises: 20260704_03
"""
from alembic import op
import sqlalchemy as sa

revision = "20260704_04"
down_revision = "20260704_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "graph_sync_runs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dependency_build_id", sa.String(), sa.ForeignKey("dependencies.id", ondelete="SET NULL")),
        sa.Column("analysis_run_id", sa.String(), sa.ForeignKey("analysis_runs.id", ondelete="SET NULL")),
        sa.Column("requested_by", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("trigger", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("nodes_synced", sa.Integer(), nullable=False),
        sa.Column("edges_synced", sa.Integer(), nullable=False),
        sa.Column("nodes_pruned", sa.Integer(), nullable=False),
        sa.Column("error_message", sa.Text()),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("duration_ms", sa.Integer()),
        sa.CheckConstraint("status IN ('running','completed','completed_stale','failed')", name="ck_graph_sync_run_status"),
        sa.CheckConstraint("trigger IN ('dependency_build','manual')", name="ck_graph_sync_run_trigger"),
    )
    op.create_index("ix_graph_sync_runs_repository_id", "graph_sync_runs", ["repository_id"])
    op.create_index("ix_graph_sync_runs_dependency_build_id", "graph_sync_runs", ["dependency_build_id"])
    op.create_index("ix_graph_sync_runs_analysis_run_id", "graph_sync_runs", ["analysis_run_id"])
    op.create_index("ix_graph_sync_runs_repository_started", "graph_sync_runs", ["repository_id", "started_at"])
    op.create_index("ix_graph_sync_runs_repository_status", "graph_sync_runs", ["repository_id", "status"])


def downgrade() -> None:
    op.drop_table("graph_sync_runs")
