# Deployment: Authentik Login Designer (identity.casmart.internal)

Este documento describe cómo desplegar el Login Designer Angular + Backend FastAPI en el servidor **10.4.3.208** (identity.casmart.internal).

## Requisitos previos

- Servidor: `10.4.3.208` con usuario `authentik` (tiene acceso sudo)
- SSH key: `Wutb43r2`
- Directorio de instalación: `/opt/authentik-login-designer/`
- Docker y Docker Compose instalados en el servidor

## Estructura final en 10.4.3.208

```
/opt/authentik-login-designer/
├── frontend/                    ← Angular compilado + Dockerfile + Nginx
│   ├── Dockerfile
│   ├── nginx.conf
│   └── dist/frontend/browser/   ← Artefacto de build
├── backend/                     ← FastAPI backend (a ser creado)
│   ├── app/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── ...
├── docker-compose.yml
└── .env
```

## Paso 1: Preparar artefactos locales

El frontend ya está compilado en `/home/ia/ecosistema-casmarts/authentik-login-designer/frontend/dist/frontend/browser/`.

El backend FastAPI debe copiarse desde `authentik-login-manager` y adaptarse.

```bash
# Localmente, empacar todo para transferencia SSH
cd /home/ia/ecosistema-casmarts/authentik-login-designer
tar czf authentik-login-designer.tar.gz frontend/ compose.yml

# Transferir al servidor remoto (usando SCP con contraseña o clave)
# scp -i ~/.ssh/identity_key authentik-login-designer.tar.gz authentik@10.4.3.208:/tmp/
```

## Paso 2: Backend FastAPI (en 10.4.3.208)

### 2.1 Copiar y adaptar backend

```bash
ssh authentik@10.4.3.208

# Ir a /opt
cd /opt
sudo mkdir -p authentik-login-designer
sudo chown authentik:authentik authentik-login-designer
cd authentik-login-designer

# Descomprimir
tar xzf /tmp/authentik-login-designer.tar.gz
```

### 2.2 Crear backend FastAPI

El backend debe ser idéntico al de `authentik-login-manager` pero con su propia base de datos.

Copiar desde `authentik-login-manager/backend/` a `authentik-login-designer/backend/`.

**Cambios de configuración:**

- **DATABASE_URL**: Apuntar a BD PostgreSQL local (en 10.4.3.208 o en otro host)
  ```
  DATABASE_URL=postgresql+asyncpg://designer_user:password@localhost:5432/authentik_login_designer
  ```

- **REDIS/CACHE**: Usar Valkey/Redis local o del aura-network
  ```
  REDIS_URL=redis://localhost:6379/1  # O apuntar a casmarts-core-cache
  ```

- **CORS_ORIGINS**: Permitir `http://localhost:3000` y `https://identity.casmart.internal`
  ```
  CORS_ORIGINS=http://localhost:3000,https://identity.casmart.internal,http://localhost:80
  ```

- **ADMIN_API_KEY**: La misma clave que en environment.ts Angular
  ```
  ADMIN_API_KEY=casmarts_admin_super_secret_key_123
  ```

### 2.3 Dockerfile del backend

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Paso 3: PostgreSQL (en 10.4.3.208)

Crear BD para el designer:

```bash
sudo -u postgres psql <<EOF
CREATE DATABASE authentik_login_designer;
CREATE USER designer_user WITH PASSWORD 'securepass123';
ALTER ROLE designer_user SET client_encoding TO 'utf8';
ALTER ROLE designer_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE designer_user SET default_transaction_deferrable TO on;
ALTER ROLE designer_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE authentik_login_designer TO designer_user;
EOF
```

Ejecutar migraciones del backend:

```bash
cd /opt/authentik-login-designer/backend
python -m alembic upgrade head
```

## Paso 4: Docker Compose (10.4.3.208)

Crear `/opt/authentik-login-designer/docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: authentik-login-designer-backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://designer_user:securepass123@localhost:5432/authentik_login_designer
      REDIS_URL: redis://localhost:6379/1
      CORS_ORIGINS: http://localhost:3000,https://identity.casmart.internal
      ADMIN_API_KEY: casmarts_admin_super_secret_key_123
    restart: always
    depends_on:
      - postgres

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: authentik-login-designer-frontend
    ports:
      - "3000:80"
    restart: always

  postgres:
    image: postgres:16-alpine
    container_name: authentik-login-designer-db
    environment:
      POSTGRES_DB: authentik_login_designer
      POSTGRES_USER: designer_user
      POSTGRES_PASSWORD: securepass123
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: always

volumes:
  postgres_data:
```

## Paso 5: Nginx Gateway (10.4.3.208)

Crear `/etc/nginx/sites-available/identity.casmart.internal`:

```nginx
server {
    listen 443 ssl http2;
    server_name identity.casmart.internal;
    
    ssl_certificate /etc/ssl/certs/identity.crt;  # O certificado válido
    ssl_certificate_key /etc/ssl/private/identity.key;

    # Frontend (Angular)
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name identity.casmart.internal;
    return 301 https://$server_name$request_uri;
}
```

Habilitar:

```bash
sudo ln -s /etc/nginx/sites-available/identity.casmart.internal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Paso 6: Build y Deploy

```bash
cd /opt/authentik-login-designer

# Compilar imágenes Docker
docker-compose build

# Iniciar servicios
docker-compose up -d

# Verificar logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

## Paso 7: Verificación

1. **Frontend**: `https://identity.casmart.internal/` debe cargar la UI Angular
2. **Backend**: `https://identity.casmart.internal/api/v1/themes` debe retornar `[]` (vacío)
3. **Health Check**: 
   ```bash
   curl -X GET https://identity.casmart.internal/api/v1/themes/authentik/applications \
     -H "X-Admin-Key: casmarts_admin_super_secret_key_123"
   ```

## DNS

Asegurar que `identity.casmart.internal` resuelva a `10.4.3.208`:

```bash
# /etc/hosts
10.4.3.208  identity.casmart.internal
```

O en el DNS corporativo, agregar entrada A:
```
identity.casmart.internal  A  10.4.3.208
```

## Notas importantes

- La BD, Redis y servicios corren en el mismo servidor (10.4.3.208)
- El `ADMIN_API_KEY` debe coincidir entre `environment.ts` (Angular) y `.env` (Backend)
- Nginx actúa como reverse proxy en el puerto 443 (HTTPS)
- No hay conexión con el backend de `loginmanager` — son independientes
- Los temas del Login Designer se guardan en `authentik_login_designer` BD, NO en la BD de login-manager
