# Operations Runbook — Micro CRM

**Audience:** On-call engineers, DevOps, incident response. This is a reference guide for running, troubleshooting, and recovering the application.

**Out of scope:** Payment processing, financial reconciliation (this is out of PCI DSS scope — no cardholder data is stored or moved).

## System status & health checks

### Health check endpoint

```
GET /api/health
```

**Response on healthy:**
```json
200 OK
{
  "status": "ok",
  "db": "ok"
}
```

**Response on degraded:**
```json
503 Service Unavailable
{
  "status": "degraded",
  "db": "error"
}
```

**When to escalate:**
- `/api/health` returns `503 degraded` for >5 minutes → production incident
- `db: error` specifically → database connectivity issue; check Railway PostgreSQL status and `DATABASE_URL` secret
- `status: degraded` but `db: ok` → check application logs for errors

**Check it now:**
```bash
# Against staging
curl -s https://staging-crm.railway.app/api/health | jq .

# Against production (if you know the domain)
curl -s https://crm.railway.app/api/health | jq .
```

---

## Deployment

### Prerequisites

- Access to the Railway project (`micor-crm`) in the company account
- Git access to `github.com/mohamedhassanshaker/paperclipwork`
- The `main` branch is always production-ready (CI passes before merge)

### Deploy to staging

**Automatic:** Merge a PR to `develop` → GitHub Actions runs CI → if CI passes, Railway auto-deploys to the `staging` environment.

**Manual redeploy (same commit):**
```bash
# In Railway dashboard:
# 1. Navigate to the "staging" environment
# 2. Click the service "micro-crm"
# 3. In the Deployments tab, find the latest successful deployment
# 4. Click the three-dot menu → Redeploy
```

### Deploy to production

**Before promotion, verify:**
1. CI passed on the exact commit you're promoting
2. Staging smoke test passed (login, view dashboard, add a customer)
3. Full regression passed (see QA tracks, not on-call)
4. No critical production incidents in the last 2 hours
5. Database backups are current (Railway auto-backs up every 24 hours; check Railway dashboard)

**To promote:**
```bash
# 1. Merge a PR to main (CI runs automatically)
# 2. Once CI passes, merge is complete
# 3. Railway auto-deploys to production immediately

# To monitor the deployment:
# In Railway dashboard:
# 1. Navigate to the "production" environment
# 2. In the Deployments tab, watch the new deployment roll out
# 3. Once "Status: Success", it is live
```

**Canary window (automated by Railway):**
- Railway starts the new deployment and gradually shifts traffic
- If `/api/health` fails, Railway **automatically rolls back to the previous good deployment**
- Abort thresholds: error rate > 5%, p95 latency > 500ms (these are configured in Railway)
- Rollback completes within 2 minutes of threshold breach; you do not need to act

**Validation (after deploy succeeds):**
```bash
# 1. Health check
curl -s https://crm.railway.app/api/health | jq .

# 2. Smoke test (login, view dashboard)
#    Use test credentials or staging export
curl -s -X POST https://crm.railway.app/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"<test-password>"}'

# 3. Check logs for new errors
#    (see "Reading Logs" section below)
```

---

## Rollback

**This is the most important section.** There is no self-service password reset (see "Account Management" section). Rollback is how we recover from a bad deploy.

### Automatic rollback

Railroad automatically rolls back if:
- `/api/health` returns 503 for >30 seconds
- Error rate exceeds 5% over the canary window
- The deployment times out

You do not need to act; it is automatic.

### Manual rollback (production only)

**Scenario:** The deploy succeeded, health checks passed, but an incident is happening that wasn't caught by the canary window (e.g., a data corruption on the second request).

**To rollback:**

```bash
# In Railway dashboard:
# 1. Navigate to the "production" environment
# 2. In the Deployments tab, find the most recent successful deployment
#    **before** the current bad deployment
# 3. Click the three-dot menu → Redeploy
# 4. This immediately restarts that previous good deployment
# 5. Verify /api/health returns 200 ok

curl -s https://crm.railway.app/api/health | jq .
```

**Recovery SLA:** Rollback completes in <2 minutes. During rollback, users get 503 (graceful degradation; no data corruption).

**After rollback:**
1. Notify the team in Slack
2. File an incident ticket with the commit SHA that was rolled back
3. Check the logs (see section below) to understand what went wrong
4. Do not push the same commit again until root cause is found and fixed

---

## Reading logs

### Structured logging

All logs are structured JSON to stdout. Railway collects them automatically.

**To view logs in Railway dashboard:**
```
1. Navigate to the service → Logs tab
2. Logs are ordered newest first
3. Filter by keywords (e.g., "error", an email, a customer ID)
```

### What to look for in an outage

**"error" in logs:**
```
{"level":"error","message":"Database connection failed","error":"ECONNREFUSED"}
```
→ Check if `DATABASE_URL` is set and PostgreSQL is reachable (see "Database" section).

**"rate_limited" in logs:**
```
{"level":"info","message":"Login throttle tripped","email":"a***@b.com","ip":"192.0.2.1"}
```
→ Expected behavior; user has attempted 11+ failed logins in 15 minutes. They must wait or reset (see "Account Management").

**"unauthorized" in logs:**
```
{"level":"warn","message":"Invalid session cookie","sessionId":"..."}
```
→ Expected if users' sessions expired; they will be redirected to login.

**No logs at all:**
→ Application crashed before logging started. Check Railway service health (CPU, memory, restart loop).

### Secrets in logs

**Logs are checked for exposed PII:** Emails are masked (`a***@b.com`), passwords are never logged, API tokens are masked. If you see a full email or unmasked secret in a log, **file a critical defect immediately** and treat as a data exposure incident.

---

## Database

### Connection details

**On Railway:**
- `DATABASE_URL` is set automatically as a Railway secret; never commit it
- Postgres version: 17 (managed by Railway)
- Backups: automated daily; Railway retains 30 days

### Connect to the database (on-call only)

**Via Railway CLI:**
```bash
# Install: npm install -g @railway/cli
# Login: railway login

# To connect to staging database:
railway connect --environment staging

# To connect to production database:
railway connect --environment production

# This opens a `psql` shell connected to the live database
```

**DO NOT RUN** destructive commands without a backup in place. If in doubt, ask before executing `DELETE`, `DROP`, `TRUNCATE`, or any migration.

**Common diagnostic queries:**
```sql
-- Count customers
SELECT COUNT(*) FROM "Customer";

-- Recent errors or unusual status
SELECT status, COUNT(*) FROM "Customer" GROUP BY status;

-- Check for data corruption (null email)
SELECT COUNT(*) FROM "Customer" WHERE email IS NULL;

-- Most recent customers (to verify createdAt works)
SELECT name, email, "createdAt" FROM "Customer" ORDER BY "createdAt" DESC LIMIT 5;
```

### Running a migration

**Scenario:** A new feature is deployed that requires a schema change, and the migration has not run yet.

**To run migrations against staging:**
```bash
# In Railway dashboard, staging environment, Deployments tab:
# 1. Click the running service
# 2. In the Deployments tab, click the deployment's "..." menu
# 3. Select "View Logs" → look for any migration errors
#
# Migrations run automatically on every deploy (via `prisma migrate deploy` in the build script)
# If a migration fails, the deploy aborts and fails the health check

# To check migration status:
railway shell
  # Inside the shell:
  npx prisma migrate status
  npx prisma migrate resolve --rolled-back <migration-name>  # if a migration failed
```

**If a migration fails:**
1. Check the exact error in the build logs (Railway Deployments tab → click deployment → Logs)
2. File a defect with the error text
3. Do not promote to production until the migration passes in staging

### Restore from backup (catastrophic data loss only)

**This is a last-resort action. Talk to DevOps before attempting.**

```bash
# Railway automatically backs up the database daily
# To restore from a specific point-in-time:
# 1. In Railway dashboard, PostgreSQL service
# 2. Backups tab → select the backup date
# 3. Click "Restore"
# 4. This creates a new database; you must manually redirect DATABASE_URL to it
```

---

## Secrets and authentication

### List current secrets

```bash
# In Railway dashboard, environment settings:
# 1. Click the environment name (staging or production)
# 2. Variables tab
# 3. Secrets are shown encrypted (Railway does not display the values)
```

**Current secrets:**
- `AUTH_SECRET` — signing key for JWTs and cookies; random 32-byte hex
- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_URL` — callback URL for OAuth redirects (e.g., `https://crm.railway.app`)
- `NODE_ENV` — `staging` or `production`

### Rotate a secret

**Scenario:** You suspect `AUTH_SECRET` was compromised, or you are rotating it on a schedule.

**To rotate `AUTH_SECRET`:**

```bash
# 1. Generate a new secret:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. In Railway dashboard, environment settings:
#    - Click Variables
#    - Click the AUTH_SECRET row
#    - Paste the new value (do NOT commit it to Git)
#    - Save
#
# 3. Railway redeploys the service with the new secret automatically
#
# 4. Existing users' cookies are invalidated (they will see an auth error and
#    be redirected to login on the next request)
#
# 5. Verify the deploy succeeded and /api/health returns 200

curl -s https://crm.railway.app/api/health | jq .
```

**To rotate `DATABASE_URL`:**

Do not rotate the database URL unless you are migrating to a new database. If you rotate it, all active sessions lose database connectivity immediately. Talk to DevOps first.

---

## Account Management

### The one admin account

v1 has exactly **one** ops-seeded admin account. There is:
- No self-registration
- No user list
- No self-service password reset
- No roles or permissions model

All account operations are runbook procedures.

### Create a new user account (not supported in v1)

User creation is not a product feature in v1. If you need to create a second account, that is a product decision that requires a CTO approval (scope change).

### Reset the admin password

**Use this procedure if:**
- You have forgotten the admin password
- The admin account has been compromised
- You are rotating credentials on a schedule

**Prerequisites:**
- Access to the Railway dashboard (the environment you are resetting)
- The ability to run a Node.js script (provided by Railway)

**Step 1: Generate a new password**

Passwords must be ≥ 8 characters. Generate a strong random password:

```bash
# Using OpenSSL (UNIX/Linux/Mac)
openssl rand -base64 12

# Example output: "Gx7nK2pQwR9vL4mB"
#
# Do NOT paste a real password into this runbook. If you did, that's a
# production incident — rotate it immediately.
```

**Step 2: Run the admin reset script on Railway**

The reset script is owned by [TAH-19](/TAH/issues/TAH-19) and located at `scripts/ensure-admin.ts`. Railway runs it as a one-off command:

```bash
# For staging:
railway run --environment staging npm run seed

# For production:
railway run --environment production npm run seed
```

This script:
1. Checks if an admin user exists
2. If yes, updates their password to a strong generated value
3. If no, creates one with a strong generated value
4. Logs the new credentials to stdout

**What you will see:**
```
Admin user created/updated:
Email: admin@micro-crm.local
Password: [generated strong password printed once]
```

**IMPORTANT:** Write down the password. Railway does not persist it. Once the script completes, that password is the only way back in.

**Step 3: Update the Railway secret**

The admin password is NOT stored in Railway secrets (secrets are for service configuration, not user credentials). The password is hashed in the database and cannot be recovered.

If you need to log in:
1. Use the email `admin@micro-crm.local` (or the email in the script output)
2. Use the password printed by the script above

**Step 4: Verify**

```bash
# Test the login
curl -s -X POST https://crm.railway.app/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@micro-crm.local","password":"[the-generated-password]"}'

# Should return a session cookie (Set-Cookie header)

# Verify the app is still healthy
curl -s https://crm.railway.app/api/health | jq .
# Should return 200 {"status":"ok","db":"ok"}
```

**Step 5: Session behavior**

When you reset the admin password:
- **Existing active sessions:** Remain valid for their original session duration (default: 7 days). A user currently logged in will stay logged in.
- **To revoke existing sessions immediately:** There is no UI for this in v1. If you need to force a logout, you must:
  1. Rotate `AUTH_SECRET` (see "Secrets and authentication" section), which invalidates all JWTs
  2. All users will be redirected to login on their next request
  3. This is a disruptive operation; use only in a security incident

**Notes for the on-call engineer:**
- The admin account is seeded with a strong password generated by the script
- No human ever chooses this password, so password-complexity rules are not needed (and are not implemented)
- The login throttle (10 attempts per 15 min per IP/email) is your only protection against brute force
- If the admin account is locked out, use this runbook procedure to reset

---

## Troubleshooting

### "Site is down" — no response from the app

**Steps:**
1. Check `/api/health` — if it responds 503, see the "Health Check" section
2. Check Railway deployments (Deployments tab) — is a new deployment stuck?
3. Check if the service is restarting (Logs tab, look for crash loops)
4. If the deployment is stuck or crashing:
   - Click the three-dot menu on the latest deployment → Redeploy
   - This restarts the last healthy deployment
   - If that fails, rollback manually (see "Rollback" section)
5. File an incident ticket with the error

### "Login is failing" — user cannot authenticate

**Steps:**
1. Check the logs (filter for "error" or the user's email)
2. Common causes:
   - **User's password is wrong** → verify password by checking if `/api/auth/callback/credentials` returns 422
   - **User is rate-limited** → check logs for "rate_limited"; user must wait 15 minutes
   - **Database is down** → check `/api/health`; if `db: error`, see "Database" section
   - **AUTH_SECRET was rotated** → user's session cookie is no longer valid; they must log in again
3. If none of the above, file a defect

### "Customer data disappeared" — rows are missing from the table

**Steps:**
1. Check database backups (Railway Backups tab)
2. If the data was deleted via the app (not a database corruption), it is unrecoverable (hard deletes are permanent by design)
3. Restore from a backup if needed (see "Database" section) — this is a last-resort action
4. File an incident ticket

### "Password rule is not enforced" — user can log in with a short password

**The login password floor is 8 characters.** If a user successfully logs in with <8 chars, that is a defect. File it with:
- The email used
- The password length
- The exact time of the attempt (from logs)

### "Customer search is slow" — the customers list takes >5 seconds to load

**Steps:**
1. Check if an index is missing: `EXPLAIN (ANALYZE) SELECT * FROM "Customer" WHERE name ILIKE '%query%'`
2. Check database performance (Railway Monitoring tab → CPU, query duration)
3. If a specific query is slow, file a defect with the exact query and its EXPLAIN plan

---

## Monitoring & alerting (for the future)

Currently, we rely on manual health-check monitoring and Railway's automatic rollback. As the app matures:

- Error rate threshold: > 5% over 5 minutes → page on-call
- p95 latency > 500ms over 5 minutes → page on-call
- Database unavailable for >1 minute → page on-call
- Zero deployments per month: check if the team is shipping (not an alert, just observability)

Set these up in your monitoring tool (e.g., Datadog, New Relic) once the app is in production.

---

## Escalation

**For issues not covered by this runbook:**

1. Check the Architecture guide (`docs/architecture.md`)
2. Check ADR-001 on the project board for design decisions
3. Check recent git commits for context (who changed what, when)
4. Ask in `#engineering` Slack with:
   - What you tried
   - The exact error message
   - Links to logs
   - Time of the incident (UTC)
5. If it is a live production incident, call the on-call engineer (phone tree in Slack)
