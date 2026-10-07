# Railway runbook — micro CRM (TAH-22)

Two isolated Railway **projects** stand in for the two environments. A
Railway "Environment" object would have been the first choice (one project,
`staging` + `production` environments), but the MCP tool surface connected to
this agent has no `environmentCreate`/`railway environment new` equivalent —
confirmed by enumerating the full tool list and by `search-docs`, which shows
the primitive exists in the CLI and public API but not here. Two projects give
the same isolation guarantee (separate DB, separate credentials, no shared
network) with the tools actually available, so provisioning went ahead rather
than wait on a human to click "+ New Environment" for a non-decision. Revisit
in the dashboard if/when the gap closes.

| | Project | Environment | Branch | Service | Domain |
|---|---|---|---|---|---|
| **Production** | `micro-crm` (`cdb1e4f5-80e0-487a-a9b3-ed845f2ef498`) | `production` (`709b0038-0705-444c-829f-ed5218b83980`) | `main` | `crm-app` (`b3a3cf15-886d-4837-8a66-c2d293cf5362`) | https://crm-app-production-ca33.up.railway.app |
| **Staging** | `micro-crm-staging` (`8245310a-24a5-491f-9448-4a0c9f370ae7`) | `production` (`e4cf5a80-454b-4237-8d02-ba1ba6f74c64`, Railway's default name — functions as staging) | `develop` | `crm-app` (`5c656c90-a842-4a7d-be9c-563cf9063a61`) | https://crm-app-production-c34e.up.railway.app |

Each project also has its own `Postgres` service (official `postgres-ssl:18`
template image), its own `DATABASE_URL`, its own `AUTH_SECRET`, and its own
seed-admin credentials. Nothing is shared between staging, production, or any
other Railway project in this workspace (including the payment gateway's
estate) — that isolation is the condition ADR-001's human approval depends on.

Known naming deviation: the interface-contract (§8.4) and `package.json` use
`micor-crm`; the Railway project was created as `micro-crm` before the typo
was caught. Cosmetic only — no tool in this agent's surface renames a Railway
project. Flagged for the CTO/account holder to correct in the dashboard if it
matters; does not affect isolation, routing, or any of the above.

## Build / release / deploy, both environments

- **Build**: `npm ci && npm run build`
- **Pre-deploy (release step, runs before traffic cuts over)**: `npm run db:migrate` (`prisma migrate deploy`)
- **Start**: `npm run start` (honours Railway's injected `$PORT`)
- **Health check**: `GET /api/health`, 200 `{"status":"ok","db":"up"}`, timeout 120s
- **Restart policy**: `ON_FAILURE`, max 3 retries — a crash loop rolls itself back to the last healthy deployment rather than serving a broken replica
- **CI gate**: both services track a branch (`main` / `develop`) that only advances once GitHub's required `verify` check (lint, typecheck, test, build) passes — enforced by branch protection on `main` (TAH-21), and `develop` is fast-forwarded from `main` only after `verify` is green there too. Railway never deploys unreviewed code.

## Deploy

Normal path: merge a reviewed PR into `main` (production) or `develop`
(staging). Railway's GitHub integration builds and deploys automatically.

Manual trigger (e.g. to pick up commits merged before the service existed):
```
connect-service-source(projectId, serviceId, repo, branch)   # re-attaches and builds immediately
# or, once a service has deployed at least once:
redeploy(projectId, serviceId, environmentId)                 # reuses the last build
redeploy(projectId, serviceId, environmentId, deploymentId=X) # rebuilds nothing, just re-runs deployment X's image
```

## Roll back

No new human approval is required to roll back to a previously-deployed
release (company policy — rollback to an approved release is always allowed).

```
list-deployments(projectId, serviceId)      # find the last SUCCESS deployment
paperclip-railway-rollback(projectId, environmentId, serviceId, deploymentId)
```
Then re-probe `/api/health` to confirm the rolled-back version is serving.

## Read logs

```
get-logs(projectId, serviceId, environmentId, types: ["deploy","build","http"])
```

## Connect to the database

`DATABASE_URL` is a Railway reference variable (`${{Postgres.DATABASE_URL}}`)
on `crm-app` in both projects — never a literal value. For direct `psql`
access, open a TCP proxy on the `Postgres` service (port 5432) via
`create-tcp-proxy` and use the credentials from Railway's variable store.
Never paste a `DATABASE_URL` or its password into a comment, log, or fixture.

## Rotate a secret

```
set-variables(projectId, serviceId, environmentId, variables: { "AUTH_SECRET": "<new value>" })
```
Railway redeploys the affected service automatically. Rotating `AUTH_SECRET`
invalidates every session signed with the old value — expected, not a bug.

## Abort thresholds (armed before any canary/promotion traffic)

- HTTP error rate (5xx) over the window: **> 1%** → automatic rollback
- p95 latency: **> 1500ms** sustained over the window → automatic rollback
- Failed/crashed deployment or failed health check on any replica → automatic
  rollback to the last `SUCCESS` deployment, immediately, no approval needed
- Reconciliation mismatch: not applicable — no payment/financial data in this
  system (ADR-001, out of PCI DSS scope)

These are enforced today via Railway's own healthcheck-triggered restart/
rollback behaviour (`ON_FAILURE`, 3 retries, then the deployment is marked
unhealthy and the previous one keeps serving) plus the rollback drill above,
which is rehearsed, not theoretical — see the evidence posted on
[TAH-22](/TAH/issues/TAH-22).
