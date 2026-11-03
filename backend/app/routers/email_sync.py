import datetime
import logging
import re
import uuid
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.config import settings
from app.models.tenant import Tenant
from app.models.tenant_theme import TenantTheme
from app.routers.admin import verify_admin_key, _build_email_jinja2_env, _strip_html_tags

log = logging.getLogger(__name__)

email_sync_router = APIRouter(
    prefix="/api/v1/emails",
    tags=["Email Sync"],
    dependencies=[Depends(verify_admin_key)],
)

# Tenant fijo de este backend (single-tenant por diseño, ver config.py). La
# tabla tenant_themes es compartida con authentik-login-manager — sin este
# filtro, dos tenants con tema global para el mismo flow_slug (común: ambos
# usan "default-authentication-flow") harían que la consulta de abajo
# devuelva MÁS DE UNA fila y SQLAlchemy tire MultipleResultsFound.
_DEFAULT_TENANT_UUID = uuid.UUID(settings.DEFAULT_TENANT_ID)

# event_type → (nombre del EmailStage real en Authentik, ruta del template
# desplegado). password_reset usa casmarts-smtp-gmail (flow
# password-recovery); email_verification usa casmarts-enrollment-verification
# (las flows de enrollment). Los otros tipos de correo (new_account,
# account_lockout, security_change, etc.) no tienen EmailStage propio — se
# resuelven vía el puente de eventos/webhook (authentik_events.py).
_AUTHENTIK_EMAIL_STAGES: dict[str, tuple[str, str]] = {
    "password_reset": ("casmarts-smtp-gmail", "email/password_reset.html"),
    "email_verification": ("casmarts-enrollment-verification", "email/email_verification.html"),
}

# Placeholders únicos usados durante el render de dos pasadas (Jinja + nuestra
# sustitución de {{variables}}) para que ninguno de los dos motores los
# interprete como propios — se convierten a tags Django reales al final.
_SENTINEL_URL = "§§AUTHENTIK_URL§§"
_SENTINEL_USER = "§§AUTHENTIK_USER§§"
_SENTINEL_USER_LOGIN = "§§AUTHENTIK_USER_LOGIN§§"
_SENTINEL_EMAIL = "§§AUTHENTIK_EMAIL§§"
_SENTINEL_NOW = "§§AUTHENTIK_NOW§§"

# {% now %} solo, sin más, renderiza en la zona horaria ACTIVA de Django en
# el momento del request — que en Authentik es UTC por defecto, no la hora
# local del servidor. {% timezone %} fuerza la conversión sin tocar el
# TIME_ZONE global de Authentik.
_DJANGO_NOW_LOCAL = '{% timezone "America/Mexico_City" %}{% now "d/m/Y H:i" %}{% endtimezone %}'


def _build_dynamic_logo_block(all_themes: list[TenantTheme], is_bottom: bool) -> str:
    conds = []
    global_logo = None
    # Deduplicate app slugs to avoid duplicate branches
    seen_slugs = set()
    for t in all_themes:
        logo = t.logo_bottom_base64 if is_bottom else t.logo_top_base64
        if not logo:
            continue
        if t.authentik_app_slug:
            app_slug = t.authentik_app_slug.lower().strip()
            if app_slug in seen_slugs:
                continue
            seen_slugs.add(app_slug)
            conds.append(f'{{% elif url and "{app_slug}" in url or "{app_slug}" in user.groups.all|stringformat:"s"|lower or "{app_slug}" in user.username|lower %}}{logo}')
        else:
            global_logo = logo

    if not conds:
        return global_logo or ""

    first_cond = conds[0].replace('{% elif', '{% if')
    rest_conds = "\n".join(conds[1:])
    default_part = f'{{% else %}}{global_logo or ""}{{% endif %}}'
    return f"{first_cond}\n{rest_conds}\n{default_part}"


def _render_password_reset_for_authentik(theme: TenantTheme, tenant: Tenant, all_themes: list[TenantTheme]) -> str:
    """
    Renderiza el evento password_reset como plantilla Django real para
    desplegar en Authentik. A diferencia de preview_email()/send_test_email(),
    el EmailStage de Authentik solo pasa {url, user, expires, token} al
    renderizar — sin contexto de tenant/marca. Por eso todo lo demás
    (colores, logo, nombre, footer) se resuelve AHORA, a valores concretos
    de este tema; solo esos campos quedan como tags Django reales para que
    Authentik los rellene en cada envío real.
    """
    tenant_name = _strip_html_tags(theme.system_name) or theme.display_name or "CASMARTS"

    logo_base64 = _build_dynamic_logo_block(all_themes, False)
    logo_bottom_base64 = _build_dynamic_logo_block(all_themes, True)

    env = _build_email_jinja2_env()
    template = env.get_template("password_reset.html.j2")
    html = template.render(
        theme=theme,
        body_html="",
        subject="",
        logo_base64=logo_base64,
        logo_url=None,
        logo_bottom_base64=logo_bottom_base64,
        logo_bottom_url=None,
        event_type="password_reset",
        cta_url=_SENTINEL_URL,
        tenant_name=tenant_name,
    )

    current_year = datetime.datetime.now().year
    subs = {
        "{{usuario_login}}": _SENTINEL_USER_LOGIN,
        "{{nombre_usuario}}": _SENTINEL_USER,
        "{{fecha_evento}}": _SENTINEL_NOW,
        "{{contacto_soporte}}": "soporte@casmarts.internal",
        "{{empresa_nombre}}": tenant.name,
        "{{anio}}": str(current_year),
    }
    for var, val in subs.items():
        html = html.replace(var, val)

    # Authentik no expone la IP de origen en el contexto del EmailStage —
    # se quita la fila en vez de mostrar un dato falso.
    html = re.sub(
        r"<tr>\s*<td[^>]*>IP de origen</td>\s*<td[^>]*>[^<]*</td>\s*</tr>",
        "",
        html,
    )

    # El template fuente usa {{enlace_expiracion_texto}} (para el preview y
    # el correo new_account) — pero el EmailStage real de Authentik calcula
    # su propia vigencia por token en {{ expires }}, más precisa que
    # cualquier valor fijo.
    html = html.replace(
        "Este enlace es válido por {{enlace_expiracion_texto}} a partir del momento en que se generó.",
        "Este enlace expira {{ expires|naturaltime }}.",
    )

    html = html.replace(_SENTINEL_URL, "{{ url }}")
    html = html.replace(_SENTINEL_USER, "{{ user.name|default:user.username }}")
    html = html.replace(_SENTINEL_USER_LOGIN, "{{ user.username }}")
    html = html.replace(_SENTINEL_NOW, _DJANGO_NOW_LOCAL)

    html = "{% load humanize %}{% load tz %}\n" + html

    return html


def _render_email_verification_for_authentik(theme: TenantTheme, tenant: Tenant, all_themes: list[TenantTheme]) -> str:
    """
    Igual que `_render_password_reset_for_authentik` pero para el
    EmailStage `casmarts-enrollment-verification` (registro, no
    recuperación) — mismo patrón de dos pasadas.
    """
    tenant_name = _strip_html_tags(theme.system_name) or theme.display_name or "CASMARTS"

    logo_base64 = _build_dynamic_logo_block(all_themes, False)
    logo_bottom_base64 = _build_dynamic_logo_block(all_themes, True)

    env = _build_email_jinja2_env()
    template = env.get_template("email_verification.html.j2")
    html = template.render(
        theme=theme,
        body_html="",
        subject="",
        logo_base64=logo_base64,
        logo_url=None,
        logo_bottom_base64=logo_bottom_base64,
        logo_bottom_url=None,
        event_type="email_verification",
        cta_url=_SENTINEL_URL,
        tenant_name=tenant_name,
    )

    current_year = datetime.datetime.now().year
    subs = {
        "{{usuario_login}}": _SENTINEL_USER_LOGIN,
        "{{nombre_usuario}}": _SENTINEL_USER,
        "{{usuario_email}}": _SENTINEL_EMAIL,
        "{{fecha_evento}}": _SENTINEL_NOW,
        "{{contacto_soporte}}": "soporte@casmarts.internal",
        "{{empresa_nombre}}": tenant.name,
        "{{anio}}": str(current_year),
    }
    for var, val in subs.items():
        html = html.replace(var, val)

    html = html.replace(
        "Este enlace expirará en 24 horas.",
        "Este enlace expira {{ expires|naturaltime }}.",
    )

    html = html.replace(_SENTINEL_URL, "{{ url }}")
    html = html.replace(_SENTINEL_USER, "{{ user.name|default:user.username }}")
    html = html.replace(_SENTINEL_USER_LOGIN, "{{ user.username }}")
    html = html.replace(_SENTINEL_EMAIL, "{{ user.email }}")
    html = html.replace(_SENTINEL_NOW, _DJANGO_NOW_LOCAL)

    html = "{% load humanize %}{% load tz %}\n" + html

    return html


_RENDERERS = {
    "password_reset": _render_password_reset_for_authentik,
    "email_verification": _render_email_verification_for_authentik,
}


@email_sync_router.post("/deploy-to-authentik/{event_type}")
async def deploy_email_to_authentik(
    event_type: str,
    flow_slug: str = Query("default-authentication-flow"),
    db: AsyncSession = Depends(get_db),
):
    """
    Despliega la plantilla real de Authentik para `event_type` (los tipos
    con EmailStage nativo, ver _AUTHENTIK_EMAIL_STAGES) usando el tema
    GLOBAL de este tenant para el flow dado — Authentik no puede
    diferenciar por tenant, solo hay un Brand/EmailStage compartido en esta
    instancia.
    """
    stage_info = _AUTHENTIK_EMAIL_STAGES.get(event_type)
    if not stage_info:
        raise HTTPException(
            status_code=400,
            detail=(
                f"'{event_type}' no tiene un EmailStage real en Authentik. "
                f"Tipos desplegables así: {', '.join(_AUTHENTIK_EMAIL_STAGES)}; "
                "los demás eventos se envían vía el puente de eventos/webhook."
            ),
        )
    authentik_stage_name, authentik_template_rel_path = stage_info

    if not settings.AUTHENTIK_API_TOKEN or not settings.AUTHENTIK_HOST:
        raise HTTPException(
            status_code=503,
            detail="AUTHENTIK_API_TOKEN/AUTHENTIK_HOST no configurados en .env.",
        )

    result = await db.execute(
        select(TenantTheme).where(
            TenantTheme.tenant_id == _DEFAULT_TENANT_UUID,
            TenantTheme.authentik_flow_slug == flow_slug,
            TenantTheme.authentik_app_slug.is_(None),
        )
    )
    theme = result.scalar_one_or_none()
    if not theme:
        raise HTTPException(status_code=404, detail=f"No hay tema global para flow '{flow_slug}'.")

    tenant_result = await db.execute(select(Tenant).where(Tenant.id == theme.tenant_id))
    tenant = tenant_result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado para este tema.")

    # Temas de este tenant para construir el bloque de logo dinámico
    # (una rama Django por app con logo propio, con el global como default).
    themes_result = await db.execute(
        select(TenantTheme).where(
            TenantTheme.tenant_id == _DEFAULT_TENANT_UUID,
            TenantTheme.is_active == True,
        )
    )
    all_themes = list(themes_result.scalars().all())

    html = _RENDERERS[event_type](theme, tenant, all_themes)

    output_dir = Path("/shared/authentik/templates/email")
    try:
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / Path(authentik_template_rel_path).name
        output_path.write_text(html, encoding="utf-8")
    except OSError as e:
        raise HTTPException(
            status_code=503,
            detail=f"No se pudo escribir en el volumen compartido: {str(e)}.",
        )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            headers = {"Authorization": f"Bearer {settings.AUTHENTIK_API_TOKEN}"}
            list_resp = await client.get(f"{settings.AUTHENTIK_HOST}/api/v3/stages/email/", headers=headers)
            list_resp.raise_for_status()
            stage = next(
                (s for s in list_resp.json().get("results", []) if s.get("name") == authentik_stage_name),
                None,
            )
            if not stage:
                raise HTTPException(
                    status_code=502,
                    detail=f"No se encontró el EmailStage '{authentik_stage_name}' en Authentik.",
                )
            patch_resp = await client.patch(
                f"{settings.AUTHENTIK_HOST}/api/v3/stages/email/{stage['pk']}/",
                headers=headers,
                json={"template": authentik_template_rel_path},
            )
            patch_resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Error de la API de Authentik: {e.response.text[:300]}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=504, detail=f"No se pudo contactar a Authentik: {str(e)}")

    log.info("Plantilla de Authentik desplegada: %s -> %s", event_type, authentik_template_rel_path)
    return {
        "status": "deployed",
        "event_type": event_type,
        "path": str(output_path),
        "authentik_stage": authentik_stage_name,
        "authentik_template": authentik_template_rel_path,
    }
