# Deployment: Ubuntu server

Target: `https://hrforms.wct.my/WCT-Training-RQ/` on the existing Ubuntu server behind Nginx.

## Layout on the server

```
/opt/wct-training-rq/
├── repo/                  git clone of this repository (source only; deploys are built from it)
├── shared/.env            secrets & config (chmod 600, NEVER in git)
├── releases/
│   ├── 20261014093000-1a2b3c4/   one immutable build per deploy (own node_modules + .next)
│   └── …                  (the newest 3 are kept, ~700 MB each)
└── current -> releases/…  symlink PM2 runs from
/var/lib/wct-training-rq/uploads    attachments (outside the releases, survives deploys)
/var/backups/wct-training-rq        nightly DB + uploads backups (30 days)
```

| Item | Value |
|---|---|
| Process | PM2 app `wct-training-rq` on `127.0.0.1:3110` |
| Database | PostgreSQL 16, database `wct_training_rq`, user `wct_trq` |
| Deploy user | `trq` (owns the app; GitHub Actions SSHes in as this user) |

How a deploy works (`scripts/deploy.sh`):

1. A new folder is built under `releases/` with `npm ci`, migrations, the reference-data seed (business units; idempotent) and `next build`. Dev dependencies and the build cache are then removed to save disk.
2. Only when all of that succeeds is `current` switched atomically and PM2 reloaded.
3. If the health check then fails, `current` is switched back to the previous release automatically.
4. A failed build never touches the running site.

## 1. Install prerequisites (once, as a sudo user)

```bash
# Node.js 22 LTS, Git, PostgreSQL
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git postgresql postgresql-contrib
sudo npm install -g pm2
node -v    # v22.x
psql --version   # 14 or newer is fine
```

## 2. Deploy user and directories

```bash
sudo adduser --disabled-password --gecos "" trq
sudo mkdir -p /opt/wct-training-rq/{shared,releases} /var/lib/wct-training-rq/uploads /var/backups/wct-training-rq
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
git clone https://github.com/BQPhua/WCT-Training-RQ.git /opt/wct-training-rq/repo
cp /opt/wct-training-rq/repo/.env.example /opt/wct-training-rq/shared/.env
chmod 600 /opt/wct-training-rq/shared/.env
nano /opt/wct-training-rq/shared/.env
```

Fill in every value:

| Variable | Value |
|---|---|
| `APP_URL` | `https://hrforms.wct.my/WCT-Training-RQ` |
| `DATABASE_URL` | `postgres://wct_trq:<strong-password>@127.0.0.1:5432/wct_training_rq` |
| `SESSION_SECRET` | output of `openssl rand -base64 48` |
| `CRON_SECRET` | output of `openssl rand -hex 32` |
| `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET` | from the app registration ([ENTRA_SETUP.md](ENTRA_SETUP.md)) |
| `POWER_AUTOMATE_FLOW_URL` | the flow's HTTP POST URL ([POWER_AUTOMATE.md](POWER_AUTOMATE.md)) |
| `UPLOAD_DIR` | `/var/lib/wct-training-rq/uploads` |
| `BOOTSTRAP_ADMIN_EMAILS` | your own email, so you become System Admin on first sign-in |
| `AUTH_DEV_LOGIN` | `false` |

## 5. First deploy

```bash
# still as trq
/opt/wct-training-rq/repo/scripts/deploy.sh main       # build release, migrate, start under PM2, health-check
pm2 startup systemd -u trq --hp /home/trq              # copy-run the sudo command it prints
pm2 save
curl http://127.0.0.1:3110/WCT-Training-RQ/api/health  # {"ok":true,"db":true}
```

> **Sample data for a trial run** (optional): `sudo -iu trq /opt/wct-training-rq/current/scripts/demo-data.sh load`
> - It adds 12 demo people (`@demo.wct.my`), 7 demo departments and about 30 requests in every status. No emails are sent.
> - Load it **before** you create real departments.
> - **Remove it before go-live** with `… demo-data.sh remove`. Otherwise the demo L&D, HR Head and BU Admin accounts would be included in real notifications.
> - Removal deletes only demo records, and reference numbers continue from the highest real one.

## 6. Nginx

Add the blocks from [`deploy/nginx-wct-training-rq.conf`](../deploy/nginx-wct-training-rq.conf) to the existing `hrforms.wct.my` HTTPS `server { }` block. Create `/etc/nginx/snippets/trq-proxy.conf` and the rate-limit zone as described in that file. Then:

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -I https://hrforms.wct.my/WCT-Training-RQ/signin   # expect 200
```

## 7. Scheduled jobs

As `trq`, run `crontab -e` and paste the two lines from [`deploy/crontab.txt`](../deploy/crontab.txt). They retry failed notifications every 5 minutes and take a nightly backup.

## 8. Auto-deploy from GitHub

Every push to `main` runs **CI** on GitHub's own machines (lint, types, unit, integration, build, E2E). When CI passes, the **Deploy** workflow runs on a **self-hosted runner on this server**, as `trq`, and deploys **exactly the commit CI tested** via `scripts/ci-deploy-gate.sh` → `scripts/deploy.sh`.

The server only makes outbound HTTPS connections to GitHub, so no inbound SSH, deploy keys or deploy secrets are needed. This suits an internal server.

1. **Register the runner.** In GitHub, open the repo and go to **Settings → Actions → Runners → New self-hosted runner → Linux x64**. Keep that page open: it shows the current download link and a one-time token. Then, on the server:

   ```bash
   sudo -iu trq
   mkdir -p ~/actions-runner && cd ~/actions-runner
   # Run the "Download" commands from the GitHub page here (curl … and tar xzf …).
   ./config.sh --url https://github.com/BQPhua/WCT-Training-RQ --token <TOKEN-FROM-PAGE> \
     --name wct-hrform01-trq --labels wct-training-rq --work _work --unattended
   exit
   sudo bash -c "cd /home/trq/actions-runner && ./svc.sh install trq && ./svc.sh start && ./svc.sh status"
   ```

   GitHub should then show the runner as **Idle**, with labels `self-hosted, Linux, X64, wct-training-rq`.

2. **Protect the runner (public repo).** Go to **Settings → Actions → General → Approval for running fork pull request workflows from contributors** and choose **Require approval for all external contributors**. Only the Deploy workflow targets the runner, and it only runs for pushes to this repo's `main`. This setting makes sure a stranger's pull request can never run code on the server without your approval.

3. **Environment.** Go to **Settings → Environments → New environment** and name it `production`. Optionally add yourself as a required reviewer, so each deploy waits for your click.

Deploy by hand any time with **Actions → Deploy → Run workflow**, or on the server with `sudo -iu trq /opt/wct-training-rq/repo/scripts/deploy.sh`.

Runner service: `sudo systemctl status 'actions.runner.*wct-hrform01-trq*'`. To remove it: `cd /home/trq/actions-runner && sudo ./svc.sh uninstall`, then `./config.sh remove --token <token>` as `trq`.

## 9. First-time configuration in the app

1. Sign in at `https://hrforms.wct.my/WCT-Training-RQ/` with the bootstrap admin account.
2. In **Admin settings → Business units & departments**:
   - Add each BU's **BU Admin**.
   - Create the **departments**, named exactly as in Microsoft 365, and set each **HOD**. Use **Users → Add user** for HODs who haven't signed in yet.
3. In **Admin settings → Roles**, add the **L&D Team** members, the **HR Head** and other System Admins.
4. Raise a test request end to end. Check that the emails arrive and the PDF prints correctly.

## Release checklist (each deploy)

**Before**
- [ ] CI green on `main`
- [ ] New migrations reviewed (`drizzle/*.sql`). Additive changes only; destructive ones need a backup first.
- [ ] A recent backup exists (`ls -lt /var/backups/wct-training-rq | head`)

**After (smoke test, about 2 minutes)**
- [ ] Sign-in, dashboard, history and one request detail load
- [ ] PDF downloads
- [ ] **Admin → Notifications** shows recent sends as `sent`

**Roll back if:** sign-in fails, approvals error, or notifications fail repeatedly after the release.

## Rollback

Automatic when the post-deploy health check fails. By hand, to the previous release (or a named one):

```bash
/opt/wct-training-rq/repo/scripts/rollback.sh                       # previous release
/opt/wct-training-rq/repo/scripts/rollback.sh /opt/wct-training-rq/releases/<folder>
```

Migrations are forward-only. If a release added a migration that must be undone, restore the pre-release backup:

```bash
set -a; . /opt/wct-training-rq/shared/.env; set +a
pg_restore --clean --if-exists -d "$DATABASE_URL" /var/backups/wct-training-rq/db-<stamp>.dump
```

## Operations

- Logs: `pm2 logs wct-training-rq`
- Status: `pm2 status`, `curl http://127.0.0.1:3110/WCT-Training-RQ/api/health`
- After editing `shared/.env`: `pm2 reload wct-training-rq --update-env`
- Client secret expiry: renew it in Entra before it expires ([ENTRA_SETUP.md](ENTRA_SETUP.md))
