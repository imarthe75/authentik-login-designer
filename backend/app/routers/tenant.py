import logging
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.config import settings
from app.models.tenant import Tenant
from app.routers.admin import verify_admin_key

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


class TenantSettingsUpdate(BaseModel):
    default_app_url: Optional[str] = None

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
    return {"default_app_url": (tenant.config or {}).get("default_app_url")}


@router.patch("/settings", dependencies=[Depends(verify_admin_key)])
async def update_tenant_settings(body: TenantSettingsUpdate, db: AsyncSession = Depends(get_db)):
    tenant = await _get_default_tenant(db)
    if not tenant:
        raise HTTPException(status_code=404, detail="Default tenant not configured.")
    new_config = dict(tenant.config or {})
    new_config["default_app_url"] = body.default_app_url
    tenant.config = new_config
    await db.commit()
    return {"default_app_url": tenant.config.get("default_app_url")}


@router.get("/list")
async def list_available_tenants(db: AsyncSession = Depends(get_db)):
    """Lista tenants activos — mismo contrato público que el manager (sin
    datos sensibles: solo nombre/dominio/colores)."""
    try:
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
