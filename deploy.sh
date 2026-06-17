#!/bin/bash
# Automated deployment script for 10.4.3.208
# Run this on the remote server AFTER files are transferred

set -e

DEPLOY_PATH="/opt/authentik-login-designer"
DOCKER_COMPOSE="docker-compose"

echo "🚀 Starting Authentik Login Designer deployment..."
echo "📍 Deploy path: $DEPLOY_PATH"
echo ""

# Check if Docker is running
echo "🔍 Checking Docker daemon..."
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker daemon not running!"
    echo "   Run: sudo systemctl start docker"
    exit 1
fi

# Check docker-compose
echo "🔍 Checking docker-compose..."
if ! command -v $DOCKER_COMPOSE &> /dev/null; then
    echo "⚠️  docker-compose not found, trying docker compose..."
    DOCKER_COMPOSE="docker compose"
fi

cd "$DEPLOY_PATH"

# 1. Verify directory structure
echo ""
echo "📁 Verifying directory structure..."
required_dirs=(
    "frontend/dist"
    "backend/app"
    "backend/alembic"
)
for dir in "${required_dirs[@]}"; do
    if [ ! -d "$dir" ]; then
        echo "❌ Missing directory: $dir"
        exit 1
    fi
done
echo "✓ All directories present"

# 2. Check .env file
echo ""
echo "📝 Checking .env configuration..."
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found, creating from template..."
    if [ -f ".env.template" ]; then
        cp .env.template .env
        echo "✓ Created .env from template"
    else
        echo "❌ .env.template not found!"
        exit 1
    fi
fi

# 3. Build Docker images
echo ""
echo "🏗️  Building Docker images..."
echo "   This may take 2-3 minutes..."
$DOCKER_COMPOSE build --pull

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed!"
    exit 1
fi
echo "✓ Images built successfully"

# 4. Start services
echo ""
echo "🐳 Starting Docker Compose services..."
$DOCKER_COMPOSE up -d

if [ $? -ne 0 ]; then
    echo "❌ Failed to start services!"
    $DOCKER_COMPOSE logs
    exit 1
fi
echo "✓ Services started"

# 5. Wait for PostgreSQL to be healthy
echo ""
echo "⏳ Waiting for PostgreSQL to be ready..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if $DOCKER_COMPOSE exec -T postgres pg_isready -U designer_user -d authentik_login_designer >/dev/null 2>&1; then
        echo "✓ PostgreSQL ready"
        break
    fi
    attempt=$((attempt + 1))
    echo -n "."
    sleep 1
done

if [ $attempt -eq $max_attempts ]; then
    echo ""
    echo "❌ PostgreSQL failed to start!"
    $DOCKER_COMPOSE logs postgres
    exit 1
fi

# 6. Wait for Valkey
echo ""
echo "⏳ Waiting for Valkey to be ready..."
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if $DOCKER_COMPOSE exec -T valkey redis-cli ping | grep -q PONG; then
        echo "✓ Valkey ready"
        break
    fi
    attempt=$((attempt + 1))
    echo -n "."
    sleep 1
done

if [ $attempt -eq $max_attempts ]; then
    echo ""
    echo "⚠️  Valkey timeout (may still work)"
fi

# 7. Run database migrations
echo ""
echo "🗄️  Running database migrations..."
if $DOCKER_COMPOSE exec -T backend python -m alembic upgrade head; then
    echo "✓ Migrations completed"
else
    echo "⚠️  Migration may have already run or encountered non-critical error"
fi

# 8. Wait for backend
echo ""
echo "⏳ Waiting for backend to be ready..."
max_attempts=20
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:8000/health >/dev/null 2>&1; then
        echo "✓ Backend ready"
        break
    fi
    attempt=$((attempt + 1))
    echo -n "."
    sleep 1
done

if [ $attempt -eq $max_attempts ]; then
    echo ""
    echo "⚠️  Backend health check timeout"
fi

# 9. Display service status
echo ""
echo "📊 Service Status:"
echo ""
$DOCKER_COMPOSE ps

# 10. Health checks
echo ""
echo "🏥 Running health checks..."
echo ""

# Backend health
echo -n "  Backend health: "
if curl -s http://localhost:8000/health >/dev/null 2>&1; then
    echo "✓ OK"
else
    echo "⚠️  Not responding"
fi

# Frontend
echo -n "  Frontend: "
if curl -s http://localhost:3000 >/dev/null 2>&1; then
    echo "✓ OK"
else
    echo "⚠️  Not responding"
fi

# Database
echo -n "  Database: "
if $DOCKER_COMPOSE exec -T postgres pg_isready -U designer_user >/dev/null 2>&1; then
    echo "✓ OK"
else
    echo "❌ Not responding"
fi

# Cache
echo -n "  Cache: "
if $DOCKER_COMPOSE exec -T valkey redis-cli ping 2>/dev/null | grep -q PONG; then
    echo "✓ OK"
else
    echo "⚠️  Not responding"
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Access URLs:"
echo "   Frontend: http://localhost:3000"
echo "   API: http://localhost:8000/api/v1/themes"
echo "   Health: http://localhost:8000/health"
echo ""
echo "📋 Next steps:"
echo "   1. Configure Nginx gateway (copy nginx-gateway.conf)"
echo "   2. Create SSL certificates"
echo "   3. Update /etc/hosts or DNS for auth.casmart.internal"
echo "   4. Test: curl https://auth.casmart.internal/health"
echo ""
echo "📖 View logs:"
echo "   docker-compose logs -f [service_name]"
echo "   Services: backend, frontend, postgres, valkey"
echo ""
