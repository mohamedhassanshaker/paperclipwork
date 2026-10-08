# Architecture — Micro CRM

**For rationale and trade-offs, see [ADR-001](/TAH/issues/TAH-14) on the project board.**

## Technology stack

- **Frontend:** Next.js 15 (App Router), TypeScript, React 19 Server Components, Tailwind CSS v4 with design tokens.
- **Backend:** Next.js API routes (Node.js runtime).
- **Database:** PostgreSQL, managed by Railway; accessed via Prisma ORM.
- **Auth:** Auth.js (NextAuth v5) with email+password provider, Argon2id password hashing, httpOnly JWT session cookies.
- **i18n:** next-intl for route-based locale selection; persistent cookie; full RTL support for Arabic.
- **Hosting:** Railway (two environments: staging, production).

## System architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Client)                                           │
│  EN/AR locale, client-side form validation, charts         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Next.js App (Railway container)                           │
│                                                             │
│  Route Handler (API)              Server Component          │
│  ├── POST /api/auth/login  ←→    ├── /dashboard (fetch)   │
│  ├── GET /api/customers   ←→    ├── /customers (fetch)    │
│  ├── POST /api/customers  ←→    └── Forms (validation)    │
│  ├── PATCH /api/customers/:id                              │
│  ├── DELETE /api/customers/:id                              │
│  ├── GET /api/dashboard/stats                              │
│  └── GET /api/health (Railway health check)                │
│                                                             │
│  Middleware:                                                │
│  ├── Auth middleware (validate session cookie)              │
│  └── Locale middleware (next-intl)                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Prisma ORM                                                 │
│  ├── Zod validation (lib/validation.ts)                    │
│  └── Parameterized queries, no string-built SQL            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  PostgreSQL (Railway managed)                              │
│  ├── Customers table (id, name, email, phone, company,    │
│  │   status, createdAt, updatedAt)                        │
│  ├── Users table (id, email, passwordHash, name,          │
│  │   createdAt)                                           │
│  └── Indexes on email (unique), status, createdAt         │
└─────────────────────────────────────────────────────────────┘
```

## Request flow: authenticated read (dashboard)

```
1. Browser requests GET /en/dashboard
2. Middleware validates NEXT_LOCALE cookie → sets locale
3. Middleware validates AUTH session cookie → allows request
4. Server Component (dashboard/page.tsx) runs on server
5. fetch() to /api/dashboard/stats
6. Auth middleware validates session → allows route handler
7. Route handler queries Prisma:
   - SELECT COUNT(*) WHERE status = ACTIVE
   - SELECT COUNT(*) WHERE status = INACTIVE
   - SELECT COUNT(*)
   - SELECT DATE_TRUNC('month', createdAt), COUNT(*) (trailing 12 months)
8. Prisma executes parameterized SQL on PostgreSQL
9. Route handler returns JSON { total, active, inactive, monthly }
10. Server Component renders HTML with server data
11. Browser hydrates React and receives the props
```

## Request flow: login (authentication)

```
1. Browser requests GET /login (unauthenticated, no session cookie)
2. Middleware allows access (login is public)
3. Login form renders
4. User enters email + password, submits
5. Browser POST /api/auth/callback/credentials
6. Auth middleware skips auth check (this endpoint is unprotected)
7. NextAuth route handler receives credentials
8. Route handler queries User by email (normalized lowercase)
9. Prisma returns the user's Argon2id passwordHash
10. Next-auth verifies password hash (Argon2id.verify)
11. If match: create JWT session, sign with AUTH_SECRET, set httpOnly cookie
    If no match: increment login throttle counter (per IP, per email)
    After 10 failures in 15 min: return 429 rate_limited
12. Browser redirects to /en/dashboard (or /ar/dashboard by preference)
```

## Request flow: create customer (write)

```
1. Browser requests POST /api/customers (with session cookie)
2. Auth middleware validates JWT cookie → allows request
3. Route handler receives JSON body { name, email, phone, company, status }
4. Zod schema (lib/validation.ts) validates each field
5. If validation fails: return 422 { error, message, fields }
6. Prisma INSERT into Customers with the validated data
7. If email already exists (unique constraint): return 409 email_taken
8. Return 201 with the created Customer row
9. Browser toast: "Customer added" (client-side optimistic update)
```

## Security

- **Authentication:** Auth.js middleware on every app page (in `/app/[locale]/(app)/`). Unauthenticated users redirected to `/login`.
- **Password hashing:** Argon2id (industry standard, memory-hard, resistant to GPU attacks).
- **Session storage:** httpOnly cookies (no JavaScript access), secure flag set in production, sameSite=lax (CSRF protection).
- **Input validation:** Zod on both client (instant feedback) and server (authoritative). No string-built SQL; Prisma parameterizes all queries.
- **CORS:** Not needed (internal CRM); no cross-origin requests.
- **Rate limiting:** Login route throttled at 10 failed attempts per 15 min per IP and per email (Postgres-backed, survives redeploy).
- **Secrets:** `AUTH_SECRET` and `DATABASE_URL` injected by Railway; never committed to source.
- **Logging:** Structured JSON logs, PII masked (`a***@b.com`); passwords never logged at any level.

## Database schema

See `prisma/schema.prisma` for the authoritative source. Two tables:

**Customers**
- `id` — UUID, primary key
- `name` — string, required, 1–120 chars
- `email` — string, required, unique, lowercased
- `phone` — string, optional, 32 chars max
- `company` — string, optional, 120 chars max
- `status` — enum (ACTIVE / INACTIVE), default ACTIVE
- `createdAt` — timestamp, set on insert
- `updatedAt` — timestamp, updated on write

**Users**
- `id` — UUID, primary key
- `email` — string, required, unique, lowercased
- `passwordHash` — string, required (Argon2id)
- `name` — string, optional
- `createdAt` — timestamp, set on insert

Indexes: email (unique on both tables), status and createdAt on Customers.

## Deployment architecture

**Two Railway environments:** staging and production.

Each has:
- One Next.js service (runs the app)
- One PostgreSQL database
- Environment-specific secrets (`AUTH_SECRET`, `DATABASE_URL`, `AUTH_URL`, `NODE_ENV`)

**CI/CD pipeline:** GitHub Actions → Railway.
- `main` branch → production deployment
- `develop` branch → staging deployment
- Health check: `GET /api/health` must return `200 {"status":"ok","db":"ok"}`
- Automatic rollback to the previous healthy deployment if health check fails

**Canary & validation:** See `docs/runbook.md` for production promotion procedures.

## Design tokens and styling

All design tokens (colour, typography, radius, sizing, shadow, z-index) are defined once in `app/globals.css` as a Tailwind v4 `@theme` block and referenced throughout components. No component contains a colour or spacing literal; everything is a variable.

- **Logical properties only:** CSS uses `inset-inline-*`, `margin-inline-*`, `text-start`/`text-end`, etc., so layouts mirror correctly under `dir="rtl"` for Arabic without duplication.
- **Focus visible:** Every interactive element has focus styles (border + ring).
- **LTR regions in Arabic:** The bar chart and revenue chart axes, and the phone column, remain `dir="ltr"` even in Arabic (numbers and phone formats do not mirror).

See `app/globals.css` and ADR-001 Appendix A for the complete token table.

## Internationalization (i18n)

- **Locale routing:** Prefixed (`/en/`, `/ar/`); cookie-based preference persists across sessions.
- **Message catalogues:** `messages/en.json` and `messages/ar.json` are the single source of truth; they must have identical key sets or the build fails.
- **Server-rendered first paint:** The locale cookie is readable by the server, so `<html dir>` and the font stack are rendered correctly in the first response (no flash).
- **RTL:** Logical CSS properties ensure the layout mirrors without rewriting; no `left`/`right` in the codebase.

See `docs/i18n.md` for adding or changing strings.

## Demo data

The dashboard's "Monthly revenue" and "Customers by region" cards render hardcoded sample data from `lib/demo-data.ts`, marked with a "Sample data" label. There is no revenue or region field on `Customer`; adding them is a separate product decision (ASSUMPTION-1). This design prevents confusion about what is implemented.

---

**For operations, deployment procedures, secrets, troubleshooting, and the admin password reset runbook, see `docs/runbook.md`.**
