# Micro CRM

A bilingual (EN/AR, full RTL) customer management application for internal use. Built with Next.js 15 (App Router), TypeScript, Tailwind CSS v4, and PostgreSQL.

**Stack:** Next.js 15 · TypeScript · PostgreSQL + Prisma ORM · Auth.js (NextAuth v5) · Tailwind v4 · next-intl for i18n.

**Live environments:** Staging and production on [Railway](https://railway.app). Deployments from GitHub (`main` → production, `develop` → staging).

**Dashboard.** Three stat tiles (total/active/inactive customers), a 12-month new-customer bar chart, customer-status donut. Plus illustrative sample-data cards (revenue and region breakdowns, marked as sample data by design, not unfinished features — see ADR-001 §3).

**Customers screen.** Searchable table (name, email, phone, company, status). Create, edit, delete with confirmation. Soft single-tenant: one ops-seeded admin, no self-registration or roles in v1 (see `docs/runbook.md` for account management).

## What the app is not

- **No payment processing** — this is out of PCI DSS scope; no cardholder data is stored or processed.
- **No self-service registration or password reset** — both are runbook operations (see `docs/runbook.md`).
- **No role or permission model in v1** — roles are a roadmap item. Every authenticated user has full access.

## Prerequisites

- Node.js ≥ 24
- npm
- PostgreSQL (local development) or Railway `DATABASE_URL` (staging/production)

## Local setup

```bash
npm install
```

### Environment variables

Create a `.env.local` file in the repository root:

```bash
# Database — connect to your local PostgreSQL instance or use Railway's staging database
DATABASE_URL="postgresql://user:password@localhost:5432/micro_crm?schema=public"

# Auth — a cryptographically secure random string for signing auth cookies and JWTs
# Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
AUTH_SECRET="<your-generated-secret-here>"

# Callback URL for OAuth redirects — for local dev, use localhost
AUTH_URL="http://localhost:3000"

# Node environment
NODE_ENV="development"
```

**On Railway:** These variables are set via the Railway dashboard; `.env.local` is not needed and must never contain live secrets.

### Database setup

**First time only:** initialize the database schema:

```bash
npx prisma migrate deploy
```

**Seed the admin account** (creates an ops-only admin user with a strong generated password):

```bash
npm run seed
```

This command is idempotent — it can be run multiple times safely. It uses `prisma/seed.ts` to insert the admin user if it does not exist. **Never modify this seed directly** — account creation is a runbook operation; see `docs/runbook.md`.

To **reset the database completely** (warning: destructive):

```bash
npx prisma migrate reset
```

This drops all data, re-runs migrations, and re-runs the seed.

## Running locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (automatically redirects to `/en` or `/ar` based on the stored locale preference).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server (Turbopack), watch mode |
| `npm run build` | Production build; fails if there are type errors or lint violations |
| `npm run start` | Serve the production build on `$PORT` (default `3000`); used by Railway |
| `npm run lint` | ESLint over `app/`, `components/`, `lib/` — fails on error |
| `npm run typecheck` | `tsc --noEmit` — strict type checking |
| `npm test` | Vitest unit and component tests, non-watch mode; CI uses this |
| `npm run test:e2e` | Playwright end-to-end tests (requires a running dev or prod server) |
| `npm run format` / `npm run format:check` | Prettier formatting |
| `npm run seed` | Seed the database with the ops-only admin account |

## Project layout

```
├── app/                     # Next.js App Router pages and API routes
│   ├── [locale]/            # Locale-prefixed routes (en / ar)
│   │   ├── login/           # Login screen
│   │   └── (app)/           # Protected routes behind auth middleware
│   │       ├── dashboard/   # Dashboard page
│   │       └── customers/   # Customers table, create/edit modals
│   ├── api/
│   │   ├── auth/            # Auth.js NextAuth routes
│   │   ├── customers/       # CRUD endpoints
│   │   ├── dashboard/stats/ # Stats rollup
│   │   └── health/          # Health check for Railway
│   ├── globals.css          # Tailwind config, design tokens (@theme block)
│   └── layout.tsx           # Root layout, provider wiring
├── components/
│   ├── ui/                  # Buttons, inputs, dialogs, cards, etc.
│   └── charts/              # Bar chart, donut, area chart components
├── lib/
│   ├── db.ts                # Prisma client singleton
│   ├── repository/          # Customer and User repository interfaces
│   ├── validation.ts        # Zod schemas (shared by API and forms)
│   ├── demo-data.ts         # Sample data for revenue and region cards (marked clearly)
│   └── auth.ts              # Auth.js configuration
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── seed.ts              # Seed script for admin user
├── messages/
│   ├── en.json              # English i18n catalogue
│   └── ar.json              # Arabic i18n catalogue
├── middleware.ts            # Auth and locale middleware
├── .github/workflows/ci.yml # GitHub Actions CI
├── docs/
│   ├── architecture.md      # System design and request flow
│   ├── runbook.md           # Operations guide: deploy, rollback, triage, secrets
│   └── i18n.md              # Internationalization setup
└── CONTRIBUTING.md          # Git workflow, commit message format, review process
```

## Internationalization (i18n)

- **Locales:** English (`en`) and Arabic (`ar`), both fully supported.
- **Routes:** Locale-prefixed (`/en/dashboard`, `/ar/dashboard`); redirects use browser/cookie preference.
- **Direction:** `<html dir="ltr">` for English, `<html dir="rtl">` for Arabic.
- **Styling:** CSS logical properties only (`inset-inline-*`, `margin-inline-*`, `text-start`/`text-end`) so layouts mirror correctly.
- **Font:** IBM Plex Sans Arabic is loaded for Arabic; Geist for English.
- **Preference persistence:** Stored in a cookie (`NEXT_LOCALE`), not `localStorage`, so the server can render the correct `dir` and font on the first paint (no RTL flash).
- **Message parity:** CI enforces that `messages/en.json` and `messages/ar.json` have identical key sets; missing or extra keys cause the build to fail.

See `docs/i18n.md` for how to add or change strings.

## Architecture & design

For system architecture, request flow, and design-token reference, see `docs/architecture.md`.

For operations, deployment, secrets, and troubleshooting, see `docs/runbook.md`.

## Dashboard sample data

The two dashboard cards — **Monthly revenue** and **Customers by region** — render illustrative sample data by design, not from a data model. There is no revenue or region field on customers, and adding them is a separate product decision (see ADR-001 §3 and the ASSUMPTION-1 ruling on TAH-17). The cards are clearly marked with a "Sample data" label. This design prevents an engineer from mistaking them for a feature to complete.
