import os
import secrets
import logging
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator

class Settings(BaseSettings):
    DATABASE_URL: str
    VALKEY_URL: str
    ADMIN_API_KEY: str = ""
    # Firma las cookies de sesión de admin emitidas por /api/v1/auth/login.
    # Deliberadamente separado de ADMIN_API_KEY: este secreto nunca se envía
    # a un cliente ni se compara contra input de usuario, solo firma/valida
    # tokens del lado del servidor.
    SESSION_SECRET: str = ""
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    PUBLIC_API_BASE_URL: str = "http://localhost:8000"
    # SMTP para envío de correos de prueba
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_TLS: bool = True
    # Este backend es single-tenant por diseño (a diferencia de
    # authentik-login-manager, que resuelve tenant por dominio). La tabla
    # `tenants` es compartida (misma DB física, migración 011_add_tenants del
    # backend manager) y `tenant_themes.tenant_id`/`tenant_email_bodies.tenant_id`
    # son NOT NULL con FK real a `tenants.id` — se usa este UUID fijo al crear
    # filas nuevas. Ver models/tenant_theme.py.
    #
    # CORREGIDO 2026-11-03: el valor anterior
    # (00000000-0000-0000-0000-000000000001) no corresponde a NINGÚN tenant
    # real — verificado contra la tabla `tenants` en vivo. Debía ser el ID
    # real del tenant "CASmartS ID" (domain_pattern=authentik-default), el
    # mismo DEFAULT_TENANT_UUID que ya usa authentik-login-manager en
    # app/utils/tenant.py. Con el valor viejo, CUALQUIER intento de crear un
    # tema o cuerpo de email nuevo desde cero (no editar uno ya existente)
    # fallaba con IntegrityError (ForeignKeyViolationError) — confirmado en
    # vivo al validar el fix de tenant_id en email_body.py.
    DEFAULT_TENANT_ID: str = "29843c3b-ca94-4a8d-a007-77e634081b0a"
    # Conexión a la API de Authentik — MISMA instancia que authentik-login-manager
    # (un solo auth.casmart.internal). Usada por el editor de política de
    # contraseña (GET/PATCH PasswordPolicy + Prompt.sub_text + ReputationPolicy
    # de bloqueo), por el favicon→Brand nativo, y por el receptor de webhooks
    # de eventos reales.
    AUTHENTIK_HOST: str = ""
    AUTHENTIK_API_TOKEN: str = ""
    # Hostname Docker del gateway/reverse-proxy confiable — solo relevante si
    # algún día este backend llega a confiar en headers de origen (hoy no:
    # es single-tenant, ver DEFAULT_TENANT_ID arriba). Se agrega igual por
    # paridad con el mismo setting en authentik-login-manager, en caso de que
    # algún helper portado desde ahí lo referencie.
    TRUSTED_PROXY_HOST: str = "casmarts-core-gateway"
    # Secreto compartido que Authentik debe enviar en el header X-Webhook-Secret
    # al llamar a /api/v1/webhooks/authentik-event (routers/authentik_events.py)
    # — no confundir con ADMIN_API_KEY.
    AUTHENTIK_WEBHOOK_SECRET: str = ""

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @field_validator("ADMIN_API_KEY", mode="after")
    @classmethod
    def validate_api_key(cls, v: str) -> str:
        if not v:
            # Fallback securely as defined by mandatory-secure-web-skills guidelines:
            logging.warning("Generating ephemeral ADMIN_API_KEY. Instance-isolated!")
            return secrets.token_hex(32)
        return v

    @field_validator("SESSION_SECRET", mode="after")
    @classmethod
    def validate_session_secret(cls, v: str) -> str:
        if not v:
            logging.warning("Generating ephemeral SESSION_SECRET. Instance-isolated!")
            return secrets.token_hex(32)
        return v

    @property
    def cors_origins_list(self) -> List[str]:
        origins = [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        if "*" in origins:
            # allow_credentials=True + wildcard origin es una combinación CORS
            # inválida/peligrosa (cualquier sitio podría hacer requests autenticados
            # cross-origin). Fail closed al default seguro en vez de desplegar
            # silenciosamente inseguro.
            logging.error(
                "CORS_ORIGINS contains '*' with allow_credentials=True — refusing to "
                "use wildcard. Falling back to localhost-only origins. Set explicit "
                "origins in CORS_ORIGINS."
            )
            return ["http://localhost:3000", "http://127.0.0.1:3000"]
        return origins

settings = Settings()
