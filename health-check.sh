#!/bin/bash
# Health check script for Authentik Login Designer
# Run: ./health-check.sh [http://localhost:3000]

TARGET_URL="${1:-http://localhost:3000}"
API_BASE="${2:-http://localhost:8000}"

echo "🏥 Authentik Login Designer Health Check"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 1. Frontend accessibility
echo "📱 Frontend:"
if curl -s "$TARGET_URL" | grep -q "DOCTYPE\|<html\|angular"; then
    check_pass "Accessible ($TARGET_URL)"
else
    check_fail "Not accessible ($TARGET_URL)"
fi

# 2. Backend health endpoint
echo ""
echo "🔧 Backend:"
if curl -s "$API_BASE/health" | grep -q "healthy"; then
    health_resp=$(curl -s "$API_BASE/health")
    check_pass "Health endpoint OK"
    echo "   Response: $health_resp"
else
    check_fail "Health endpoint failed"
fi

# 3. Backend themes endpoint (requires admin key)
echo ""
echo "📚 API Endpoints:"
admin_key="casmarts_admin_super_secret_key_123"
themes_resp=$(curl -s -H "X-Admin-Key: $admin_key" "$API_BASE/api/v1/themes")

if echo "$themes_resp" | grep -q "\[\]" || echo "$themes_resp" | grep -q "id"; then
    check_pass "Themes endpoint OK (empty or themes returned)"
else
    check_warn "Themes endpoint check inconclusive"
    echo "   Response: ${themes_resp:0:100}..."
fi

# 4. Authentik applications endpoint
apps_resp=$(curl -s -H "X-Admin-Key: $admin_key" "$API_BASE/api/v1/themes/authentik/applications")
if echo "$apps_resp" | grep -q "\[\]" || echo "$apps_resp" | grep -q "slug"; then
    check_pass "Applications endpoint OK"
else
    check_warn "Applications endpoint (may need Authentik DB connection)"
fi

# 5. Public theme endpoint
echo ""
echo "🎨 Public Endpoints:"
public_resp=$(curl -s "$API_BASE/api/v1/public/theme/default-authentication-flow")
if echo "$public_resp" | grep -q "display_name"; then
    check_pass "Public theme endpoint OK"
else
    check_warn "Public theme endpoint (may return default)"
fi

# 6. Docker containers (if on local machine)
echo ""
echo "🐳 Docker Containers:"
if command -v docker &> /dev/null; then
    if docker ps 2>/dev/null | grep -q "authentik-login-designer"; then
        containers=$(docker ps --filter "name=authentik-login-designer" --format "table {{.Names}}\t{{.Status}}" | tail -n +2)
        check_pass "Containers running:"
        echo "$containers" | while read -r line; do
            echo "   $line"
        done
    else
        check_warn "Docker not accessible or containers not running"
    fi
fi

# 7. Database connectivity
echo ""
echo "🗄️  Database:"
if command -v docker &> /dev/null && docker ps 2>/dev/null | grep -q "authentik-login-designer-db"; then
    if docker exec authentik-login-designer-db pg_isready -U designer_user 2>/dev/null | grep -q "accepting"; then
        check_pass "PostgreSQL accessible"
    else
        check_fail "PostgreSQL not accepting connections"
    fi
fi

# 8. Cache connectivity
echo ""
echo "💾 Cache:"
if command -v docker &> /dev/null && docker ps 2>/dev/null | grep -q "authentik-login-designer-cache"; then
    if docker exec authentik-login-designer-cache redis-cli ping 2>/dev/null | grep -q "PONG"; then
        check_pass "Valkey/Redis accessible"
    else
        check_fail "Valkey/Redis not responding"
    fi
fi

# 9. SSL/TLS check
echo ""
echo "🔒 SSL/TLS:"
if [[ "$TARGET_URL" == https://* ]]; then
    domain=$(echo "$TARGET_URL" | sed 's|https://||' | cut -d'/' -f1)
    if echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | grep -q "Verify return code"; then
        check_pass "SSL certificate valid"
    else
        check_warn "SSL certificate check failed (may be self-signed)"
    fi
else
    check_warn "Target is HTTP (not HTTPS)"
fi

# Summary
echo ""
echo "=========================================="
echo "✅ Health check complete"
echo ""
echo "📖 For detailed logs:"
echo "   docker-compose logs -f backend"
echo "   docker-compose logs -f frontend"
echo ""
