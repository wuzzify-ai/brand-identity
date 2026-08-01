#!/usr/bin/env bash
set -Eeuo pipefail

# Build and run Wuzzify without Docker.
# Run as root from a project checkout on the VPS after setup-vps.sh.

APP_NAME="${APP_NAME:-brand-identity}"
APP_USER="${APP_USER:-brandapp}"
APP_DIR="${APP_DIR:-/srv/${APP_NAME}}"
DOMAIN="${DOMAIN:-}"
SOURCE_DIR="${SOURCE_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENABLE_TLS="${ENABLE_TLS:-0}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-}"
SMTP_URL="${SMTP_URL:-}"
EMAIL_FROM="${EMAIL_FROM:-}"
OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-}"

log() { printf '\n[%s] %s\n' "$(date '+%F %T')" "$*"; }
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }
run_app() { runuser -u "${APP_USER}" -- env HOME="/home/${APP_USER}" PM2_HOME="/home/${APP_USER}/.pm2" bash -lc "$*"; }

[[ "${EUID}" -eq 0 ]] || die "Run as root (sudo bash deploy/deploy.sh)."
[[ -n "${DOMAIN}" ]] || die "Set DOMAIN, for example DOMAIN=app.example.com."
[[ "${DOMAIN}" =~ ^[A-Za-z0-9.-]+$ ]] || die "DOMAIN contains unsupported characters."
[[ -n "${OPENROUTER_API_KEY}" ]] || die "Set OPENROUTER_API_KEY before deploying."
[[ -n "${SMTP_URL}" ]] || die "Set SMTP_URL to a real SMTP provider before deploying."
[[ -d "${SOURCE_DIR}" && -f "${SOURCE_DIR}/pnpm-lock.yaml" ]] || die "SOURCE_DIR must point to the project checkout."
id -u "${APP_USER}" >/dev/null 2>&1 || die "Application user ${APP_USER} does not exist. Run setup-vps.sh first."
[[ -f "/etc/${APP_NAME}/db.env" ]] || die "Missing /etc/${APP_NAME}/db.env. Run setup-vps.sh first."
source "/etc/${APP_NAME}/db.env"
[[ -n "${EMAIL_FROM}" ]] && [[ "${EMAIL_FROM}" == *@*.* ]] || EMAIL_FROM="noreply@${DOMAIN}"

log "Syncing source into ${APP_DIR}"
install -d -o "${APP_USER}" -g "${APP_USER}" -m 0750 "${APP_DIR}"
if [[ "${SOURCE_DIR}" != "${APP_DIR}" ]]; then
  rsync -a --delete \
    --exclude '.env' \
    --exclude '.local-object-storage/' \
    --exclude 'node_modules/' \
    --exclude 'apps/*/node_modules/' \
    --exclude 'apps/*/dist/' \
    --exclude 'apps/web/.next/' \
    "${SOURCE_DIR}/" "${APP_DIR}/"
fi
install -d -o "${APP_USER}" -g "${APP_USER}" -m 0750 "${APP_DIR}/.local-object-storage"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

ENV_FILE="${APP_DIR}/.env"
if [[ ! -f "${ENV_FILE}" ]]; then
  log "Generating production environment file"
  KEY_DIR="$(mktemp -d)"
  trap 'rm -rf "${KEY_DIR}"' EXIT
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "${KEY_DIR}/access-private.pem" 2>/dev/null
  openssl pkey -in "${KEY_DIR}/access-private.pem" -pubout -out "${KEY_DIR}/access-public.pem" 2>/dev/null
  PRIVATE_KEY="$(awk '{printf "%s\\n", $0}' "${KEY_DIR}/access-private.pem")"
  PUBLIC_KEY="$(awk '{printf "%s\\n", $0}' "${KEY_DIR}/access-public.pem")"
  S3_SECRET="$(openssl rand -hex 32)"
  cat > "${ENV_FILE}" <<EOF
NODE_ENV=production
WEB_PORT=3000
NEXT_PUBLIC_API_BASE_URL=https://${DOMAIN}/v1
NEXT_PUBLIC_APP_URL=https://${DOMAIN}
API_PORT=4000
API_PUBLIC_URL=https://${DOMAIN}
WEB_ORIGIN=https://${DOMAIN}
WORKER_CONCURRENCY=${WORKER_CONCURRENCY:-2}

DATABASE_URL=${DATABASE_URL}
REDIS_URL=redis://127.0.0.1:6379/0

OPENROUTER_BASE_URL=${OPENROUTER_BASE_URL:-https://openrouter.ai/api/v1}
OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
OPENROUTER_BRIEF_MODEL=${OPENROUTER_BRIEF_MODEL:-anthropic/claude-sonnet-4}
OPENROUTER_STRATEGY_MODEL=${OPENROUTER_STRATEGY_MODEL:-openai/gpt-4.1}
OPENROUTER_VISUAL_MODEL=${OPENROUTER_VISUAL_MODEL:-anthropic/claude-sonnet-4}
OPENROUTER_ASSET_MODEL=${OPENROUTER_ASSET_MODEL:-openai/gpt-image-2}
AI_WORKSPACE_MONTHLY_BUDGET_MICRO_USD=${AI_WORKSPACE_MONTHLY_BUDGET_MICRO_USD:-100000000}
AI_GENERATION_PRECHARGE_MICRO_USD=${AI_GENERATION_PRECHARGE_MICRO_USD:-1000000}

# The application uses its private local object store when no S3/MinIO is present.
S3_ENDPOINT=file://${APP_DIR}/.local-object-storage
S3_REGION=us-east-1
S3_BUCKET=brand-identity-assets
S3_ACCESS_KEY_ID=local-storage
S3_SECRET_ACCESS_KEY=${S3_SECRET}
PUBLIC_ASSET_CDN_URL=https://${DOMAIN}
AUTHENTICATED_UPLOAD_MAX_BYTES=26214400
ASSET_UPLOAD_GRANT_TTL_SECONDS=900
ASSET_DOWNLOAD_GRANT_TTL_SECONDS=300
ANONYMOUS_UPLOAD_MAX_BYTES=10485760
ANONYMOUS_UPLOAD_GRANT_TTL_SECONDS=900

JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
JWT_ISSUER=brand-identity-api
JWT_AUDIENCE=brand-identity-web
JWT_ACCESS_PRIVATE_KEY=${PRIVATE_KEY}
JWT_ACCESS_PUBLIC_KEY=${PUBLIC_KEY}
JWT_ACCESS_TTL_SECONDS=900
REFRESH_TOKEN_TTL_DAYS=30
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_SECONDS=2592000

EMAIL_FROM=${EMAIL_FROM}
SMTP_URL=${SMTP_URL}
TOKEN_HASH_PEPPER=$(openssl rand -hex 32)
EMAIL_VERIFICATION_TTL_HOURS=24
PASSWORD_RESET_TTL_MINUTES=30
EOF
  chown "${APP_USER}:${APP_USER}" "${ENV_FILE}"
  chmod 0600 "${ENV_FILE}"
else
  log "Keeping existing ${ENV_FILE} (secrets are not overwritten)"
fi

log "Installing dependencies"
run_app "cd '${APP_DIR}' && pnpm install --frozen-lockfile"

log "Building API, worker, and web"
run_app "cd '${APP_DIR}' && set -a && source .env && set +a && pnpm build"

log "Running database migrations"
run_app "cd '${APP_DIR}' && set -a && source .env && set +a && pnpm --filter @wuzzify/brand-identity-api migration:run"

log "Writing PM2 ecosystem"
cat > "${APP_DIR}/ecosystem.config.cjs" <<EOF
module.exports = {
  apps: [
    {
      name: 'brand-api',
      cwd: '${APP_DIR}',
      script: 'apps/api/dist/main.js',
      node_args: '--env-file=.env',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '512M',
      time: true
    },
    {
      name: 'brand-worker',
      cwd: '${APP_DIR}',
      script: 'apps/worker/dist/main.js',
      node_args: '--env-file=.env',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '768M',
      time: true
    },
    {
      name: 'brand-web',
      cwd: '${APP_DIR}/apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start --port 3000',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '512M',
      time: true
    }
  ]
};
EOF
chown "${APP_USER}:${APP_USER}" "${APP_DIR}/ecosystem.config.cjs"
chmod 0640 "${APP_DIR}/ecosystem.config.cjs"

log "Starting PM2 processes"
run_app "cd '${APP_DIR}' && pm2 startOrRestart ecosystem.config.cjs --update-env && pm2 save"
pm2 startup systemd -u "${APP_USER}" --hp "/home/${APP_USER}" >/tmp/${APP_NAME}-pm2-startup.txt 2>&1 || true
systemctl enable "pm2-${APP_USER}" || true

log "Installing Nginx configuration"
NGINX_AVAILABLE="/etc/nginx/sites-available/${APP_NAME}"
sed -e "s|__DOMAIN__|${DOMAIN}|g" -e "s|__APP_DIR__|${APP_DIR}|g" \
  "${SOURCE_DIR}/deploy/nginx.conf.template" > "${NGINX_AVAILABLE}"
ln -sfn "${NGINX_AVAILABLE}" "/etc/nginx/sites-enabled/${APP_NAME}"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

if [[ "${ENABLE_TLS}" == "1" ]]; then
  [[ -n "${LETSENCRYPT_EMAIL}" ]] || die "Set LETSENCRYPT_EMAIL when ENABLE_TLS=1."
  log "Requesting Let's Encrypt certificate"
  certbot --nginx --non-interactive --agree-tos --redirect \
    --email "${LETSENCRYPT_EMAIL}" -d "${DOMAIN}"
fi

log "Checking application health"
for attempt in {1..30}; do
  if curl --fail --silent --show-error http://127.0.0.1:4000/v1/health/live >/dev/null \
    && curl --fail --silent --show-error http://127.0.0.1:3000 >/dev/null; then
    break
  fi
  [[ "${attempt}" -eq 30 ]] && die "Application health checks did not pass. Inspect PM2 logs."
  sleep 2
done

log "Deployment complete"
cat <<EOF

Web: https://${DOMAIN}
API: https://${DOMAIN}/v1
PM2 status: runuser -u ${APP_USER} -- pm2 status
PM2 logs:   runuser -u ${APP_USER} -- pm2 logs
Environment: ${ENV_FILE}
Nginx: ${NGINX_AVAILABLE}
EOF
