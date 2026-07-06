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
    # backend manager) y `tenant_themes.tenant_id` es NOT NULL sin default —
    # se usa este UUID fijo (tenant CASMARTS sembrado por esa migración) al
    # crear temas nuevos. Ver models/tenant_theme.py.
    DEFAULT_TENANT_ID: str = "00000000-0000-0000-0000-000000000001"
    # Conexión a la API de Authentik — MISMA instancia que authentik-login-manager
    # (un solo auth.casmart.internal), solo para el editor de política de
    # contraseña (GET/PATCH PasswordPolicy + Prompt.sub_text). Este backend no
    # tenía credenciales de Authentik antes de esta feature.
    AUTHENTIK_HOST: str = ""
    AUTHENTIK_API_TOKEN: str = ""

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
