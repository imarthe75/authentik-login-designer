"""Add show_app_message flag to control visibility of app name in Authentik consent page

Revision ID: 009_add_show_app_message
Revises: 008_add_ui_visibility_flags
Create Date: 2026-06-26
"""
from alembic import op
import sqlalchemy as sa


revision = '009_add_show_app_message'
down_revision = '008_add_ui_visibility_flags'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'tenant_themes',
        sa.Column(
            'show_app_message',
            sa.Boolean(),
            server_default='true',
            nullable=False
        )
    )


def downgrade():
    op.drop_column('tenant_themes', 'show_app_message')
