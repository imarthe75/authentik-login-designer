import uuid
from sqlalchemy import String, Text, CheckConstraint, UniqueConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

EMAIL_EVENT_TYPES = frozenset(
    ['password_reset', 'new_account', 'account_lockout', 'email_verification', 'security_change',
     'account_locked_admin', 'account_unlocked_admin',
     'login_success', 'suspicious_request', 'invitation_used', 'app_authorized',
     'impersonation_started', 'account_deleted']
)


class TenantEmailBody(Base):
    """
    Representa el cuerpo y asunto personalizado de un correo electrónico
    asociado a un evento de autenticación (ej: restablecer contraseña, nueva cuenta)
    para un flujo específico de un tenant en Authentik.

    Tabla compartida con authentik-login-manager (misma DB física) — ese
    backend ya creó la columna `tenant_id` (NOT NULL, FK a tenants.id) y la
    constraint única real es (tenant_id, flow_slug, event_type), no
    (flow_slug, event_type). Este modelo no la declaraba, así que cualquier
    INSERT/UPDATE vía el ORM de este backend violaba el NOT NULL de la
    columna real — bug activo, no solo una brecha de features. Se ancla
    siempre a settings.DEFAULT_TENANT_ID (este backend es single-tenant).
    """
    __tablename__ = "tenant_email_bodies"
    __table_args__ = (
        UniqueConstraint('tenant_id', 'flow_slug', 'event_type', name='uq_email_bodies_tenant_flow_event'),
        CheckConstraint(
            "event_type IN ('password_reset','new_account','account_lockout',"
            "'email_verification','security_change','account_locked_admin',"
            "'account_unlocked_admin','login_success','suspicious_request',"
            "'invitation_used','app_authorized','impersonation_started',"
            "'account_deleted')",
            name='ck_email_bodies_event_type'
        ),
    )

    # Identificador único de la plantilla de correo
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey('tenants.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )
    # Slug del flujo de Authentik al que pertenece
    flow_slug: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    # Tipo de evento de correo (ej: password_reset)
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # Asunto del correo electrónico
    subject: Mapped[str] = mapped_column(String(200), nullable=False, default='')
    # Cuerpo del correo electrónico en formato HTML/Jinja2
    body_html: Mapped[str] = mapped_column(Text, nullable=False, default='')
