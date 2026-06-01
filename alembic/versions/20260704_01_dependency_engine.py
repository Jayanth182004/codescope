"""Dependency extraction engine.

Revision ID: 20260704_01
Revises: 20260629_02
"""
from alembic import op
import sqlalchemy as sa

revision = "20260704_01"
down_revision = "20260629_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "dependencies",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("analysis_run_id", sa.String(), sa.ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("requested_by", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("nodes_count", sa.Integer(), nullable=False),
        sa.Column("edges_count", sa.Integer(), nullable=False),
        sa.Column("cycles_count", sa.Integer(), nullable=False),
        sa.Column("warnings_json", sa.Text(), nullable=False),
        sa.Column("error_message", sa.Text()),
        sa.Column("built_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("duration_ms", sa.Integer()),
        sa.CheckConstraint("status IN ('running','completed','completed_with_warnings','failed')", name="ck_dependency_build_status"),
        sa.UniqueConstraint("repository_id", "analysis_run_id", name="uq_dependency_repository_analysis"),
    )
    op.create_index("ix_dependencies_repository_id", "dependencies", ["repository_id"])
    op.create_index("ix_dependencies_analysis_run_id", "dependencies", ["analysis_run_id"])
    op.create_index("ix_dependencies_repository_built", "dependencies", ["repository_id", "built_at"])

    op.create_table(
        "dependency_nodes",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("dependency_id", sa.String(), sa.ForeignKey("dependencies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("analysis_run_id", sa.String(), sa.ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("entity_type", sa.String(32), nullable=False),
        sa.Column("entity_key", sa.String(2048), nullable=False),
        sa.Column("name", sa.String(512), nullable=False),
        sa.Column("label", sa.String(1024), nullable=False),
        sa.Column("file_path", sa.String(2048)),
        sa.Column("module", sa.String(1024)),
        sa.Column("package", sa.String(1024)),
        sa.Column("source_entity_id", sa.String(128)),
        sa.Column("metadata_json", sa.Text(), nullable=False),
        sa.UniqueConstraint("dependency_id", "entity_type", "entity_key", name="uq_dependency_node_entity"),
    )
    op.create_index("ix_dependency_nodes_dependency_id", "dependency_nodes", ["dependency_id"])
    op.create_index("ix_dependency_nodes_repository_id", "dependency_nodes", ["repository_id"])
    op.create_index("ix_dependency_nodes_analysis_run_id", "dependency_nodes", ["analysis_run_id"])
    op.create_index("ix_dependency_nodes_repo_type", "dependency_nodes", ["repository_id", "entity_type"])
    op.create_index("ix_dependency_nodes_key", "dependency_nodes", ["entity_key"])

    op.create_table(
        "dependency_edges",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("dependency_id", sa.String(), sa.ForeignKey("dependencies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("analysis_run_id", sa.String(), sa.ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_node_id", sa.String(), sa.ForeignKey("dependency_nodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_node_id", sa.String(), sa.ForeignKey("dependency_nodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("relationship_type", sa.String(48), nullable=False),
        sa.Column("source_type", sa.String(32), nullable=False),
        sa.Column("target_type", sa.String(32), nullable=False),
        sa.Column("depth", sa.Integer(), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False),
        sa.Column("metadata_json", sa.Text(), nullable=False),
        sa.UniqueConstraint("dependency_id", "source_node_id", "target_node_id", "relationship_type", name="uq_dependency_edge"),
    )
    op.create_index("ix_dependency_edges_dependency_id", "dependency_edges", ["dependency_id"])
    op.create_index("ix_dependency_edges_repository_id", "dependency_edges", ["repository_id"])
    op.create_index("ix_dependency_edges_analysis_run_id", "dependency_edges", ["analysis_run_id"])
    op.create_index("ix_dependency_edges_repo_type", "dependency_edges", ["repository_id", "relationship_type"])
    op.create_index("ix_dependency_edges_source", "dependency_edges", ["source_node_id"])
    op.create_index("ix_dependency_edges_target", "dependency_edges", ["target_node_id"])

    op.create_table(
        "dependency_metrics",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("dependency_id", sa.String(), sa.ForeignKey("dependencies.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("analysis_run_id", sa.String(), sa.ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("total_nodes", sa.Integer(), nullable=False),
        sa.Column("total_edges", sa.Integer(), nullable=False),
        sa.Column("incoming_dependency_count", sa.Integer(), nullable=False),
        sa.Column("outgoing_dependency_count", sa.Integer(), nullable=False),
        sa.Column("fan_in", sa.Integer(), nullable=False),
        sa.Column("fan_out", sa.Integer(), nullable=False),
        sa.Column("dependency_depth", sa.Integer(), nullable=False),
        sa.Column("dependency_density", sa.Float(), nullable=False),
        sa.Column("most_referenced_file_node_id", sa.String()),
        sa.Column("most_referenced_file", sa.String(2048)),
        sa.Column("most_referenced_function_node_id", sa.String()),
        sa.Column("most_referenced_function", sa.String(2048)),
        sa.Column("unused_files", sa.Integer(), nullable=False),
        sa.Column("unused_functions", sa.Integer(), nullable=False),
    )
    op.create_index("ix_dependency_metrics_repository_id", "dependency_metrics", ["repository_id"])
    op.create_index("ix_dependency_metrics_analysis_run_id", "dependency_metrics", ["analysis_run_id"])

    op.create_table(
        "dependency_cycles",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("dependency_id", sa.String(), sa.ForeignKey("dependencies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("analysis_run_id", sa.String(), sa.ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cycle_type", sa.String(32), nullable=False),
        sa.Column("node_ids_json", sa.Text(), nullable=False),
        sa.Column("edge_ids_json", sa.Text(), nullable=False),
        sa.Column("length", sa.Integer(), nullable=False),
        sa.Column("severity", sa.String(16), nullable=False),
    )
    op.create_index("ix_dependency_cycles_dependency_id", "dependency_cycles", ["dependency_id"])
    op.create_index("ix_dependency_cycles_repository_id", "dependency_cycles", ["repository_id"])
    op.create_index("ix_dependency_cycles_analysis_run_id", "dependency_cycles", ["analysis_run_id"])
    op.create_index("ix_dependency_cycles_repo_type", "dependency_cycles", ["repository_id", "cycle_type"])


def downgrade() -> None:
    for table in ("dependency_cycles", "dependency_metrics", "dependency_edges", "dependency_nodes", "dependencies"):
        op.drop_table(table)
