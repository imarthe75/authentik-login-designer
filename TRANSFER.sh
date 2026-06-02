#!/bin/bash
# Transfer Authentik Login Designer to 10.4.3.208
# Usage: ./TRANSFER.sh

set -e

REMOTE_HOST="10.4.3.208"
REMOTE_USER="authentik"
REMOTE_SSH_KEY="Wutb43r2"  # SSH password/key
REMOTE_PATH="/opt/authentik-login-designer"
LOCAL_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Transferring Authentik Login Designer to $REMOTE_HOST..."
echo ""

# 1. Create remote directory
echo "📁 Creating remote directory..."
sshpass -p "$REMOTE_SSH_KEY" ssh -o StrictHostKeyChecking=no \
  "$REMOTE_USER@$REMOTE_HOST" \
  "sudo mkdir -p $REMOTE_PATH && sudo chown $REMOTE_USER:$REMOTE_USER $REMOTE_PATH"

# 2. Package frontend (already compiled)
echo "📦 Packaging frontend (dist only)..."
cd "$LOCAL_PATH/frontend"
tar czf /tmp/frontend-dist.tar.gz dist/ Dockerfile nginx.conf package.json

# 3. Package backend
echo "📦 Packaging backend..."
cd "$LOCAL_PATH/backend"
tar czf /tmp/backend.tar.gz \
  app/ alembic/ \
  Dockerfile requirements.txt alembic.ini .env.example

# 4. Transfer files
echo "📤 Transferring to $REMOTE_HOST..."
sshpass -p "$REMOTE_SSH_KEY" scp -o StrictHostKeyChecking=no \
  /tmp/frontend-dist.tar.gz \
  "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/"

sshpass -p "$REMOTE_SSH_KEY" scp -o StrictHostKeyChecking=no \
  /tmp/backend.tar.gz \
  "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/"

sshpass -p "$REMOTE_SSH_KEY" scp -o StrictHostKeyChecking=no \
  "$LOCAL_PATH/docker-compose.yml" \
  "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/"

sshpass -p "$REMOTE_SSH_KEY" scp -o StrictHostKeyChecking=no \
  "$LOCAL_PATH/.env.template" \
  "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/"

sshpass -p "$REMOTE_SSH_KEY" scp -o StrictHostKeyChecking=no \
  "$LOCAL_PATH/DEPLOYMENT.md" \
  "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/"

# 5. Extract on remote
echo "🔧 Extracting archives on remote..."
sshpass -p "$REMOTE_SSH_KEY" ssh -o StrictHostKeyChecking=no \
  "$REMOTE_USER@$REMOTE_HOST" \
  "cd $REMOTE_PATH && \
   tar xzf frontend-dist.tar.gz && \
   tar xzf backend.tar.gz && \
   rm -f frontend-dist.tar.gz backend.tar.gz && \
   echo '✓ Extraction complete'"

# 6. Create .env file
echo "📝 Creating .env file..."
sshpass -p "$REMOTE_SSH_KEY" ssh -o StrictHostKeyChecking=no \
  "$REMOTE_USER@$REMOTE_HOST" \
  "cat > $REMOTE_PATH/.env << 'EOF'
DATABASE_URL=postgresql+asyncpg://designer_user:securepass123@postgres:5432/authentik_login_designer
VALKEY_URL=redis://valkey:6379/1
CORS_ORIGINS=http://localhost:3000,https://identity.casmart.internal,http://localhost:80
ADMIN_API_KEY=casmarts_admin_super_secret_key_123
PUBLIC_API_BASE_URL=https://identity.casmart.internal
EOF"

# 7. Cleanup local temp files
rm -f /tmp/frontend-dist.tar.gz /tmp/backend.tar.gz

echo ""
echo "✅ Transfer complete!"
echo ""
echo "Next steps on 10.4.3.208:"
echo "  1. ssh authentik@10.4.3.208"
echo "  2. cd /opt/authentik-login-designer"
echo "  3. docker-compose build"
echo "  4. docker-compose up -d"
echo "  5. docker exec authentik-login-designer-backend python -m alembic upgrade head"
echo "  6. curl http://localhost:8000/health"
echo ""
