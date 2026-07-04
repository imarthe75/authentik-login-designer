import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
from app.cache import cache
from app.routers.password_policy import router as password_policy_router
from app.routers import admin, public, tenant

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing cache client...")
    cache.connect()

    logger.info("Verifying database connectivity...")
    from sqlalchemy import text
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))
        logger.info("Database connectivity established.")

    yield

    logger.info("Shutting down cache client connection...")
    await cache.close()
    logger.info("FastAPI application stopped cleanly.")

app = FastAPI(
    title="Authentik Login Designer SaaS API",
    description="SaaS core REST API to visually design and persist dynamic portal themes for Authentik Flows.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-Admin-Key", "Authorization", "X-Tenant-Domain"],
)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    # Respuestas de este servicio son JSON/HTML de previsualización, nunca HTML de
    # terceros ejecutable como top-level document — CSP restrictiva por defecto.
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    return response

app.include_router(admin.router)
app.include_router(public.router)
app.include_router(tenant.router)
app.include_router(password_policy_router)

@app.get("/health", status_code=status.HTTP_200_OK, tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "cache": "connected" if cache.redis is not None else "disconnected"
    }
