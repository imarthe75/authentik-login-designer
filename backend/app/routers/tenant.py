import logging
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.config import settings
from app.models.tenant import Tenant
from app.models.tenant_application import TenantApplication
from app.routers.admin import verify_admin_key
from app.schemas.theme import HEX_COLOR_REGEX

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/tenant", tags=["Tenant"])

# A diferencia de authentik-login-manager (multi-tenant, resuelve por
# hostname vía X-Tenant-Domain con validación de proxy confiable), este
# backend es single-tenant por diseño — nada más en esta app filtra u
# aísla datos por tenant, así que replicar la resolución por header aquí
# sería seguridad aparente sin sustento real. Se resuelve siempre al mismo
# tenant fijo (ver settings.DEFAULT_TENANT_ID, usado también al crear temas
# en routers/admin.py).


async def _get_default_tenant(db: AsyncSession) -> Optional[Tenant]:
    result = await db.execute(
        select(Tenant).where(Tenant.id == uuid.UUID(settings.DEFAULT_TENANT_ID))
    )
    return result.scalar_one_or_none()


@router.get("/resolve")
async def resolve_tenant(db: AsyncSession = Depends(get_db)):
    """Endpoint público — mismo contrato que el manager, para que el
    frontend (Angular) pueda mostrar nombre/colores del tenant. Siempre
    resuelve al único tenant configurado en este backend."""
    tenant = await _get_default_tenant(db)
    if not tenant:
        log.warning("DEFAULT_TENANT_ID '%s' not found in tenants table; using fallback.", settings.DEFAULT_TENANT_ID)
        return {
            "tenant_id": settings.DEFAULT_TENANT_ID,
            "tenant_name": "CASMARTS Core",
            "domain_pattern": "casmarts.local",
            "primary_color": "#4272A5",
            "secondary_color": "#2d5580",
            "default_app_url": None,
        }
    return {
        "tenant_id": str(tenant.id),
        "tenant_name": tenant.name,
        "domain_pattern": tenant.domain_pattern,
        "primary_color": tenant.primary_color,
        "secondary_color": tenant.secondary_color,
        "default_app_url": (tenant.config or {}).get("default_app_url"),
    }


class BrandPaletteSwatch(BaseModel):
    name: str = Field(..., max_length=80)
    color: str = Field(..., pattern=HEX_COLOR_REGEX)
    hover: str = Field(..., pattern=HEX_COLOR_REGEX)


class TenantSettingsUpdate(BaseModel):
    default_app_url: Optional[str] = None
    # Columnas reales de Tenant (no viven en config) — acento del propio
    # panel Designer y swatches "Actual:" del selector de tenant. Mismo
    # patrón que authentik-login-manager (ver TenantBrandingTab.tsx ahí).
    primary_color: Optional[str] = Field(None, pattern=HEX_COLOR_REGEX)
    secondary_color: Optional[str] = Field(None, pattern=HEX_COLOR_REGEX)
    # Swatches sugeridas en el selector rápido de color del ConfigPanel —
    # reemplaza cualquier paleta hardcodeada por una real, propia de este
    # tenant.
    brand_palette: Optional[List[BrandPaletteSwatch]] = None

    @field_validator('default_app_url', mode='after')
    @classmethod
    def validate_url(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == '':
            return None
        v = v.strip()
        if not (v.startswith('http://') or v.startswith('https://')):
            raise ValueError('default_app_url debe ser una URL absoluta (http:// o https://)')
        return v


@router.get("/settings", dependencies=[Depends(verify_admin_key)])
async def get_tenant_settings(db: AsyncSession = Depends(get_db)):
    tenant = await _get_default_tenant(db)
    if not tenant:
        raise HTTPException(status_code=404, detail="Default tenant not configured.")
    config = tenant.config or {}
    return {
        "default_app_url": config.get("default_app_url"),
        "brand_palette": config.get("brand_palette"),
        "primary_color": tenant.primary_color,
        "secondary_color": tenant.secondary_color,
    }


@router.patch("/settings", dependencies=[Depends(verify_admin_key)])
async def update_tenant_settings(body: TenantSettingsUpdate, db: AsyncSession = Depends(get_db)):
    tenant = await _get_default_tenant(db)
    if not tenant:
        raise HTTPException(status_code=404, detail="Default tenant not configured.")
    new_config = dict(tenant.config or {})
    # Solo toca las claves que realmente vinieron en el PATCH — un PATCH que
    # solo manda brand_palette no debe borrar default_app_url (y viceversa).
    provided = body.model_dump(exclude_unset=True)
    if 'default_app_url' in provided:
        new_config["default_app_url"] = body.default_app_url
    if 'brand_palette' in provided:
        new_config["brand_palette"] = (
            [s.model_dump() for s in body.brand_palette] if body.brand_palette else None
        )
    tenant.config = new_config
    if 'primary_color' in provided and body.primary_color:
        tenant.primary_color = body.primary_color
    if 'secondary_color' in provided and body.secondary_color:
        tenant.secondary_color = body.secondary_color
    await db.commit()
    return {
        "default_app_url": tenant.config.get("default_app_url"),
        "brand_palette": tenant.config.get("brand_palette"),
        "primary_color": tenant.primary_color,
        "secondary_color": tenant.secondary_color,
    }


from sqlalchemy import text
from app.routers.admin import authentik_engine


async def _sync_tenants_from_authentik(db: AsyncSession) -> None:
    """
    Sincroniza las marcas (brands) de Authentik hacia la tabla local de tenants.
    """
    try:
        async with authentik_engine.connect() as conn:
            result = await conn.execute(
                text("SELECT brand_uuid, domain, branding_title FROM authentik_brands_brand")
            )
            authentik_brands = result.all()

        for brand in authentik_brands:
            brand_id, domain, name = brand

            stmt = select(Tenant).where(Tenant.id == brand_id)
            db_res = await db.execute(stmt)
            existing = db_res.scalar_one_or_none()

            if existing:
                existing.name = name
                existing.domain_pattern = domain
                db.add(existing)
            else:
                new_tenant = Tenant(
                    id=brand_id,
                    name=name,
                    domain_pattern=domain,
                    is_active=True,
                    primary_color="#4272A5",
                    secondary_color="#2d5580"
                )
                db.add(new_tenant)

        await db.commit()
    except Exception as e:
        log.error(f"Error syncing tenants from Authentik: {e}")


@router.get("/list")
async def list_available_tenants(db: AsyncSession = Depends(get_db)):
    """Lista tenants activos — mismo contrato público que el manager (sin
    datos sensibles: solo nombre/dominio/colores)."""
    try:
        await _sync_tenants_from_authentik(db)
        result = await db.execute(
            select(Tenant).where(Tenant.is_active == True).order_by(Tenant.name)
        )
        tenants = result.scalars().all()
        return [
            {
                "tenant_id": str(t.id),
                "tenant_name": t.name,
                "domain_pattern": t.domain_pattern,
                "primary_color": t.primary_color,
                "secondary_color": t.secondary_color,
            }
            for t in tenants
        ]
    except Exception as e:
        log.error("Error listing tenants: %s", e)
        raise HTTPException(status_code=500, detail="Error al listar tenants.")


# ── Aplicaciones del tenant ──────────────────────────────────────────────────
# Fuente de verdad para "qué apps son de este tenant" — reemplaza cualquier
# filtro por substring de nombre (ver list_authentik_applications en
# admin.py, que todavía usa ese heurístico viejo para "usana"; queda fuera
# del alcance de esta fase, no se toca aquí).

def _brand_slug(name: str) -> str:
    return (name or "").lower().replace(" ", "-").strip()


async def _fetch_authentik_apps() -> list[dict]:
    async with authentik_engine.connect() as conn:
        result = await conn.execute(
            text("SELECT slug, name FROM authentik_core_application ORDER BY name;")
        )
        return [{"slug": row[0], "name": row[1]} for row in result.fetchall()]


async def _auto_link_unassigned_applications(db: AsyncSession, apps: Optional[list[dict]] = None) -> None:
    """
    Enlaza automáticamente aplicaciones de Authentik al único tenant de este
    backend, usando la misma convención de grupos que
    download_brand_blueprint() en el manager ("{brand_name}-{app_slug}").

    A diferencia del manager (multi-tenant, itera TODOS los tenants activos
    buscando a cuál pertenece cada app), aquí solo hay un tenant posible —
    se simplifica a comprobar si el grupo de convención existe para ESE
    tenant. Si no existe, la app queda sin asignar (visible en la pestaña
    Aplicaciones para asignación manual) en vez de adivinar.
    """
    tenant = await _get_default_tenant(db)
    if not tenant:
        return

    if apps is None:
        apps = await _fetch_authentik_apps()
    if not apps:
        return

    linked_res = await db.execute(
        select(TenantApplication.application_slug).where(TenantApplication.tenant_id == tenant.id)
    )
    already_linked = {row[0] for row in linked_res.all()}

    unassigned_slugs = [a["slug"] for a in apps if a["slug"] not in already_linked]
    if not unassigned_slugs:
        return

    async with authentik_engine.connect() as conn:
        group_result = await conn.execute(text("SELECT name FROM authentik_core_group;"))
        group_names_lower = {row[0].lower() for row in group_result.fetchall() if row[0]}

    apps_by_slug = {a["slug"]: a for a in apps}

    for app_slug in unassigned_slugs:
        # El blueprint generado por el manager usa el nombre crudo de la
        # marca (con espacios/mayúsculas) como prefijo de grupo, no un slug
        # — se acepta ambas convenciones por si el nombre del tenant no
        # viene ya normalizado.
        candidates = {
            f"{(tenant.name or '').lower()}-{app_slug}",
            f"{_brand_slug(tenant.name)}-{app_slug}",
        }
        if not candidates & group_names_lower:
            continue

        app_item = apps_by_slug[app_slug]
        log.info("Auto-enlazando app '%s' al tenant '%s' vía convención de grupo", app_slug, tenant.name)
        db.add(TenantApplication(
            tenant_id=tenant.id,
            application_slug=app_slug,
            application_name=app_item["name"],
            link_source="group_convention",
            is_confirmed=True,
        ))

    await db.commit()


@router.get("/applications", dependencies=[Depends(verify_admin_key)])
async def list_tenant_applications(db: AsyncSession = Depends(get_db)):
    """
    Pestaña "Aplicaciones" del panel: enlaces confirmados del único tenant
    de este backend + apps de Authentik que no tienen tenant asignado
    todavía (ni por convención de grupo ni a mano).
    """
    await _auto_link_unassigned_applications(db)

    tenant_id = uuid.UUID(settings.DEFAULT_TENANT_ID)
    linked_res = await db.execute(
        select(TenantApplication)
        .where(TenantApplication.tenant_id == tenant_id)
        .order_by(TenantApplication.application_slug)
    )
    linked = linked_res.scalars().all()

    all_apps = await _fetch_authentik_apps()
    # "Sin asignar" es relativo a TODOS los tenants de la tabla compartida
    # (no solo este) — una app ya enlazada a otro tenant (ej. TECA en
    # Manager) no debe ofrecerse aquí como si estuviera libre.
    linked_slugs_res = await db.execute(select(TenantApplication.application_slug).distinct())
    linked_slugs = {row[0] for row in linked_slugs_res.all()}
    unassigned = [a for a in all_apps if a["slug"] not in linked_slugs]

    return {
        "linked": [
            {
                "id": str(t.id), "tenant_id": str(t.tenant_id),
                "application_slug": t.application_slug, "application_name": t.application_name,
                "link_source": t.link_source, "is_confirmed": t.is_confirmed,
            }
            for t in linked
        ],
        "unassigned": unassigned,
    }


class TenantApplicationCreate(BaseModel):
    application_slug: str = Field(..., max_length=100)
    application_name: Optional[str] = Field(None, max_length=255)


@router.post("/applications", dependencies=[Depends(verify_admin_key)])
async def create_tenant_application(
    body: TenantApplicationCreate,
    db: AsyncSession = Depends(get_db),
):
    """Enlaza manualmente una app al único tenant de este backend."""
    tenant = await _get_default_tenant(db)
    if not tenant:
        raise HTTPException(status_code=404, detail="Default tenant not configured.")

    existing_res = await db.execute(select(TenantApplication).where(
        TenantApplication.tenant_id == tenant.id,
        TenantApplication.application_slug == body.application_slug,
    ))
    if existing_res.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Esta aplicación ya está enlazada a este tenant")

    link = TenantApplication(
        tenant_id=tenant.id,
        application_slug=body.application_slug,
        application_name=body.application_name or body.application_slug,
        link_source="manual",
        is_confirmed=True,
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return {
        "id": str(link.id), "tenant_id": str(link.tenant_id),
        "application_slug": link.application_slug, "application_name": link.application_name,
        "link_source": link.link_source, "is_confirmed": link.is_confirmed,
    }


@router.delete("/applications/{link_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(verify_admin_key)])
async def delete_tenant_application(link_id: str, db: AsyncSession = Depends(get_db)):
    try:
        link_uuid = uuid.UUID(link_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="link_id inválido")

    res = await db.execute(select(TenantApplication).where(TenantApplication.id == link_uuid))
    link = res.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Enlace no encontrado")

    await db.delete(link)
    await db.commit()
