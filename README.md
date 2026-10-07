# Micro CRM

A bilingual (EN/AR, full RTL) customer management app. Next.js 15 App Router,
TypeScript, Tailwind v4, `next-intl`.

## Requirements

- Node >= 24
- npm

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects to the
default locale (`/en`).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build on `$PORT` (default `3000`) — required by Railway |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit/component tests |
| `npm run format` / `format:check` | Prettier |

## Environment variables

None are required to run the scaffold in this repo yet. `DATABASE_URL` and
auth-related variables are introduced by the data-layer and auth tracks.

## Locale and RTL

- Routes are locale-prefixed: `/en/...`, `/ar/...` (`next-intl`, `localePrefix: "always"`).
- The locale preference is persisted in a cookie (`NEXT_LOCALE`), not
  `localStorage`, so the server can read it and render the correct `dir` and
  font on the first paint — no LTR flash before hydration.
- `<html dir>` is derived from the active locale. Styling uses CSS logical
  properties only (`inset-inline-*`, `margin-inline-*`, `text-start`/`text-end`,
  etc.) so the layout mirrors correctly under `dir="rtl"`.
- Design tokens (colour, type, radius, spacing, shadow, z-index) live in
  `app/globals.css` as a Tailwind v4 `@theme` block, per ADR-001 Appendix A.
