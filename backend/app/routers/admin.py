import logging
import re
import secrets
import ssl
import smtplib
import base64
import httpx
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from typing import List, Optional, Dict
import uuid
from pathlib import Path
from types import SimpleNamespace
from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, status, Query, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, field_validator
from jinja2 import Environment, FileSystemLoader
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.future import select
from app.database import get_db
from app.config import settings
from app.models.tenant_theme import TenantTheme
from app.utils.session import verify_session_token
from app.models.email_body import TenantEmailBody, EMAIL_EVENT_TYPES
from app.schemas.theme import (
    ThemeCreate, ThemeUpdate, ThemeUpdateWithEmail,
    ThemeResponse, ThemeResponseWithEmail, EmailBodySchema
)
from app.cache import cache

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/themes", tags=["Admin Themes"])

authentik_engine = create_async_engine(
    settings.DATABASE_URL.rsplit('/', 1)[0] + "/authentik",
    echo=False,
    pool_pre_ping=True
)


ADMIN_KEY_RATE_LIMIT = 20       # intentos permitidos
ADMIN_KEY_RATE_WINDOW = 300     # por ventana de 5 minutos, por IP


def _is_trusted_proxy_peer(request: Request) -> bool:
    """
    Verifica si el origen de la conexión TCP inmediata proviene del gateway de confianza.
    Previene la suplantación (spoofing) de la cabecera X-Real-IP por contenedores no autorizados.
    """
    if not request.client:
        return False
    try:
        import socket
        trusted_ip = socket.gethostbyname("casmarts-core-gateway")
    except socket.gaierror:
        return True
    return request.client.host == trusted_ip


def _admin_rate_limit_client_ip(request: Request) -> str:
    # request.client.host es siempre la IP del gateway, no la del navegador
    # real — sin esto, el rate limit se comparte entre todos los usuarios.
    client_ip = request.client.host if request.client else "unknown"
    if _is_trusted_proxy_peer(request):
        client_ip = request.headers.get("X-Real-IP", client_ip)
    return client_ip


async def _register_failed_admin_key_attempt(client_ip: str) -> None:
    # Solo los INTENTOS FALLIDOS cuentan para el límite (ver nota de tokens)
    rate_key = f"ratelimit:admin_key:{client_ip}"
    attempts = await cache.incr_with_ttl(rate_key, ADMIN_KEY_RATE_WINDOW)
    if attempts is not None and attempts > ADMIN_KEY_RATE_LIMIT:
        log.warning("Rate limit exceeded for X-Admin-Key from IP %s (%s attempts fallidos)", client_ip, attempts)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many authentication attempts. Try again later."
        )


async def verify_admin_key(
    request: Request,
    x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key"),
    admin_session: Optional[str] = Cookie(None),
):
    """
    Modelo actual (2026-07-06): el navegador nunca conoce ADMIN_API_KEY.
    /api/v1/auth/login la valida una vez y emite una cookie de sesión
    HttpOnly firmada (ver app/utils/session.py); el frontend deja de
    embeber la clave en el bundle (environment.ts `adminKey`, hoy eliminado)
    — antes cualquier visitante podía leerla en el JS compilado y llamar
    directamente estos endpoints sin pasar por la UI, con la clave hardcodeada
    y jamás rotada desde el primer commit del repo.
    X-Admin-Key sigue soportado para automatización server-to-server
    (scripts, curl) que nunca corre en un navegador.
    """
    if admin_session and verify_session_token(admin_session, settings.SESSION_SECRET):
        return

    client_ip = _admin_rate_limit_client_ip(request)

    if x_admin_key is not None:
        # Comparación constant-time: evita filtrar la clave por diferencias de tiempo.
        if secrets.compare_digest(x_admin_key, settings.ADMIN_API_KEY):
            return  # clave correcta: no consume el cupo de fuerza bruta
        await _register_failed_admin_key_attempt(client_ip)
        log.warning("Invalid X-Admin-Key attempt from IP %s", client_ip)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid administrative credentials."
    )


# ── helpers ─────────────────────────────────────────────────────────────────

async def _load_email_bodies(flow_slug: str, db: AsyncSession) -> Dict[str, EmailBodySchema]:
    """
    Carga todos los cuerpos de correo electrónico personalizados guardados para un flujo específico de tenant.
    """
    result = await db.execute(
        select(TenantEmailBody).where(TenantEmailBody.flow_slug == flow_slug)
    )
    return {
        eb.event_type: EmailBodySchema(subject=eb.subject, body_html=eb.body_html)
        for eb in result.scalars().all()
    }


async def _upsert_email_bodies(
    flow_slug: str,
    bodies: Dict[str, EmailBodySchema],
    db: AsyncSession
) -> None:
    """
    Inserta o actualiza masivamente los cuerpos de correo de eventos asociados a un flujo de tenant.
    """
    for event_type, body in bodies.items():
        if event_type not in EMAIL_EVENT_TYPES:
            continue
        result = await db.execute(
            select(TenantEmailBody).where(
                TenantEmailBody.flow_slug == flow_slug,
                TenantEmailBody.event_type == event_type
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.subject = body.subject
            existing.body_html = body.body_html
            db.add(existing)
        else:
            db.add(TenantEmailBody(
                flow_slug=flow_slug,
                event_type=event_type,
                subject=body.subject,
                body_html=body.body_html
            ))


def _build_theme_response_with_email(
    db_theme: TenantTheme, email_bodies: Dict[str, EmailBodySchema]
) -> ThemeResponseWithEmail:
    """
    Construye el esquema de respuesta que asocia la configuración del tema con los cuerpos de correo.
    """
    data = {c.name: getattr(db_theme, c.name) for c in db_theme.__table__.columns}
    return ThemeResponseWithEmail(**data, email_bodies=email_bodies)


async def _update_authentik_scope_descriptions(expansion_config: Optional[dict]) -> None:
    """
    Actualiza las descripciones de scopes personalizadas en la base de datos de Authentik
    si se proporciona una configuración de consentimiento en la expansión.
    """
    if not expansion_config or not isinstance(expansion_config, dict):
        return
    custom_scope_desc = expansion_config.get("consentStage", {}).get("customScopeDescriptions")
    if not custom_scope_desc or not isinstance(custom_scope_desc, dict):
        return
    try:
        async with authentik_engine.begin() as conn:
            for scope, desc in custom_scope_desc.items():
                if scope and desc:
                    await conn.execute(
                        text("UPDATE authentik_providers_oauth2_scopemapping SET description = :desc WHERE scope_name = :scope"),
                        {"desc": str(desc), "scope": str(scope)}
                    )
    except Exception as e:
        log.error(f"Error updating Authentik scope descriptions: {e}")



# ── endpoints ────────────────────────────────────────────────────────────────

from app.models.tenant import Tenant


@router.get("/authentik/applications", dependencies=[Depends(verify_admin_key)])
async def list_authentik_applications(
    request: Request,
    tenant_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    try:
        tenant = None
        if tenant_id:
            r = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
            tenant = r.scalar_one_or_none()
            
        async with authentik_engine.connect() as conn:
            result = await conn.execute(
                text("SELECT slug, name FROM authentik_core_application ORDER BY name;")
            )
            apps = [{"slug": row[0], "name": row[1]} for row in result.fetchall()]
            
        if not tenant:
            return apps
            
        domain = (tenant.domain_pattern or "").lower()
        name = (tenant.name or "").lower()
        
        if "usana" in domain or "usana" in name:
            return [app for app in apps if "usana" in app["slug"].lower() or "usana" in app["name"].lower()]
        else:
            return [app for app in apps if "usana" not in app["slug"].lower() and "usana" not in app["name"].lower()]
    except Exception as e:
        log.error(f"Error listing filtered apps: {e}")
        return []


@router.get("", response_model=List[ThemeResponse], dependencies=[Depends(verify_admin_key)])
async def list_themes(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(TenantTheme)
        .order_by(TenantTheme.updated_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("", response_model=ThemeResponseWithEmail, dependencies=[Depends(verify_admin_key)])
async def upsert_theme(theme_in: ThemeCreate, db: AsyncSession = Depends(get_db)):
    if theme_in.authentik_app_slug:
        stmt = select(TenantTheme).where(
            TenantTheme.authentik_flow_slug == theme_in.authentik_flow_slug,
            TenantTheme.authentik_app_slug == theme_in.authentik_app_slug
        )
    else:
        stmt = select(TenantTheme).where(
            TenantTheme.authentik_flow_slug == theme_in.authentik_flow_slug,
            TenantTheme.authentik_app_slug.is_(None)
        )

    result = await db.execute(stmt)
    existing_theme = result.scalar_one_or_none()

    if existing_theme:
        for field, value in theme_in.model_dump().items():
            setattr(existing_theme, field, value)
        db.add(existing_theme)
        db_theme = existing_theme
    else:
        db_theme = TenantTheme(tenant_id=settings.DEFAULT_TENANT_ID, **theme_in.model_dump())
        db.add(db_theme)

    await db.flush()
    await db.commit()
    await db.refresh(db_theme)

    await _update_authentik_scope_descriptions(db_theme.expansion_config)

    await cache.delete(f"theme:{db_theme.authentik_flow_slug}:global")
    if db_theme.authentik_app_slug:
        await cache.delete(f"theme:{db_theme.authentik_flow_slug}:{db_theme.authentik_app_slug}")
    if cache.redis:
        try:
            keys = await cache.redis.keys(f"theme:{db_theme.authentik_flow_slug}:*")
            if keys:
                await cache.redis.delete(*keys)
        except Exception:
            pass

    email_bodies = await _load_email_bodies(db_theme.authentik_flow_slug, db)
    return _build_theme_response_with_email(db_theme, email_bodies)


def _strip_html_tags(text: str) -> str:
    return re.sub(r'<[^>]+>', ' ', text or '').strip()


@router.get("/{flow_slug}/emails/preview/{event_type}", dependencies=[Depends(verify_admin_key)])
async def preview_email(
    flow_slug: str,
    event_type: str,
    app_slug: Optional[str] = Query(None),
    username: Optional[str] = Query(None),
    user_email: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    if event_type not in EMAIL_EVENT_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid event_type. Must be one of: {sorted(EMAIL_EVENT_TYPES)}"
        )

    # Intentar tema específico de la app; si no existe, caer al global
    theme = None
    if app_slug:
        result = await db.execute(
            select(TenantTheme).where(
                TenantTheme.authentik_flow_slug == flow_slug,
                TenantTheme.authentik_app_slug == app_slug
            )
        )
        theme = result.scalar_one_or_none()

    if theme is None:
        result = await db.execute(
            select(TenantTheme).where(
                TenantTheme.authentik_flow_slug == flow_slug,
                TenantTheme.authentik_app_slug.is_(None)
            )
        )
        theme = result.scalar_one_or_none()

    if not theme:
        raise HTTPException(status_code=404, detail=f"Theme not found for flow '{flow_slug}'.")

    eb_result = await db.execute(
        select(TenantEmailBody).where(
            TenantEmailBody.flow_slug == flow_slug,
            TenantEmailBody.event_type == event_type
        )
    )
    email_body = eb_result.scalar_one_or_none()
    # Raw body from DB (may be empty — template provides defaults in that case)
    body_html = email_body.body_html if email_body else ''
    subject = email_body.subject if email_body else ''

    # Nombre legible del tenant: strip HTML de system_name ("CASMARTS<br>Core" → "CASMARTS Core")
    tenant_name = _strip_html_tags(theme.system_name) or theme.display_name or 'CASMARTS'

    # Logos para correos: usar base64 directamente (garantiza que funcione en todos los clientes de correo)
    # No usar URLs públicas para correos — pueden no ser accesibles desde servidores SMTP
    logo_url: Optional[str] = None
    logo_base64: Optional[str] = None
    if theme.logo_top_base64:
        logo_base64 = theme.logo_top_base64
        if logo_base64 and len(logo_base64.encode()) > 200 * 1024:
            log.warning("logo_top_base64 >200 KB para flow '%s' — omitiendo del correo.", flow_slug)
            logo_base64 = None

    # Logo inferior: misma lógica
    logo_bottom_url: Optional[str] = None
    logo_bottom_base64: Optional[str] = None
    if theme.logo_bottom_base64:
        logo_bottom_base64 = theme.logo_bottom_base64
        if logo_bottom_base64 and len(logo_bottom_base64.encode()) > 200 * 1024:
            log.warning("logo_bottom_base64 >200 KB para flow '%s' — omitiendo del correo.", flow_slug)
            logo_bottom_base64 = None

    # Determinar el flow correcto según el evento
    flow_map = {
        'password_reset': 'password-recovery',
        'email_verification': 'default-source-enrollment',
        'new_account': 'password-recovery',
        'account_lockout': 'default-authentication-flow',
        'security_change': 'default-user-settings-flow',
        'account_locked_admin': 'default-authentication-flow',
        'account_unlocked_admin': 'default-authentication-flow',
        'login_success': 'default-authentication-flow',
        'suspicious_request': 'default-authentication-flow',
        'invitation_used': 'default-authentication-flow',
        'app_authorized': 'default-authentication-flow',
        'impersonation_started': 'default-user-settings-flow',
        'account_deleted': 'default-authentication-flow',
    }
    flow_slug = flow_map.get(event_type, 'default-authentication-flow')
    cta_url = f'https://auth.casmart.internal/if/flow/{flow_slug}/'

    # 1. Renderizar el template PRIMERO (el body por defecto puede contener variables Authentik)
    env = _build_email_jinja2_env()
    template = env.get_template(f'{event_type}.html.j2')
    html = template.render(
        theme=theme,
        body_html=body_html,
        subject=subject,
        logo_base64=logo_base64,
        logo_url=logo_url,
        logo_bottom_base64=logo_bottom_base64,
        logo_bottom_url=logo_bottom_url,
        event_type=event_type,
        cta_url=cta_url,
        tenant_name=tenant_name,
    )

    # 2. DESPUÉS sustituir variables Authentik en el HTML completo renderizado
    preview_subs = {
        '{{ url }}': cta_url,
        '{{ user.username }}': username or 'usuario.ejemplo',
        '{{ user.email }}': user_email or 'usuario@casmarts.internal',
        '{{ token }}': 'TOK-PREVIEW-12345',
        '{{ tenant.name }}': tenant_name,
    }
    for var, val in preview_subs.items():
        html = html.replace(var, val)

    return HTMLResponse(content=html)


@router.get("/{flow_slug}/emails/default-body/{event_type}", dependencies=[Depends(verify_admin_key)])
async def get_default_email_body(
    flow_slug: str,
    event_type: str,
    app_slug: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Devuelve el asunto y cuerpo HTML por defecto (definidos en el .j2 del evento)
    ya renderizados — para precargar el editor cuando el tenant aún no ha
    personalizado ese evento. Las variables {{ }} se dejan literales a propósito
    (se sustituyen en preview/envío), solo se resuelven las [[ ]] de Jinja real.
    """
    if event_type not in EMAIL_EVENT_TYPES:
        raise HTTPException(status_code=422, detail=f"Invalid event_type. Must be one of: {sorted(EMAIL_EVENT_TYPES)}")

    theme = None
    if app_slug:
        result = await db.execute(select(TenantTheme).where(
            TenantTheme.authentik_flow_slug == flow_slug,
            TenantTheme.authentik_app_slug == app_slug
        ))
        theme = result.scalar_one_or_none()
    if theme is None:
        result = await db.execute(select(TenantTheme).where(
            TenantTheme.authentik_flow_slug == flow_slug,
            TenantTheme.authentik_app_slug.is_(None)
        ))
        theme = result.scalar_one_or_none()
    if not theme:
        raise HTTPException(status_code=404, detail=f"Theme not found for flow '{flow_slug}'.")

    tenant_name = _strip_html_tags(theme.system_name) or theme.display_name or 'CASMARTS'

    env = _build_email_jinja2_env()
    source, _, _ = env.loader.get_source(env, f'{event_type}.html.j2')

    # A diferencia del manager (bloques `{% set body_html %}...{% endset %}`),
    # las plantillas de este backend usan asignación en una sola línea:
    # `[% set body_html = body_html or '<html...>' + (tenant_name or '...') + '...' %]`
    # — se captura la expresión Jinja completa tras el `or` (puede incluir
    # concatenación con `+`), no solo el primer literal entre comillas.
    subject_match = re.search(r"\[%\s*set\s+subject\s*=\s*subject\s+or\s+(.+?)\s*%\]", source, re.S)
    subject_expr = subject_match.group(1) if subject_match else "''"

    body_match = re.search(r"\[%\s*set\s+body_html\s*=\s*body_html\s+or\s+(.+?)\s*%\]", source, re.S)
    body_expr = body_match.group(1) if body_match else "''"

    # Evaluar la expresión capturada con el mismo delimitador [[ ]] del resto
    # del sistema — así los {{ }} embebidos en el HTML (variables Authentik
    # como {{ user.username }}) se dejan literales a propósito, y solo se
    # resuelve [[ tenant_name ]] dentro de la expresión.
    frag_env = Environment(variable_start_string='[[', variable_end_string=']]', autoescape=False)
    default_subject = frag_env.from_string(f'[[ {subject_expr} ]]').render(tenant_name=tenant_name).strip()
    default_body = frag_env.from_string(f'[[ {body_expr} ]]').render(tenant_name=tenant_name).strip()

    return {"subject": default_subject, "body_html": default_body}


class TestEmailRequest(BaseModel):
    to_email: str
    event_type: str
    app_slug: Optional[str] = None

    @field_validator('to_email', mode='after')
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if '@' not in v or '.' not in v.split('@')[-1]:
            raise ValueError('Dirección de correo inválida')
        return v


def _b64_to_bytes(data_url: str) -> tuple[bytes, str]:
    m = re.match(r'data:([^;]+);base64,(.+)', data_url or '', re.S)
    if m:
        return base64.b64decode(m.group(2)), m.group(1)
    return b'', 'image/png'


def _strip_header_injection(value: str) -> str:
    """Elimina CR/LF y caracteres de control para prevenir inyección de
    cabeceras SMTP (CWE-93) vía subject/to_email construidos a partir de
    datos que, aunque validados con regex, pueden originarse en HTML
    editado por el usuario (ej. <title> del cuerpo del correo)."""
    return re.sub(r'[\r\n\x00-\x08\x0b\x0c\x0e-\x1f]', '', value or '').strip()


def _send_smtp(to_email: str, subject: str, html: str, logo_bytes: bytes, logo_mime: str) -> None:
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        raise ValueError("SMTP no configurado — añadir SMTP_HOST, SMTP_USER y SMTP_PASSWORD al .env")

    to_email = _strip_header_injection(to_email)
    subject = _strip_header_injection(subject)

    CID = 'logo_casmarts_cid'
    if logo_bytes:
        html = re.sub(r'src="https://[^"]*logo_top[^"]*"', f'src="cid:{CID}"', html)

    outer = MIMEMultipart('related')
    outer['Subject'] = subject
    outer['From'] = f'CASMARTS Core <{settings.SMTP_FROM or settings.SMTP_USER}>'
    outer['To'] = to_email

    alt = MIMEMultipart('alternative')
    alt.attach(MIMEText(html, 'html', 'utf-8'))
    outer.attach(alt)

    if logo_bytes:
        subtype = logo_mime.split('/')[-1] if '/' in logo_mime else 'png'
        img = MIMEImage(logo_bytes, _subtype=subtype)
        img.add_header('Content-ID', f'<{CID}>')
        img.add_header('Content-Disposition', 'inline', filename=f'logo.{subtype}')
        outer.attach(img)

    ctx = ssl.create_default_context()
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as srv:
        srv.ehlo()
        if settings.SMTP_TLS:
            srv.starttls(context=ctx)
        srv.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        srv.sendmail(settings.SMTP_FROM or settings.SMTP_USER, [to_email], outer.as_string())


@router.post("/{flow_slug}/emails/test", dependencies=[Depends(verify_admin_key)])
async def send_test_email(
    flow_slug: str,
    body: TestEmailRequest,
    db: AsyncSession = Depends(get_db)
):
    if body.event_type not in EMAIL_EVENT_TYPES:
        raise HTTPException(status_code=422, detail=f"event_type inválido: {body.event_type}")

    # Resolver tema (app-específico con fallback a global)
    theme = None
    if body.app_slug:
        r = await db.execute(select(TenantTheme).where(
            TenantTheme.authentik_flow_slug == flow_slug,
            TenantTheme.authentik_app_slug == body.app_slug
        ))
        theme = r.scalar_one_or_none()
    if theme is None:
        r = await db.execute(select(TenantTheme).where(
            TenantTheme.authentik_flow_slug == flow_slug,
            TenantTheme.authentik_app_slug.is_(None)
        ))
        theme = r.scalar_one_or_none()
    if not theme:
        raise HTTPException(status_code=404, detail=f"Tema no encontrado para flow '{flow_slug}'.")

    # Cuerpo del correo desde BD (vacío → usa defaults del template)
    eb = await db.execute(select(TenantEmailBody).where(
        TenantEmailBody.flow_slug == flow_slug,
        TenantEmailBody.event_type == body.event_type
    ))
    email_body = eb.scalar_one_or_none()
    db_body_html = email_body.body_html if email_body else ''
    db_subject = email_body.subject if email_body else ''

    tenant_name = _strip_html_tags(theme.system_name) or theme.display_name or 'CASMARTS'

    # Logo superior desde base64 del tema
    logo_bytes, logo_mime = b'', 'image/png'
    logo_base64: Optional[str] = None
    if theme.logo_top_base64:
        logo_bytes, logo_mime = _b64_to_bytes(theme.logo_top_base64)
        logo_base64 = theme.logo_top_base64
        if len(logo_bytes) > 200 * 1024:
            log.warning("Logo superior >200 KB para flow '%s' — omitido del correo de prueba.", flow_slug)
            logo_bytes = b''
            logo_base64 = None

    # Logo inferior
    logo_bottom_base64: Optional[str] = None
    if theme.logo_bottom_base64:
        if len(theme.logo_bottom_base64.encode()) > 200 * 1024:
            log.warning("Logo inferior >200 KB para flow '%s' — omitido del correo de prueba.", flow_slug)
        else:
            logo_bottom_base64 = theme.logo_bottom_base64

    # Logo URL → None cuando hay CID (se reemplaza en _send_smtp)
    logo_url = None

    # Determinar el flow correcto según el evento
    flow_map = {
        'password_reset': 'password-recovery',
        'email_verification': 'default-source-enrollment',
        'new_account': 'password-recovery',
        'account_lockout': 'default-authentication-flow',
        'security_change': 'default-user-settings-flow',
        'account_locked_admin': 'default-authentication-flow',
        'account_unlocked_admin': 'default-authentication-flow',
        'login_success': 'default-authentication-flow',
        'suspicious_request': 'default-authentication-flow',
        'invitation_used': 'default-authentication-flow',
        'app_authorized': 'default-authentication-flow',
        'impersonation_started': 'default-user-settings-flow',
        'account_deleted': 'default-authentication-flow',
    }
    cta_url_flow = flow_map.get(body.event_type, 'default-authentication-flow')
    cta_url = f'https://auth.casmart.internal/if/flow/{cta_url_flow}/'
    env_j2 = _build_email_jinja2_env()
    tmpl = env_j2.get_template(f'{body.event_type}.html.j2')
    html = tmpl.render(
        theme=theme,
        body_html=db_body_html,
        subject=db_subject,
        logo_base64=logo_base64,
        logo_url=logo_url,
        logo_bottom_base64=logo_bottom_base64,
        logo_bottom_url=None,
        event_type=body.event_type,
        cta_url=cta_url,
        tenant_name=tenant_name,
    )

    # Sustituir variables Authentik con valores de preview
    for var, val in {
        '{{ url }}': cta_url,
        '{{ user.username }}': str(body.to_email).split('@')[0],
        '{{ user.email }}': str(body.to_email),
        '{{ token }}': 'TOK-PREVIEW-12345',
        '{{ tenant.name }}': tenant_name,
    }.items():
        html = html.replace(var, val)

    subject_line = re.search(r'<title[^>]*>([^<]+)</title>', html, re.I)
    subject_text = f'[TEST] {subject_line.group(1).strip()}' if subject_line else f'[TEST] Correo de prueba'

    try:
        _send_smtp(str(body.to_email), subject_text, html, logo_bytes, logo_mime)
    except Exception as e:
        # No exponer el mensaje crudo de smtplib/SSL (puede filtrar host/puerto/
        # detalles internos) — se loguea completo server-side y se responde genérico.
        log.error("Error enviando correo de prueba: %s", e)
        raise HTTPException(status_code=502, detail="Error al enviar el correo de prueba. Revisa la configuración SMTP.")

    return {"status": "sent", "to": str(body.to_email), "subject": subject_text}


@router.get("/{flow_slug}", response_model=ThemeResponseWithEmail, dependencies=[Depends(verify_admin_key)])
async def get_theme(
    flow_slug: str,
    app_slug: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    if app_slug:
        stmt = select(TenantTheme).where(
            TenantTheme.authentik_flow_slug == flow_slug,
            TenantTheme.authentik_app_slug == app_slug
        )
    else:
        stmt = select(TenantTheme).where(
            TenantTheme.authentik_flow_slug == flow_slug,
            TenantTheme.authentik_app_slug.is_(None)
        )
    result = await db.execute(stmt)
    db_theme = result.scalar_one_or_none()
    if not db_theme:
        raise HTTPException(status_code=404, detail="Theme not found for this flow or app slug.")

    email_bodies = await _load_email_bodies(flow_slug, db)
    return _build_theme_response_with_email(db_theme, email_bodies)


@router.patch("/{flow_slug}", response_model=ThemeResponseWithEmail, dependencies=[Depends(verify_admin_key)])
async def patch_theme(
    flow_slug: str,
    theme_in: ThemeUpdateWithEmail,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(TenantTheme).where(TenantTheme.authentik_flow_slug == flow_slug)
    result = await db.execute(stmt)
    db_theme = result.scalar_one_or_none()
    if not db_theme:
        raise HTTPException(status_code=404, detail="Theme not found for this flow slug.")

    update_data = theme_in.model_dump(exclude_unset=True)
    email_bodies_data = update_data.pop('email_bodies', None)

    for field, value in update_data.items():
        setattr(db_theme, field, value)

    db.add(db_theme)

    if email_bodies_data:
        bodies = {k: EmailBodySchema(**v) for k, v in email_bodies_data.items()}
        await _upsert_email_bodies(flow_slug, bodies, db)

    await db.commit()
    await db.refresh(db_theme)

    await cache.delete(f"theme:{flow_slug}")
    if cache.redis:
        try:
            keys = await cache.redis.keys(f"theme:{flow_slug}:*")
            if keys:
                await cache.redis.delete(*keys)
        except Exception:
            pass

    email_bodies = await _load_email_bodies(flow_slug, db)
    return _build_theme_response_with_email(db_theme, email_bodies)


@router.delete("/{flow_slug}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(verify_admin_key)])
async def delete_theme(flow_slug: str, db: AsyncSession = Depends(get_db)):
    stmt = select(TenantTheme).where(TenantTheme.authentik_flow_slug == flow_slug)
    result = await db.execute(stmt)
    db_theme = result.scalar_one_or_none()
    if not db_theme:
        raise HTTPException(status_code=404, detail="Theme not found for this flow slug.")

    await db.delete(db_theme)
    await db.commit()
    await cache.delete(f"theme:{flow_slug}")


# ── login template machinery ─────────────────────────────────────────────────

_DEFAULT_THEME = SimpleNamespace(
    primary_color='#4272A5',
    hover_color='#2d5580',
    card_bg_color='#FFFFFF',
    panel_bg_color='#F6F9FD',
    bg_type='gradient',
    bg_flat_color=None,
    bg_gradient_from='#c8c4bc',
    bg_gradient_to='#a09890',
    bg_image_base64=None,
    bg_opacity=1.0,
    form_opacity=0.55,
    form_height_pct=None,
    logos_opacity=0.55,
    logos_height_pct=None,
    layout_position='left',
    name_align='center',
    subtitle_align='center',
    privacy_align='center',
    system_name='CASMARTS<br>Core',
    system_subtitle='Autenticación Unificada',
    system_name_color='#111827',
    system_subtitle_color='#374151',
    logo_top_base64=None,
    logo_bottom_base64=None,
    logo_top_text=None,
    logo_bottom_text=None,
    privacy_pdf_url=None,
    display_name='CASMARTS',
    allow_self_registration=False,
    show_social_google=False,
    show_social_microsoft=False,
    show_social_gov_id=False,
    show_forgot_password=True,
    show_logos_panel=True,
    show_password_toggle=True,
    show_system_name=True,
    show_system_subtitle=True,
    show_field_labels=True,
    email_footer_text=None,
    email_template_type='integrated',
)


def _hex_to_rgb(hex_color: str) -> str:
    hex_color = hex_color.lstrip('#')
    try:
        r = int(hex_color[0:2], 16)
        g = int(hex_color[2:4], 16)
        b = int(hex_color[4:6], 16)
        return f"{r}, {g}, {b}"
    except (ValueError, IndexError):
        return "255, 255, 255"


def _build_jinja2_env() -> Environment:
    templates_dir = Path(__file__).parent.parent / "templates"
    env = Environment(
        loader=FileSystemLoader(str(templates_dir)),
        variable_start_string="[[",
        variable_end_string="]]",
        block_start_string="[%",
        block_end_string="%]",
        comment_start_string="[#",
        comment_end_string="#]",
        autoescape=False,
    )
    env.filters["hex_to_rgb"] = _hex_to_rgb
    return env


def _build_email_jinja2_env() -> Environment:
    email_dir = Path(__file__).parent.parent / "templates" / "email"
    env = Environment(
        loader=FileSystemLoader(str(email_dir)),
        variable_start_string="[[",
        variable_end_string="]]",
        block_start_string="[%",
        block_end_string="%]",
        comment_start_string="[#",
        comment_end_string="#]",
        autoescape=False,
    )
    env.filters["hex_to_rgb"] = _hex_to_rgb
    return env


def _render_theme(env: Environment, theme) -> str:
    flow_slug = getattr(theme, 'authentik_flow_slug', 'default-authentication-flow') or 'default-authentication-flow'
    app_slug  = getattr(theme, 'authentik_app_slug', None) or ''
    app_qs    = f'?app={app_slug}' if app_slug else ''
    api_base  = '/lm'

    template = env.get_template("login.html.j2")
    return template.render(
        theme=theme,
        api_base=api_base,
        logo_top_url=f'{api_base}/api/v1/public/theme/{flow_slug}/image/logo_top{app_qs}' if getattr(theme, 'logo_top_base64', None) else '',
        logo_bottom_url=f'{api_base}/api/v1/public/theme/{flow_slug}/image/logo_bottom{app_qs}' if getattr(theme, 'logo_bottom_base64', None) else '',
        bg_image_url=f'{api_base}/api/v1/public/theme/{flow_slug}/image/bg_image{app_qs}' if getattr(theme, 'bg_image_base64', None) else '',
    )


def _build_universal_template(
    app_themes: list[tuple[str, TenantTheme]],
    global_theme,
) -> str:
    env = _build_jinja2_env()
    fallback = global_theme if global_theme else (app_themes[0][1] if app_themes else _DEFAULT_THEME)
    return _render_theme(env, fallback)


async def _sync_password_toggle(flow_slug: str, allow_show_password: bool) -> tuple[bool, Optional[str]]:
    """Alinea el botón nativo de 'mostrar contraseña' de Authentik con
    `theme.show_password_toggle`.

    El mecanismo anterior intentaba ocultar/mostrar el botón vía CSS
    (`.pf-c-input-group>.pf-c-button` en login.html.j2) — no puede funcionar:
    el campo de contraseña real es el web component Lit `ak-flow-input-password`,
    que vive en un Shadow DOM. Un <style> inyectado en el light DOM no cruza
    ese límite, así que el CSS nunca alcanzaba el botón real (verificado
    leyendo el bundle de Authentik 2026.2.4: `renderVisibilityToggle(){if(!this.allowShowPassword)return nothing;...}`).
    El botón solo existe en absoluto si `PasswordStage.allow_show_password`
    es True del lado de Authentik — hay que ajustar ese campo real vía API.

    Un PasswordStage puede estar vinculado a varios flows (`flow_set`); se
    filtra por el flow_slug del tema y se actualizan solo los stages
    realmente usados por ese flujo.
    """
    if not settings.AUTHENTIK_API_TOKEN or not settings.AUTHENTIK_HOST:
        return False, "AUTHENTIK_API_TOKEN/AUTHENTIK_HOST no configurados en .env."

    headers = {"Authorization": f"Bearer {settings.AUTHENTIK_API_TOKEN}"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{settings.AUTHENTIK_HOST}/api/v3/stages/password/", headers=headers)
            resp.raise_for_status()
            stages = resp.json().get("results", [])
            matching = [s for s in stages if any(f.get("slug") == flow_slug for f in s.get("flow_set", []))]
            if not matching:
                return False, f"No se encontró ninguna etapa de contraseña vinculada al flujo '{flow_slug}'."

            for stage in matching:
                if stage.get("allow_show_password") == allow_show_password:
                    continue
                patch_resp = await client.patch(
                    f"{settings.AUTHENTIK_HOST}/api/v3/stages/password/{stage['pk']}/",
                    headers=headers,
                    json={"allow_show_password": allow_show_password},
                )
                patch_resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        return False, f"Error de la API de Authentik: {e.response.text[:300]}"
    except httpx.RequestError as e:
        return False, f"No se pudo contactar a Authentik: {str(e)}"

    return True, None


@router.post("/{flow_slug}/deploy", dependencies=[Depends(verify_admin_key)])
async def deploy_theme(flow_slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TenantTheme).where(TenantTheme.authentik_flow_slug == flow_slug)
    )
    themes: list[TenantTheme] = result.scalars().all()
    if not themes:
        raise HTTPException(status_code=404, detail="No themes found for this flow slug.")

    global_theme = next((t for t in themes if t.authentik_app_slug is None), None)
    app_themes = [(t.authentik_app_slug, t) for t in themes if t.authentik_app_slug]

    try:
        universal_html = _build_universal_template(app_themes, global_theme)
    except Exception as e:
        log.error("Error construyendo plantilla universal para deploy de '%s': %s", flow_slug, e)
        raise HTTPException(status_code=500, detail="Error al construir la plantilla. Revisa los logs del backend.")

    output_dir = Path("/shared/authentik/templates/if")
    try:
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / "flow.html"
        output_path.write_text(universal_html, encoding="utf-8")
    except OSError as e:
        log.error("Error escribiendo flow.html para '%s' en volumen compartido: %s", flow_slug, e)
        raise HTTPException(
            status_code=503,
            detail="No se pudo escribir en el volumen compartido. Verifica el mount "
                   "'../core-casmarts/data/authentik/custom-templates' y sus permisos.",
        )

    await cache.delete(f"theme:{flow_slug}:global")
    for _, theme in app_themes:
        if theme.authentik_app_slug:
            await cache.delete(f"theme:{flow_slug}:{theme.authentik_app_slug}")
    if cache.redis:
        try:
            keys = await cache.redis.keys(f"theme:{flow_slug}:*")
            if keys:
                await cache.redis.delete(*keys)
        except Exception:
            pass

    show_password_toggle = (
        global_theme.show_password_toggle if global_theme
        else (app_themes[0][1].show_password_toggle if app_themes else True)
    )
    password_toggle_synced, password_toggle_error = await _sync_password_toggle(flow_slug, show_password_toggle)
    if not password_toggle_synced:
        log.warning("No se pudo sincronizar el botón de mostrar contraseña para '%s': %s", flow_slug, password_toggle_error)

    deployed_apps = [slug for slug, _ in app_themes] or (["(global)"] if global_theme else [])
    return {
        "status": "deployed",
        "path": str(output_path),
        "apps": deployed_apps,
        "password_toggle_synced": password_toggle_synced,
        "password_toggle_error": password_toggle_error,
    }


@router.get("/blueprint/download")
async def download_brand_blueprint(
    brand_name: str = Query(..., description="Nombre de la marca/brand"),
    domain: str = Query(..., description="Dominio de la marca")
):
    """
    Genera y descarga un Blueprint de Authentik para inicializar una nueva marca,
    aprovisionar sus dominios y la estructura de grupos de usuarios inicial.
    """
    brand_slug = brand_name.lower().replace(" ", "-").strip()
    yaml_content = f"""version: 1
metadata:
  name: Aprovisionamiento de Marca - {brand_name}
entries:
  # 1. Crear Marca (Brand) en Authentik
  - identifiers:
      domain: {domain}
    model: authentik_brands.brand
    attrs:
      name: {brand_name}
      domain: {domain}
      is_default: false
      branding_title: {brand_name} ID
      
  # 2. Crear Grupo Padre de la Marca (para usuarios de este dominio)
  - identifiers:
      name: {brand_name}-users
    model: authentik_core.group
    attrs:
      name: {brand_name}-users
      is_superuser: false

  # 3. Crear Subgrupos de aplicaciones bajo este Tenant/Marca
  - identifiers:
      name: {brand_name}-starter
    model: authentik_core.group
    attrs:
      name: {brand_name}-starter
      parent: !Find [authentik_core.group, [name, {brand_name}-users]]

  - identifiers:
      name: {brand_name}-plane
    model: authentik_core.group
    attrs:
      name: {brand_name}-plane
      parent: !Find [authentik_core.group, [name, {brand_name}-users]]
"""
    from fastapi.responses import Response
    return Response(
        content=yaml_content,
        media_type="text/yaml",
        headers={
            "Content-Disposition": f"attachment; filename=blueprint-brand-{brand_slug}.yaml"
        }
    )
