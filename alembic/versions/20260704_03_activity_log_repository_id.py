"""Add repository id to activity logs.

Revision ID: 20260704_03
Revises: 20260704_02
"""
from alembic import op
import sqlalchemy as sa

revision = "20260704_03"
down_revision = "20260704_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("activity_logs", sa.Column("repository_id", sa.String(), sa.ForeignKey("repositories.id", ondelete="SET NULL"), nullable=True))
    op.create_index("ix_activity_logs_repository_id", "activity_logs", ["repository_id"])


def downgrade() -> None:
    op.drop_index("ix_activity_logs_repository_id", table_name="activity_logs")
    op.drop_column("activity_logs", "repository_id")
