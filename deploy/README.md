# VPS deployment (no Docker)

These scripts target a new Ubuntu 22.04/24.04 VPS. They install and configure PostgreSQL, Redis, Nginx, Node.js 22, pnpm, PM2, UFW, and Certbot. PostgreSQL and Redis bind locally; they are not exposed to the internet.

## 1. Bootstrap the server

Copy the repository to the VPS, connect as root (or a sudo-capable user), and run:

```bash
sudo bash deploy/setup-vps.sh
```

Optional settings:

```bash
sudo APP_USER=brandapp APP_DIR=/srv/brand-identity \
  DB_NAME=brand_identity_v3 DB_USER=brand_identity \
  bash deploy/setup-vps.sh
```

The generated database connection is stored in `/etc/brand-identity/db.env` with mode `0600`.

## 2. Deploy the application

The first deployment requires a domain, OpenRouter key, and SMTP URL. The script generates JWT keys and the production `.env` automatically. It never overwrites an existing `.env` on later deployments.

```bash
sudo DOMAIN=app.example.com \
  OPENROUTER_API_KEY='your-openrouter-key' \
  SMTP_URL='smtps://user:password@smtp.example.com:465' \
  EMAIL_FROM='noreply@app.example.com' \
  bash deploy/deploy.sh
```

For HTTPS on the first deployment, point DNS at the VPS first, then run:

```bash
sudo DOMAIN=app.example.com \
  OPENROUTER_API_KEY='your-openrouter-key' \
  SMTP_URL='smtps://user:password@smtp.example.com:465' \
  EMAIL_FROM='noreply@app.example.com' \
  ENABLE_TLS=1 LETSENCRYPT_EMAIL='admin@app.example.com' \
  bash deploy/deploy.sh
```

The deploy script syncs the checkout to `/srv/brand-identity`, installs dependencies with the lockfile, builds all workspaces, runs TypeORM migrations, starts API/worker/web with PM2, installs Nginx routing, and checks both API and web health.

## Updating an existing deployment

Pull or copy the new checkout onto the VPS and run the same deploy command. Existing secrets and the local object store are preserved. PM2 keeps the three processes online across reboots.

```bash
sudo DOMAIN=app.example.com OPENROUTER_API_KEY='your-openrouter-key' \
  SMTP_URL='smtps://user:password@smtp.example.com:465' \
  EMAIL_FROM='noreply@app.example.com' \
  bash deploy/deploy.sh
```

Useful commands:

```bash
sudo -u brandapp pm2 status
sudo -u brandapp pm2 logs
sudo nginx -t
sudo systemctl status postgresql redis-server nginx
```

Do not expose ports `5432` or `6379`; only SSH, HTTP, and HTTPS should be open in the firewall.
