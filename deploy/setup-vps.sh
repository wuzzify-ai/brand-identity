#!/usr/bin/env bash
set -Eeuo pipefail

# Fresh Ubuntu VPS bootstrap for Wuzzify Brand Identity.
# Run as root on Ubuntu 22.04/24.04. This script does not install Docker.

APP_NAME="${APP_NAME:-brand-identity}"
APP_USER="${APP_USER:-brandapp}"
APP_DIR="${APP_DIR:-/srv/${APP_NAME}}"
DB_NAME="${DB_NAME:-brand_identity_v3}"
DB_USER="${DB_USER:-brand_identity}"
SSH_PORT="${SSH_PORT:-22}"
NODE_MAJOR="${NODE_MAJOR:-22}"
PNPM_VERSION="${PNPM_VERSION:-11.13.0}"

if [[ -z "${DB_PASSWORD:-}" && -f "/etc/${APP_NAME}/db.env" ]]; then
  # Preserve the existing password when bootstrap is safely re-run.
  source "/etc/${APP_NAME}/db.env"
fi
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -hex 24)}"

log() { printf '\n[%s] %s\n' "$(date '+%F %T')" "$*"; }
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

[[ "${EUID}" -eq 0 ]] || die "Run this script as root (sudo bash deploy/setup-vps.sh)."
command -v apt-get >/dev/null || die "This bootstrap supports Debian/Ubuntu systems with apt-get."
[[ "${APP_USER}" =~ ^[a-z_][a-z0-9_-]{1,31}$ ]] || die "APP_USER must be a Linux username."
[[ "${DB_NAME}" =~ ^[a-z_][a-z0-9_]{0,62}$ ]] || die "DB_NAME must contain only lowercase letters, digits, and underscores."
[[ "${DB_USER}" =~ ^[a-z_][a-z0-9_]{0,62}$ ]] || die "DB_USER must contain only lowercase letters, digits, and underscores."

export DEBIAN_FRONTEND=noninteractive

log "Installing OS packages"
apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg git rsync openssl build-essential \
  nginx postgresql postgresql-contrib redis-server ufw \
  certbot python3-certbot-nginx

log "Installing Node.js ${NODE_MAJOR}"
install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
  | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
printf 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_%s.x nodistro main\n' "${NODE_MAJOR}" \
  > /etc/apt/sources.list.d/nodesource.list
apt-get update
apt-get install -y nodejs
npm install --global "pnpm@${PNPM_VERSION}" pm2

log "Creating application user and directories"
if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "/home/${APP_USER}" --shell /bin/bash "${APP_USER}"
fi
install -d -o "${APP_USER}" -g "${APP_USER}" -m 0750 "${APP_DIR}"
install -d -o "${APP_USER}" -g "${APP_USER}" -m 0750 "${APP_DIR}/.local-object-storage"

log "Starting PostgreSQL, Redis, and Nginx"
systemctl enable --now postgresql
systemctl enable --now redis-server
systemctl enable --now nginx

log "Restricting Redis to localhost"
REDIS_CONF="/etc/redis/redis.conf"
if [[ -f "${REDIS_CONF}" ]]; then
  sed -ri 's/^#?\s*bind .*/bind 127.0.0.1 ::1/' "${REDIS_CONF}"
  sed -ri 's/^#?\s*protected-mode .*/protected-mode yes/' "${REDIS_CONF}"
  systemctl restart redis-server
fi

log "Creating PostgreSQL role and database"
if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';"
else
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';"
fi

if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  runuser -u postgres -- createdb --owner="${DB_USER}" "${DB_NAME}"
fi
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"

log "Writing root-readable deployment database settings"
install -d -m 0750 "/etc/${APP_NAME}"
cat > "/etc/${APP_NAME}/db.env" <<EOF
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DATABASE_URL=postgres://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}
EOF
chmod 0600 "/etc/${APP_NAME}/db.env"

log "Configuring firewall"
ufw allow "${SSH_PORT}/tcp" comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

log "Bootstrap complete"
cat <<EOF

Application user: ${APP_USER}
Application directory: ${APP_DIR}
Database settings: /etc/${APP_NAME}/db.env
Node: $(node --version)
PNPM: $(pnpm --version)
PM2: $(pm2 --version)

Next step (from the project checkout on the VPS):
  sudo DOMAIN=example.com OPENROUTER_API_KEY='...' SMTP_URL='...' EMAIL_FROM='...' \\
    bash deploy/deploy.sh

Keep /etc/${APP_NAME}/db.env and the generated application .env private.
EOF
