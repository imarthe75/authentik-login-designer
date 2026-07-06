import uuid
from sqlalchemy import String, Text, CheckConstraint, UniqueConstraint
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
    """
    __tablename__ = "tenant_email_bodies"
    __table_args__ = (
        UniqueConstraint('flow_slug', 'event_type', name='uq_email_bodies_flow_event'),
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
    # Slug del flujo de Authentik al que pertenece
    flow_slug: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    # Tipo de evento de correo (ej: password_reset)
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # Asunto del correo electrónico
    subject: Mapped[str] = mapped_column(String(200), nullable=False, default='')
    # Cuerpo del correo electrónico en formato HTML/Jinja2
    body_html: Mapped[str] = mapped_column(Text, nullable=False, default='')
