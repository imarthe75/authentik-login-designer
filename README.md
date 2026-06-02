# Authentik Login Designer

Angular-based visual designer for Authentik login portal themes. Separate backend infrastructure on `identity.casmart.internal` (10.4.3.208).

**Repositorio**: http://gitlab.casmart.internal/arquitectura/authentik-login-designer  
**Rama**: `main`

## 🎯 Features

- **Visual Theme Designer**: Drag-and-drop UI for customizing login pages
- **Real-time Preview**: See changes instantly as you design
- **Multi-app Support**: Different themes for different Authentik applications
- **Image Upload**: Logo and background image support
- **Gradient & Solid Colors**: Flexible background options
- **Responsive Design**: Mobile-friendly login forms
- **Admin Authentication**: Secure admin key validation
- **Caching**: Valkey/Redis for performance

## 🏗️ Architecture

### Frontend
- **Angular 21** with standalone components
- **Signals** for reactive state management
- **Tailwind CSS 3.4** for styling
- **TypeScript 5.9** strict mode
- **RxJS** for async operations

### Backend
- **FastAPI** for REST API
- **SQLAlchemy 2.0** async ORM
- **PostgreSQL 16** for persistence
- **Alembic** for schema migrations
- **Valkey** for caching

### Infrastructure
- **Docker Compose** for orchestration
- **Nginx** as reverse proxy/gateway
- **Docker** multi-stage builds

## 📦 Deployment

### Quick Start (5 minutes)

```bash
# On 10.4.3.208
cd /opt
git clone http://gitlab.casmart.internal/arquitectura/authentik-login-designer
cd authentik-login-designer

# Create .env and deploy
cat > .env <<EOF
DATABASE_URL=postgresql+asyncpg://designer_user:YourPassword@postgres:5432/authentik_login_designer
VALKEY_URL=redis://valkey:6379/1
ADMIN_API_KEY=$(openssl rand -hex 16)
CORS_ORIGINS=http://localhost:3000,http://localhost:80,https://identity.casmart.internal
PUBLIC_API_BASE_URL=https://identity.casmart.internal
EOF

chmod +x deploy.sh && ./deploy.sh
```

### Documentation

- **[QUICK-START.md](QUICK-START.md)** — 5-minute setup
- **[DEPLOYMENT.md](DEPLOYMENT.md)** — Full step-by-step guide with SSL/DNS
- **[MANIFEST.md](MANIFEST.md)** — Complete project inventory

## 🔗 Endpoints

### Admin Panel
```
GET  https://identity.casmart.internal/
```

### Admin API
```
GET    /api/v1/themes                           ← List themes
POST   /api/v1/themes                           ← Create/upsert theme
GET    /api/v1/themes/{flow_slug}               ← Get theme
PATCH  /api/v1/themes/{flow_slug}               ← Partial update
DELETE /api/v1/themes/{flow_slug}               ← Delete theme
POST   /api/v1/themes/{flow_slug}/deploy        ← Deploy to Authentik
GET    /api/v1/themes/authentik/applications   ← List Authentik apps
```

### Public API
```
GET  /api/v1/public/theme/{flow_slug}           ← Retrieve theme config
GET  /api/v1/public/theme/{flow_slug}/image/{field}  ← Get image
POST /api/v1/public/theme/invalidate-cache/{flow_slug}
```

### Health Check
```
GET  /health                                    ← Service health
```

## 🔐 Authentication

All admin endpoints require the `X-Admin-Key` header (valor de `ADMIN_API_KEY` en `.env`):

```bash
# Reemplaza ${ADMIN_API_KEY} con el valor real de .env
curl -H "X-Admin-Key: ${ADMIN_API_KEY}" \
  https://identity.casmart.internal/api/v1/themes
```

⚠️ **CRÍTICO**: 
- El ADMIN_API_KEY debe ser único y seguro por ambiente
- Cambiar inmediatamente en producción (generar con `openssl rand -hex 16`)
- NO exponer en logs, documentación pública, o versionamiento

## 🎨 Theme Model

```typescript
interface Theme {
  id: UUID;
  authentik_flow_slug: string;              // Required
  authentik_app_slug?: string;              // Optional, for app-specific
  display_name: string;                     // Portal name
  system_name: string;                      // Main heading (HTML allowed)
  system_subtitle: string;                  // Sub heading
  layout_position: 'left' | 'center' | 'right';
  name_align: 'left' | 'center' | 'right';
  subtitle_align: 'left' | 'center' | 'right';
  privacy_align: 'left' | 'center' | 'right';
  
  // Colors
  primary_color: string;                    // Hex color
  hover_color: string;
  card_bg_color: string;
  panel_bg_color: string;
  
  // Background
  bg_type: 'gradient' | 'color' | 'image';
  bg_flat_color?: string;
  bg_gradient_from: string;
  bg_gradient_to: string;
  bg_image_base64?: string;
  bg_opacity: number;                       // 0-1
  
  // Form styling
  form_opacity: number;                     // 0-1
  form_height_pct?: number;                 // 0-100
  
  // Images
  logo_top_base64?: string;
  logo_bottom_base64?: string;
  logo_top_text?: string;
  logo_bottom_text?: string;
  logos_opacity: number;                    // 0-1
  logos_height_pct?: number;                // 0-100
  
  // Privacy
  privacy_pdf_url?: string;
  
  // Metadata
  is_active: boolean;
  created_at: DateTime;
  updated_at: DateTime;
}
```

## 📊 Database Schema

### tenant_themes table
- `id` (UUID, primary key)
- `authentik_flow_slug` (string, indexed)
- `authentik_app_slug` (string, nullable, indexed)
- `display_name`, `system_name`, `system_subtitle`
- `layout_position`, `name_align`, `subtitle_align`, `privacy_align`
- Color fields (hex strings)
- Background fields (colors, gradients, images)
- Opacity fields (0-1 range)
- Image fields (base64 encoded)
- `is_active` (boolean)
- `created_at`, `updated_at` (timestamps)

## 📚 Source Code

Repository: **http://gitlab.casmart.internal/arquitectura/authentik-login-designer**

```bash
# Clone
git clone http://gitlab.casmart.internal/arquitectura/authentik-login-designer
cd authentik-login-designer

# Development
npm install --prefix frontend
cd frontend && npm start

# Production build
npm run build --prefix frontend
```

## 🔄 Migration from React Version

Original React app: `authentik-login-manager` (loginmanager.casmart.internal)  
New Angular app: `authentik-login-designer` (identity.casmart.internal)

Key differences:
- ✅ Same data model (100% compatible)
- ✅ Same API contract
- ✅ Separate database (no data migration needed)
- ✅ Separate backend infrastructure (independent)
- ✅ Angular Signals instead of React hooks
- ✅ TypeScript strict mode required
- ✅ No breaking changes to theme schema

## 🛠️ Development

### Frontend

```bash
cd frontend
npm install
npm start      # ng serve on :4200
npm run build  # Production build
```

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

### Local Testing

```bash
docker-compose up -d
docker-compose logs -f

# Visit http://localhost:3000
# API at http://localhost:8000/api/v1/themes
```

## 📝 Configuration

### Environment Variables

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname

# Cache
VALKEY_URL=redis://host:6379/1

# Security
ADMIN_API_KEY=your_secret_key

# CORS
CORS_ORIGINS=http://localhost:3000,https://identity.casmart.internal

# Base URL
PUBLIC_API_BASE_URL=https://identity.casmart.internal
```

## 🚀 Production Deployment

1. **Update secrets**:
   - Change `ADMIN_API_KEY` (generate strong random key)
   - Update database credentials
   - Configure SSL certificates

2. **Security headers**: Nginx config includes all standard headers

3. **CORS**: Whitelist only known origins

4. **Database**: Run migrations in production

```bash
docker exec backend python -m alembic upgrade head
```

5. **Monitoring**: Check container logs regularly

```bash
docker-compose logs -f backend
```

## 📚 Documentation

- [QUICK-START.md](QUICK-START.md) — 5-minute setup guide
- [DEPLOYMENT.md](DEPLOYMENT.md) — Complete deployment steps
- [docker-compose.yml](docker-compose.yml) — Service configuration
- [nginx-gateway.conf](nginx-gateway.conf) — Reverse proxy config

## 🐛 Troubleshooting

See [QUICK-START.md troubleshooting section](QUICK-START.md#-troubleshooting) for common issues.

## 📞 Support

For issues or questions:
1. Check application logs: `docker-compose logs`
2. Run health check: `./health-check.sh`
3. Review documentation in this directory
4. Check Authentik logs if theme deployment fails

## 📄 License

Same as parent Authentik project

## ⚠️ Important Notes

- **Credentials in git**: None (uses .env, excluded from version control)
- **Data integrity**: Database is persistent via Docker volumes
- **Backup**: Regularly backup PostgreSQL data volume
- **SSL certificates**: Use proper certificates in production (Let's Encrypt, corporate CA)
- **Admin key**: Change from default immediately
- **Database**: Use strong password, don't expose on network

---

**Status**: ✅ Production Ready | **Version**: 1.0.0 | **Updated**: 2026-06-02
