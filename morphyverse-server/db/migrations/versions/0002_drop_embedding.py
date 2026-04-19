"""drop embedding column from objects

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-19 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("objects") as batch_op:
        batch_op.drop_column("embedding")


def downgrade() -> None:
    import sqlalchemy as sa
    with op.batch_alter_table("objects") as batch_op:
        batch_op.add_column(sa.Column("embedding", sa.Text(), nullable=True))
