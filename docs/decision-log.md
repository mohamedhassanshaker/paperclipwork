# Decision Log

Index of domain rulings, UX decisions, ADRs, regression approvals, and
accepted risks for Micro CRM. Search this before raising any human gate.

### 2026-10-08 — UX — Primary button/badge text fails WCAG AA color contrast
- **Decided by** — Frontend Engineer (agent)
- **Interaction** — [TAH-39](/TAH/issues/TAH-39)
- **Question** — `--color-primary` (#7aab32) paired with `--color-on-primary`
  (#fafafa) is the Button `primary` variant and Badge `active` tone background,
  and measures 2.61:1 — axe-core flagged it as a serious `color-contrast`
  violation (WCAG 2 AA requires 4.5:1 for normal-size text). How do we clear
  AA without inventing a new hue or touching non-text uses of `--color-primary`
  (chart fills, borders, focus ring, the logo monogram tile)?
- **Decision** — Text-bearing primary surfaces (Button `primary`, Badge
  `active`) now use the existing `--color-primary-strong` token (#4e7a1b,
  4.88:1 against `--color-on-primary`) instead of `--color-primary`. Added one
  new token, `--color-primary-strong-hover` (#456b18, darker still), for the
  button's hover state so the interactive state also clears AA. `--color-primary`
  and `--color-primary-hover` are untouched and keep serving non-text uses
  (chart fills/bars, borders, focus ring) where the 3:1 non-text threshold
  already applied and nothing was broken.
- **Rationale** — `--color-primary-strong` already existed in the palette
  (used for link/active-nav text on light backgrounds) and already clears AA
  by a comfortable margin, so reusing it is the smallest, most reversible
  change: no new hue to justify, no risk to chart/graphical contrast, and the
  option other components already reference as "the strong brand color."
  Changing `--color-primary` itself was rejected — it would recolor every
  chart fill, swatch, and focus ring sitewide for a text-contrast problem that
  only applies to two components. Tradeoff accepted: `--color-primary-strong`
  was previously single-purpose (active-nav-link text in `Sidebar.tsx` on
  `--color-primary-subtle`); it now backs three unrelated visual roles. A
  future change to this token for any one consumer must check all three
  (`Button.tsx`, `Badge.tsx`, `Sidebar.tsx`) before shipping.
- **Applies to** — `Button` `primary` variant, `Badge` `active` tone. Does
  not apply to `BarChart`/`Donut`/`RegionBars` fills, borders, or the
  `focus-ring` utility, which remain on `--color-primary`/`--color-primary-hover`
  (non-text, 3:1 threshold, unaffected by this ruling). The login/sidebar logo
  monogram tile (`Sidebar.tsx`, `LoginForm.tsx` — single-letter brand mark) is
  left on `--color-primary` under the WCAG 1.4.3 logotype exception; it still
  measures 2.61:1 by the numbers. Note this repo has no axe-core/contrast CI
  check on `main` today (the one that caught this defect lives only on the
  still-open `test/e2e-playwright` branch, PR #6) — the monogram tile not
  being flagged in that run is not standing proof the exception holds, only
  that this run didn't exercise it. Revisit if that changes.
- **Supersedes** — none.
- **Tasks affected** — [TAH-39](/TAH/issues/TAH-39).
