import uuid
from datetime import datetime
from sqlalchemy import String, Text, Boolean, DateTime, JSON, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Tenant(Base):
    """Mapea la tabla `tenants` — compartida con authentik-login-manager
    (misma base de datos física, creada por su migración 011_add_tenants).
    Este backend es single-tenant por diseño (ver settings.DEFAULT_TENANT_ID),
    así que solo lee esta tabla; no gestiona su ciclo de vida."""
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(
        String(150), unique=True, nullable=False, index=True
    )
    domain_pattern: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    logo_email_base64: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    primary_color: Mapped[str] = mapped_column(
        String(7), default="#4272A5", nullable=False
    )
    secondary_color: Mapped[str] = mapped_column(
        String(7), default="#2d5580", nullable=False
    )
    config: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, server_default='{}'
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )
