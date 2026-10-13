# Deployment: Ubuntu server

Target: `https://hrforms.wct.my/WCT-Training-RQ/` on the existing Ubuntu server behind Nginx.

| Item | Value |
|---|---|
| App directory | `/opt/wct-training-rq` (git clone of this repo) |
| Process | PM2 app `wct-training-rq` on `127.0.0.1:3010` |
| Config | `/opt/wct-training-rq/.env` (mode 600, never in git) |
| Database | PostgreSQL 16, database `wct_training_rq`, user `wct_trq` |
| Attachments | `/var/lib/wct-training-rq/uploads` |
| Backups | `/var/backups/wct-training-rq` (30 days) |
| Deploy user | `trq` (owns the app; GitHub Actions SSHes in as this user) |

## 1. Install prerequisites (once)

```bash
# Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git postgresql-16 postgresql-client-16
sudo npm install -g pm2
node -v   # v22.x
```

PostgreSQL 16 isn't in your Ubuntu repositories? Add the PGDG apt repo first (see postgresql.org/download/linux/ubuntu). Use `postgresql` to get the distro default, which is fine if it is version 14 or newer.

## 2. Deploy user and directories

```bash
sudo adduser --disabled-password --gecos "" trq
sudo mkdir -p /opt/wct-training-rq /var/lib/wct-training-rq/uploads /var/backups/wct-training-rq
sudo chown -R trq:trq /opt/wct-training-rq /var/lib/wct-training-rq /var/backups/wct-training-rq
sudo chmod 750 /var/lib/wct-training-rq/uploads
```

## 3. Database

```bash
sudo -u postgres psql -c "CREATE USER wct_trq WITH PASSWORD '<strong-password>';"
sudo -u postgres createdb -O wct_trq wct_training_rq
```

## 4. Code and configuration

```bash
sudo -iu trq
git clone https://github.com/BQPhua/WCT-Training-RQ.git /opt/wct-training-rq
cd /opt/wct-training-rq
cp .env.example .env && chmod 600 .env
nano .env
```

Fill in every value. Generate secrets with `openssl rand -base64 48` (SESSION_SECRET) and `openssl rand -hex 32` (CRON_SECRET). Keep `AUTH_DEV_LOGIN=false`. Put your own email in `BOOTSTRAP_ADMIN_EMAILS` so you become System Admin on first sign-in. Entra values: see [ENTRA_SETUP.md](ENTRA_SETUP.md). Flow URL: see [POWER_AUTOMATE.md](POWER_AUTOMATE.md).

## 5. First deploy

```bash
./scripts/deploy.sh          # install, migrate, build, start under PM2, health-check
npm run db:seed              # creates business units Land, E&C, Malls (idempotent)
pm2 startup systemd -u trq --hp /home/trq   # run the sudo command it prints
pm2 save
```

> Do **not** run `SEED_DEMO=true` or `db:seed-demo` on production. They create demo users and requests.

## 6. Nginx

Add the blocks from [`deploy/nginx-wct-training-rq.conf`](../deploy/nginx-wct-training-rq.conf) to the existing `hrforms.wct.my` HTTPS server block. Create `/etc/nginx/snippets/trq-proxy.conf` and the rate-limit zone as described in that file. Then:

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -I https://hrforms.wct.my/WCT-Training-RQ/signin   # expect 200
```

## 7. Scheduled jobs

Install the entries from [`deploy/crontab.txt`](../deploy/crontab.txt) with `crontab -e` as `trq`. They retry failed notifications every 5 minutes and take a nightly backup.

## 8. GitHub Actions auto-deploy

1. On the server, as `trq`, create a key pair just for deploys:

   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N "" -C "github-actions-deploy"
   cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
   cat ~/.ssh/github_deploy      # copy the PRIVATE key into the GitHub secret below, then delete this file
   ```

2. In GitHub, go to **Settings → Secrets and variables → Actions** and add:
   - `DEPLOY_HOST`: server public hostname or IP
   - `DEPLOY_PORT`: SSH port (usually 22)
   - `DEPLOY_USER`: `trq`
   - `DEPLOY_SSH_KEY`: the private key

3. Go to **Settings → Environments → New environment** and create `production`. You can optionally add required reviewers, so every deploy needs a click.

4. The server's SSH port must accept connections from GitHub-hosted runners. If the server is behind a firewall that only allows the office network, install a **self-hosted runner** on the server instead and change `runs-on` in `.github/workflows/deploy.yml` to `self-hosted`, with the script step running `/opt/wct-training-rq/scripts/deploy.sh` directly.

From then on, every push or merge to `main` runs CI, and if it's green, deploys. You can also deploy manually: **Actions → Deploy → Run workflow**, or on the server, `./scripts/deploy.sh`.

## 9. First-time configuration in the app

1. Sign in at `https://hrforms.wct.my/WCT-Training-RQ/` with the bootstrap admin account.
2. In **Admin settings → Business units & departments**:
   - Check the three BUs.
   - Add each BU's **BU Admin**.
   - Create the **departments**, named exactly as in Microsoft 365, and assign each **HOD**. Use **Users → Add user** for HODs who haven't signed in yet.
3. In **Admin settings → Roles**, add the **L&D Team** members, the **HR Head**, and other System Admins.
4. Raise a test request end to end, and check that the emails arrive and the PDF prints correctly.

## Release checklist (each deploy)

**Before**
- [ ] CI green on `main` (lint, types, unit, integration, build, E2E)
- [ ] New migrations reviewed (`drizzle/*.sql`). Additive changes only; destructive ones need a backup first.
- [ ] Recent backup exists (`ls -lt /var/backups/wct-training-rq | head`)
- [ ] Users told about any visible change

**During**
- [ ] Deploy workflow shows `Healthy ✔`
- [ ] `pm2 logs wct-training-rq --lines 50` shows no errors

**After (smoke test, about 2 minutes)**
- [ ] Sign in works
- [ ] Dashboard, history and one request detail load
- [ ] PDF downloads
- [ ] Admin → Notifications shows recent sends as `sent`

**Roll back if:** the health check fails (automatic), sign-in fails for users, approvals error, or the notification log shows repeated failures after the release.

## Rollback

`deploy.sh` rolls back automatically when the post-deploy health check fails. To roll back by hand:

```bash
cd /opt/wct-training-rq
git log --oneline -5                 # pick the previous good commit
git reset --hard <commit> && NEXT_DIST_DIR=.next-build npm run build && rm -rf .next && mv .next-build .next
pm2 reload ecosystem.config.cjs --update-env
```

Migrations are forward-only. If a release added a migration that must be undone, restore the pre-release backup:

```bash
pg_restore --clean --if-exists -d "$DATABASE_URL" /var/backups/wct-training-rq/db-<stamp>.dump
```

## Operations

- Logs: `pm2 logs wct-training-rq`
- Status: `pm2 status`, `curl http://127.0.0.1:3010/WCT-Training-RQ/api/health`
- Restart: `pm2 reload wct-training-rq --update-env`, needed after editing `.env`
- Client secret expiry: renew in Entra before it expires (see ENTRA_SETUP.md)
