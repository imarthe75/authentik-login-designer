# Deployment: Authentik Login Designer (identity.casmart.internal)

Desplegar el Login Designer Angular + Backend FastAPI en el servidor **10.4.3.208** (identity.casmart.internal).

**Código fuente**: http://gitlab.casmart.internal/arquitectura/authentik-login-designer

## Requisitos previos

- Servidor: `10.4.3.208` con usuario `authentik` (acceso sudo)
- Docker y Docker Compose instalados
- SSH access (clave o contraseña)
- Git instalado

## Estructura final en 10.4.3.208

```
/opt/authentik-login-designer/
├── frontend/                    ← Angular compilado
│   ├── dist/
│   ├── Dockerfile
│   └── nginx.conf
├── backend/                     ← FastAPI
│   ├── app/
│   ├── alembic/
│   ├── Dockerfile
│   └── requirements.txt
├── docker-compose.yml
├── deploy.sh
├── health-check.sh
├── .env                         ← Creado durante deploy
└── README.md, DEPLOYMENT.md
```

## Paso 1: Clonar desde GitLab (en 10.4.3.208)

```bash
ssh authentik@10.4.3.208
cd /opt
sudo mkdir -p authentik-login-designer
sudo chown authentik:authentik authentik-login-designer
cd authentik-login-designer

# Clonar el proyecto completo desde GitLab
git clone http://gitlab.casmart.internal/arquitectura/authentik-login-designer .
```

## Paso 2: Configurar variables de entorno

Crear `/opt/authentik-login-designer/.env`:

```bash
# Database
DATABASE_URL=postgresql+asyncpg://designer_user:${DB_PASSWORD}@postgres:5432/authentik_login_designer

# Cache
VALKEY_URL=redis://valkey:6379/1

# Security (⚠️ CAMBIAR EN PRODUCCIÓN)
ADMIN_API_KEY=${ADMIN_API_KEY}

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:80,https://identity.casmart.internal

# Base URL
PUBLIC_API_BASE_URL=https://identity.casmart.internal
```

**Reemplazar placeholders:**
- `${DB_PASSWORD}` — Contraseña segura para PostgreSQL
- `${ADMIN_API_KEY}` — Clave admin fuerte (generar con: `openssl rand -hex 24`)

Ejemplo:
```bash
cat > .env <<EOF
DATABASE_URL=postgresql+asyncpg://designer_user:TuContraseñaSegura123!@postgres:5432/authentik_login_designer
VALKEY_URL=redis://valkey:6379/1
ADMIN_API_KEY=7f8e9d1c2b3a4f5e6d7c8b9a0f1e2d3c
CORS_ORIGINS=http://localhost:3000,http://localhost:80,https://identity.casmart.internal
PUBLIC_API_BASE_URL=https://identity.casmart.internal
EOF
```

## Paso 3: Deploy automatizado

```bash
cd /opt/authentik-login-designer

# Dar permisos de ejecución
chmod +x deploy.sh health-check.sh

# Ejecutar deployment
./deploy.sh
```

Este script:
- ✓ Verifica Docker
- ✓ Compila imágenes
- ✓ Inicia servicios (postgres, backend, frontend, valkey)
- ✓ Ejecuta migraciones de BD
- ✓ Verifica salud de servicios

## Paso 4: Configurar Nginx Gateway

Copiar configuración del proyecto y habilitar:

```bash
sudo cp /opt/authentik-login-designer/nginx-gateway.conf \
  /etc/nginx/sites-available/identity.casmart.internal

sudo ln -s /etc/nginx/sites-available/identity.casmart.internal \
  /etc/nginx/sites-enabled/

sudo nginx -t
sudo systemctl reload nginx
```

## Paso 5: Certificados SSL (producción)

### Opción A: Autofirmado (testing)
```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/identity.key \
  -out /etc/ssl/certs/identity.crt \
  -subj "/CN=identity.casmart.internal"
```

### Opción B: Let's Encrypt (producción)
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot certonly --standalone -d identity.casmart.internal
# Actualizar paths en nginx-gateway.conf → /etc/letsencrypt/live/...
```

## Paso 6: DNS

Asegurar que `identity.casmart.internal` resuelva a `10.4.3.208`:

```bash
# Opción 1: /etc/hosts local
echo "10.4.3.208  identity.casmart.internal" | sudo tee -a /etc/hosts

# Opción 2: DNS corporativo (agregar registro A)
identity.casmart.internal  A  10.4.3.208
```

## Paso 7: Verificación

```bash
cd /opt/authentik-login-designer

# Health check automatizado
./health-check.sh https://identity.casmart.internal

# O verificar manualmente
curl https://identity.casmart.internal/  # Frontend
curl https://identity.casmart.internal/health  # Backend health

# API themes (reemplaza ${ADMIN_API_KEY} con el valor de .env)
curl -H "X-Admin-Key: ${ADMIN_API_KEY}" \
  https://identity.casmart.internal/api/v1/themes
```

## Resumen de comandos deployment

```bash
# 1. Clonar (en 10.4.3.208)
cd /opt && sudo mkdir authentik-login-designer && cd authentik-login-designer
git clone http://gitlab.casmart.internal/arquitectura/authentik-login-designer .

# 2. Configurar .env
cat > .env << 'EOF'
DATABASE_URL=postgresql+asyncpg://designer_user:TuPassword@postgres:5432/authentik_login_designer
VALKEY_URL=redis://valkey:6379/1
ADMIN_API_KEY=$(openssl rand -hex 24)
CORS_ORIGINS=http://localhost:3000,http://localhost:80,https://identity.casmart.internal
PUBLIC_API_BASE_URL=https://identity.casmart.internal
EOF

# 3. Deploy
chmod +x deploy.sh && ./deploy.sh

# 4. Nginx + SSL (ver pasos 4-5 arriba)

# 5. Verificar
./health-check.sh https://identity.casmart.internal
```

## Notas importantes

- **Código fuente**: http://gitlab.casmart.internal/arquitectura/authentik-login-designer (rama `main`)
- **Infraestructura separada**: BD, cache, servicios completamente independientes del login-manager
- **ADMIN_API_KEY**: CAMBIAR en producción (generar con `openssl rand -hex 24`)
- **Base de datos**: `authentik_login_designer` (no compartida con login-manager)
- **Nginx**: Reverse proxy en puerto 443 (HTTPS obligatorio en producción)
- **Ambiente de desarrollo**: Ver QUICK-START.md para setup local
