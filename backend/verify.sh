#!/usr/bin/env bash
#
# Read-only deployment check. Changes nothing — safe to run any time, on the server
# or locally. Walks the whole chain: code -> config -> database -> API -> public URL,
# in that order, because each link only makes sense once the one before it holds.
#
#   bash backend/verify.sh
#
# Run from the repo root or the backend directory; it finds its own way.

cd "$(dirname "$0")/.." || exit 1

PUBLIC_URL="${PUBLIC_URL:-https://scorelo-staging.tlxapps.com}"
pass() { printf '   \033[32mOK\033[0m   %s\n' "$1"; }
fail() { printf '   \033[31mFAIL\033[0m %s\n' "$1"; FAILED=$((FAILED + 1)); }
warn() { printf '   \033[33mWARN\033[0m %s\n' "$1"; }
head2() { printf '\n\033[1m── %s ──\033[0m\n' "$1"; }
FAILED=0

printf '\033[1m═══ Scorelo deployment check ═══\033[0m\n'
echo "repo: $(pwd)"

# ─── 1. Code ──────────────────────────────────────────────────────────────────
head2 "1. CODE"
git fetch -q origin 2>/dev/null
LOCAL=$(git rev-parse --short HEAD 2>/dev/null)
ORIGIN=$(git rev-parse --short origin/main 2>/dev/null)
echo "   HEAD=$LOCAL  origin/main=$ORIGIN"
if [ "$LOCAL" = "$ORIGIN" ]; then pass "up to date with origin/main"; else fail "behind origin — run: git pull"; fi
# These two files only exist after the MySQL port, so they prove which code is deployed.
[ -f backend/src/db/returning.ts ] && pass "MySQL port present" || fail "MySQL port MISSING — git pull"
ls backend/drizzle/*.sql >/dev/null 2>&1 && pass "migration present ($(ls backend/drizzle/*.sql | wc -l) file)" || fail "no migration files"
grep -q '"pg"' backend/package.json && fail "pg still in package.json" || pass "PostgreSQL removed"

# ─── 2. Config ────────────────────────────────────────────────────────────────
head2 "2. BACKEND .env"
ENV_FILE="$(pwd)/backend/.env"
if [ -f backend/.env ]; then
  pass "exists at $ENV_FILE"
  grep -q '^DATABASE_URL=mysql' backend/.env && pass "DATABASE_URL uses mysql://" \
    || fail "DATABASE_URL is not mysql:// — found $(grep -o '^DATABASE_URL=[a-z]*' backend/.env)"
  grep -q '^NODE_ENV=production' backend/.env && pass "NODE_ENV=production" || fail "NODE_ENV must be production"
  # mockAuthEnabled authenticates EVERY caller as user 1 — never acceptable in production.
  grep -q '^MOCK_AUTH=false' backend/.env && pass "MOCK_AUTH=false" || fail "MOCK_AUTH must be false"
  for key in JWT_ACCESS_SECRET JWT_REFRESH_SECRET TOKEN_ENCRYPTION_KEY; do
    [ -n "$(grep "^${key}=" backend/.env | cut -d= -f2-)" ] && pass "$key set" || fail "$key is empty"
  done
  grep -qE '^(BACKEND_URL|FRONTEND_URL)=https?://(localhost|127\.)' backend/.env \
    && fail "BACKEND_URL/FRONTEND_URL still point at localhost" || pass "public URLs configured"
else
  fail "backend/.env MISSING — create it at $ENV_FILE"
fi
# The frontend must NOT have one: VITE_* is baked in at build time, so a wrong value
# there cannot be corrected on the server and silently breaks every API call.
[ -f frontend/.env ] && warn "frontend/.env exists — it should not; VITE_API_BASE_URL must stay unset" \
  || pass "no frontend/.env (correct — frontend calls same-origin /api)"

# ─── 3. Database ──────────────────────────────────────────────────────────────
head2 "3. DATABASE"
if [ -f backend/.env ] && command -v mysql >/dev/null; then
  URL=$(grep '^DATABASE_URL=' backend/.env | cut -d= -f2-)
  DBUSER=$(echo "$URL" | sed -E 's|mysql://([^:]+):.*|\1|')
  DBPASS=$(echo "$URL" | sed -E 's|mysql://[^:]+:([^@]+)@.*|\1|')
  DBNAME=$(echo "$URL" | sed -E 's|.*/([^/?]+)$|\1|')
  TABLES=$(mysql -h 127.0.0.1 -u "$DBUSER" -p"$DBPASS" -N -B -e \
    "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DBNAME' AND TABLE_NAME NOT LIKE '__drizzle%';" 2>/dev/null)
  if [ -z "$TABLES" ]; then
    fail "cannot connect to MySQL as '$DBUSER' — check credentials in .env"
  elif [ "$TABLES" -eq 10 ]; then
    pass "connected — all 10 tables present in '$DBNAME'"
  elif [ "$TABLES" -eq 0 ]; then
    fail "connected but 0 tables — migration has not run (bash backend/deploy.sh)"
  else
    warn "connected but $TABLES tables (expected 10) — migration may be incomplete"
  fi
else
  warn "mysql client not available — relying on the API health check below"
fi

# ─── 4. API process ───────────────────────────────────────────────────────────
head2 "4. API (127.0.0.1:5000)"
LOCAL_HEALTH=$(curl -fsS -m 10 http://127.0.0.1:5000/api/health 2>/dev/null)
case "$LOCAL_HEALTH" in
  *'"database":"connected"'*) pass "API up and MySQL reachable: $LOCAL_HEALTH" ;;
  *'"database"'*)             fail "API up but DB unreachable: $LOCAL_HEALTH" ;;
  *)                          fail "no response — is it running? (pm2 logs scorelo-api)" ;;
esac

# ─── 5. Public URL ────────────────────────────────────────────────────────────
head2 "5. PUBLIC ($PUBLIC_URL)"
PUB=$(curl -fsS -m 20 "$PUBLIC_URL/api/health" 2>/dev/null)
case "$PUB" in
  *'"database":"connected"'*) pass "/api reaches the API through nginx + server.cjs" ;;
  *'<!DOCTYPE'*|*'<html'*)    fail "/api returns HTML — the SPA is swallowing it. Upload the updated frontend/server.cjs and restart the Node app" ;;
  *)                          fail "unexpected response: ${PUB:-<empty>}" ;;
esac

# The original bug: signup POSTed into a server.cjs with no proxy and got 405.
CODE=$(curl -s -o /dev/null -m 20 -w '%{http_code}' -X POST "$PUBLIC_URL/api/auth/signup" \
  -H 'Content-Type: application/json' -d '{}' 2>/dev/null)
case "$CODE" in
  400|422) pass "signup endpoint reachable (HTTP $CODE — validation rejected the empty body, as expected)" ;;
  405)     fail "signup returns 405 — old server.cjs without the /api proxy is still deployed" ;;
  *)       fail "signup returned HTTP $CODE" ;;
esac

# ─── Verdict ──────────────────────────────────────────────────────────────────
if [ "$FAILED" -eq 0 ]; then
  printf '\n\033[32m═══ ALL CHECKS PASSED ═══\033[0m\n\n'
else
  printf '\n\033[31m═══ %s CHECK(S) FAILED ═══\033[0m see the FAIL lines above\n\n' "$FAILED"
  exit 1
fi
