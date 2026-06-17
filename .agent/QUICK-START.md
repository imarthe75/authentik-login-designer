# 🚀 Quick Start: Authentik Login Designer

Complete deployment guide for auth.casmart.internal on 10.4.3.208  
**Código fuente**: http://gitlab.casmart.internal/arquitectura/authentik-login-designer

## 📋 Prerequisites

- Server: `10.4.3.208` with user `authentik` (sudo access)
- Docker & Docker Compose installed
- SSH access
- Git installed
- Nginx installed (para reverse proxy)

## ⚡ Fast Track (5 minutes)

### On 10.4.3.208:

```bash
# 1. Clone from GitLab
cd /opt
sudo mkdir authentik-login-designer && cd authentik-login-designer
sudo chown authentik:authentik .
git clone http://gitlab.casmart.internal/arquitectura/authentik-login-designer .

# 2. Create .env file (update DB_PASSWORD and ADMIN_API_KEY)
cat > .env <<'EOF'
DATABASE_URL=postgresql+asyncpg://designer_user:ChangeMe123!@postgres:5432/authentik_login_designer
VALKEY_URL=redis://valkey:6379/1
ADMIN_API_KEY=ChangeMe_AdminKey_123
CORS_ORIGINS=http://localhost:3000,http://localhost:80,https://auth.casmart.internal
PUBLIC_API_BASE_URL=https://auth.casmart.internal
EOF

# 3. Deploy services
chmod +x deploy.sh
./deploy.sh

# 4. Configure Nginx (in another terminal or after deploy)
sudo cp nginx-gateway.conf /etc/nginx/sites-available/auth.casmart.internal
sudo ln -s /etc/nginx/sites-available/auth.casmart.internal /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

That's it! Services are now running.

## ✅ Verify Deployment

```bash
# Check containers
docker-compose ps

# Check health
curl http://localhost:8000/health

# View logs
docker-compose logs -f backend
```

## 🌐 Configure Nginx Gateway

```bash
# 1. Copy Nginx config
sudo cp nginx-gateway.conf /etc/nginx/sites-available/auth.casmart.internal

# 2. Create symlink
sudo ln -s /etc/nginx/sites-available/auth.casmart.internal \
  /etc/nginx/sites-enabled/

# 3. Test Nginx config
sudo nginx -t

# 4. Reload Nginx
sudo systemctl reload nginx
```

## 🔒 SSL Certificates

### Using self-signed (testing):

```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/identity.key \
  -out /etc/ssl/certs/identity.crt \
  -subj "/CN=auth.casmart.internal"
```

### Using Let's Encrypt (production):

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot certonly --standalone -d auth.casmart.internal
# Update nginx-gateway.conf paths to /etc/letsencrypt/live/...
```

## 🔌 DNS Configuration

### Option 1: /etc/hosts (local/testing)

```bash
echo "10.4.3.208  auth.casmart.internal" | sudo tee -a /etc/hosts
```

### Option 2: Corporate DNS

Add A record:
```
auth.casmart.internal  →  10.4.3.208
```

## 🧪 Test Everything

```bash
# Run health check
chmod +x health-check.sh
./health-check.sh https://auth.casmart.internal

# Or manual tests
curl -H "X-Admin-Key: casmarts_admin_super_secret_key_123" \
  https://auth.casmart.internal/api/v1/themes

# Create a test theme
curl -X POST \
  -H "X-Admin-Key: casmarts_admin_super_secret_key_123" \
  -H "Content-Type: application/json" \
  -d '{
    "authentik_flow_slug": "default-authentication-flow",
    "display_name": "Test Theme",
    "system_name": "Portal de Prueba",
    "system_subtitle": "Test Subtitle",
    "primary_color": "#1976d2",
    "hover_color": "#2196f3"
  }' \
  https://auth.casmart.internal/api/v1/themes
```

## 📁 File Structure on Server

```
/opt/authentik-login-designer/
├── frontend/
│   ├── dist/                    ← Angular compiled
│   ├── Dockerfile
│   └── nginx.conf
├── backend/
│   ├── app/                     ← FastAPI code
│   ├── alembic/                 ← Migrations
│   ├── Dockerfile
│   └── requirements.txt
├── docker-compose.yml
├── .env                         ← Environment (created)
└── DEPLOYMENT.md
```

## 🔑 Environment Variables

Required in `.env`:

```env
DATABASE_URL=postgresql+asyncpg://designer_user:${DB_PASSWORD}@postgres:5432/authentik_login_designer
ADMIN_API_KEY=${ADMIN_API_KEY}
VALKEY_URL=redis://valkey:6379/1
CORS_ORIGINS=http://localhost:3000,https://auth.casmart.internal,http://localhost:80
PUBLIC_API_BASE_URL=https://auth.casmart.internal
```

**Generar valores seguros:**
```bash
# Contraseña DB (16+ caracteres, complejos)
openssl rand -base64 24

# Admin API Key (32 hex chars)
openssl rand -hex 16
```

**⚠️ CRÍTICO**: 
- NO usar valores por defecto en producción
- NO compartir `.env` en repositorio (ya está en .gitignore)
- NO exponer ADMIN_API_KEY en logs o documentación pública

## 📊 Service Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Backend API | 8000 | http://localhost:8000 |
| PostgreSQL | 5432 | postgres://localhost:5432 |
| Valkey Cache | 6379 | redis://localhost:6379 |
| Nginx Gateway | 80/443 | https://auth.casmart.internal |

## 🐛 Troubleshooting

### Services won't start

```bash
# Check logs
docker-compose logs

# Check resource usage
docker stats

# Rebuild images
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Database connection error

```bash
# Check PostgreSQL
docker-compose logs postgres

# Test connection
docker exec authentik-login-designer-db \
  psql -U designer_user -d authentik_login_designer -c "SELECT 1"

# Check migrations
docker exec authentik-login-designer-backend \
  python -m alembic current
```

### Frontend not loading

```bash
# Check Nginx
docker-compose logs frontend

# Test frontend directly
curl http://localhost:3000

# Check SPA routing
curl -I http://localhost:3000/some-path
```

### Admin key issues

```bash
# Verify key in .env
grep ADMIN_API_KEY /opt/authentik-login-designer/.env

# Test with curl
curl -H "X-Admin-Key: YOUR_KEY" \
  http://localhost:8000/api/v1/themes
```

## 📚 Detailed Documentation

- **DEPLOYMENT.md** — Full step-by-step deployment
- **docker-compose.yml** — Service configuration
- **nginx-gateway.conf** — Reverse proxy setup

## 🆘 Support Commands

```bash
# View all logs
docker-compose logs

# Specific service logs
docker-compose logs -f backend

# Shell into backend
docker exec -it authentik-login-designer-backend bash

# Database shell
docker exec -it authentik-login-designer-db psql -U designer_user

# Clear all (careful!)
docker-compose down -v
docker-compose up -d
```

## 🎯 Next Steps

1. ✓ Deploy services
2. ✓ Configure Nginx
3. ✓ Setup SSL certificates
4. ✓ Verify DNS
5. **Access**: https://auth.casmart.internal
6. **Login Admin Panel**: UI at root path
7. **Create themes**: Through admin interface
8. **Deploy to Authentik**: Click "Deploy" button

---

**Questions?** Check logs, run health-check.sh, or review DEPLOYMENT.md for detailed information.
