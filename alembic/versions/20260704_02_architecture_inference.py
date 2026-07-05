"""Architecture inference engine.

Revision ID: 20260704_02
Revises: 20260704_01
"""
from alembic import op
import sqlalchemy as sa

revision = "20260704_02"
down_revision = "20260704_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "architecture_builds",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dependency_build_id", sa.String(), sa.ForeignKey("dependencies.id", ondelete="SET NULL")),
        sa.Column("analysis_run_id", sa.String(), sa.ForeignKey("analysis_runs.id", ondelete="SET NULL")),
        sa.Column("requested_by", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("frameworks_json", sa.Text(), nullable=False),
        sa.Column("warnings_json", sa.Text(), nullable=False),
        sa.Column("error_message", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("duration_ms", sa.Integer()),
        sa.CheckConstraint("status IN ('running','completed','completed_with_warnings','failed')", name="ck_architecture_build_status"),
    )
    op.create_index("ix_architecture_builds_repository_id", "architecture_builds", ["repository_id"])
    op.create_index("ix_architecture_builds_dependency_build_id", "architecture_builds", ["dependency_build_id"])
    op.create_index("ix_architecture_builds_analysis_run_id", "architecture_builds", ["analysis_run_id"])
    op.create_index("ix_architecture_builds_repository_created", "architecture_builds", ["repository_id", "created_at"])
    op.create_index("ix_architecture_builds_repository_status", "architecture_builds", ["repository_id", "status"])

    op.create_table(
        "architecture_components",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("architecture_build_id", sa.String(), sa.ForeignKey("architecture_builds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dependency_node_id", sa.String(), sa.ForeignKey("dependency_nodes.id", ondelete="SET NULL")),
        sa.Column("name", sa.String(512), nullable=False),
        sa.Column("component_type", sa.String(64), nullable=False),
        sa.Column("layer", sa.String(64), nullable=False),
        sa.Column("path", sa.String(2048)),
        sa.Column("framework", sa.String(64)),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("metadata_json", sa.Text(), nullable=False),
    )
    op.create_index("ix_architecture_components_architecture_build_id", "architecture_components", ["architecture_build_id"])
    op.create_index("ix_architecture_components_repository_id", "architecture_components", ["repository_id"])
    op.create_index("ix_architecture_components_dependency_node_id", "architecture_components", ["dependency_node_id"])
    op.create_index("ix_architecture_components_build_layer", "architecture_components", ["architecture_build_id", "layer"])
    op.create_index("ix_architecture_components_build_type", "architecture_components", ["architecture_build_id", "component_type"])

    op.create_table(
        "architecture_request_flows",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("architecture_build_id", sa.String(), sa.ForeignKey("architecture_builds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(512), nullable=False),
        sa.Column("entry_component_id", sa.String(), sa.ForeignKey("architecture_components.id", ondelete="SET NULL")),
        sa.Column("component_ids_json", sa.Text(), nullable=False),
        sa.Column("layers_json", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("metadata_json", sa.Text(), nullable=False),
    )
    op.create_index("ix_architecture_request_flows_architecture_build_id", "architecture_request_flows", ["architecture_build_id"])
    op.create_index("ix_architecture_request_flows_repository_id", "architecture_request_flows", ["repository_id"])
    op.create_index("ix_architecture_flows_build", "architecture_request_flows", ["architecture_build_id", "entry_component_id"])

    op.create_table(
        "architecture_metrics",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("architecture_build_id", sa.String(), sa.ForeignKey("architecture_builds.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("layer_count", sa.Integer(), nullable=False),
        sa.Column("layer_coupling", sa.Float(), nullable=False),
        sa.Column("layer_cohesion", sa.Float(), nullable=False),
        sa.Column("service_count", sa.Integer(), nullable=False),
        sa.Column("controller_count", sa.Integer(), nullable=False),
        sa.Column("repository_count", sa.Integer(), nullable=False),
        sa.Column("api_count", sa.Integer(), nullable=False),
        sa.Column("database_count", sa.Integer(), nullable=False),
        sa.Column("architecture_complexity", sa.Float(), nullable=False),
        sa.Column("health_score", sa.Integer(), nullable=False),
    )
    op.create_index("ix_architecture_metrics_repository_id", "architecture_metrics", ["repository_id"])

    op.create_table(
        "architecture_anti_patterns",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("architecture_build_id", sa.String(), sa.ForeignKey("architecture_builds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pattern_type", sa.String(64), nullable=False),
        sa.Column("severity", sa.String(16), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("recommendation", sa.Text(), nullable=False),
        sa.Column("component_id", sa.String(), sa.ForeignKey("architecture_components.id", ondelete="SET NULL")),
        sa.Column("evidence_json", sa.Text(), nullable=False),
    )
    op.create_index("ix_architecture_anti_patterns_architecture_build_id", "architecture_anti_patterns", ["architecture_build_id"])
    op.create_index("ix_architecture_anti_patterns_repository_id", "architecture_anti_patterns", ["repository_id"])
    op.create_index("ix_architecture_antipatterns_build_severity", "architecture_anti_patterns", ["architecture_build_id", "severity"])


def downgrade() -> None:
    op.drop_table("architecture_anti_patterns")
    op.drop_table("architecture_metrics")
    op.drop_table("architecture_request_flows")
    op.drop_table("architecture_components")
    op.drop_table("architecture_builds")
