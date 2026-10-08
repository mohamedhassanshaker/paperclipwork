# Contributing

This document describes the development workflow, commit format, and review process.

## Git workflow

Every change follows this flow:

```
1. Create an issue (or start with an existing one, linked in the task tracker)
2. Create a branch from the issue
3. Implement your changes
4. Open a pull request (PR)
5. Level 1 peer review (another engineer)
6. Security review (if touching auth or API)
7. CI must pass (lint, type check, build, tests)
8. Merge to the target branch
9. Automated deployment (Railway) proceeds
```

## Branch naming

Branches use the format: `{type}/{ticket-id}-{short-description}`

| Type | Use for |
|---|---|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `refactor/` | Code cleanup, no behavior change |
| `docs/` | Documentation |
| `chore/` | Dependencies, build config |
| `test/` | Test improvements, no code change |

**Examples:**
```bash
git checkout -b feat/TAH-20-dashboard-cards
git checkout -b fix/TAH-23-login-throttle-race-condition
git checkout -b docs/TAH-25-runbook-update
```

**Base branch:**
- New features and fixes → branch from `develop`
- Release or production hotfixes → branch from `main` (rare; post-incident)

## Commits

Every commit must include the **exact trailer:**

```
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

This trailer identifies work done under the Paperclip agent system and appears in the git history.

### Commit message format

```
<subject line, 1 line, 50 chars max>

<body, wrapped at 72 chars>
<blank line>
<blank line>
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

**Good commit messages:**
```
Add login rate throttle (10 attempts per 15 min)

Implements the Postgres-backed login throttle per TAH-19 spec.
Throttling is per source IP and per email address. A successful
login clears the counter. The response is identical for a real and
a non-existent email (no account enumeration).

Fixes: TAH-19

Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

```
Fix: revert TAH-22 rollback-drill breakage of /api/health

The rollback drill (TAH-22) forced /api/health to return 503 for
testing purposes. That change was never meant to merge; this reverts
it so health checks work normally.

Fixes: TAH-22

Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

**What to include:**
- **What changed:** the feature, bug, or refactor (subject line)
- **Why it changed:** the rationale, not just what is different (body)
- **Issue reference:** `Fixes: TAH-20` or `Relates to: TAH-19` (if applicable)
- **Breaking changes:** note them explicitly if any

**What not to include:**
- Generic messages like "Work in progress" or "Update"
- Real passwords, API keys, or secrets
- Discussion that belongs in the PR description

## Pull requests

When your branch is ready, open a PR against the target branch (`develop` for features, `main` for hotfixes).

### PR title

Keep it short and descriptive:
```
feat: Dashboard stat cards and empty state
fix: Login session expiry edge case
docs: Update runbook with rollback procedure
```

### PR description

Use the template:

```markdown
## Summary
<!-- 1–3 bullets describing the change -->

- Add login throttle: 10 failed attempts per 15 minutes per IP and email
- Return 429 with Retry-After header on throttle
- Postgres-backed counter, survives redeploy

## Testing
<!-- What did you test? How can someone else verify this? -->

- [x] Login with correct password succeeds
- [x] Login with wrong password fails; 11th attempt returns 429
- [x] Counter resets after 15 minutes
- [x] Throttle is per IP (two browsers on same IP share the counter)
- [x] Throttle is per email (same IP, different email, independent counters)

## Related issues
Fixes #TAH-19
Related to #TAH-17

## Notes for reviewers
<!-- Anything a reviewer should know? Any design decisions or trade-offs? -->

The throttle is stored in Postgres (not in-memory) so it survives Railway 
redeploys. This adds one query per failed login, but only on the error path.
```

## Review process

### Level 1: Peer review

Every PR must be reviewed by another engineer before merge. The reviewer checks:

- **Correctness:** Does the change do what it claims to do?
- **Tests:** Are there tests? Do they pass?
- **Code quality:** Is it readable? Any obvious bugs or performance issues?
- **Style:** Does it follow the project's conventions (branch naming, commit format, linting)?

The review is **binding:** a rejection blocks merge until addressed.

**To request review:** Assign the PR to another engineer on the team.

### Level 1+: Security review

If the PR touches **authentication**, **API routes**, or **sensitive data handling**, a Security Engineer must also review.

**Triggers security review automatically:**
- Changes to `app/api/auth/` (auth logic)
- Changes to `app/api/customers/` or other API routes
- Database schema changes related to User or sensitive fields
- Any new dependency (security review of the dependency itself)

**The security reviewer checks:**
- No SQL injection or XSS
- Input validation is comprehensive
- Secrets are not logged or exposed
- Password handling is correct
- Rate limiting is in place where needed

Both the peer review and security review must pass before merge.

### CI gates

Automatic checks run on every PR:

1. **Lint:** `npm run lint` — ESLint must pass
2. **Type check:** `npm run typecheck` — TypeScript strict mode
3. **Build:** `npm run build` — Next.js build must succeed
4. **Unit tests:** `npm run test` — All Vitest tests pass
5. **Secret scan:** No API keys or passwords in the diff
6. **Dependency audit:** `npm audit` (advisory-only for now; see issues)

All checks must pass before merge is allowed. No exceptions.

## Merging

Once peer review and security review (if applicable) are approved, and CI passes:

1. Merge the PR (GitHub UI: green merge button)
2. The merge triggers GitHub Actions CI again
3. If CI passes on the merge commit, Railway auto-deploys:
   - `develop` branch → staging environment
   - `main` branch → production environment (rare; requires release approval first)

## After merge

- Monitor the deployment in Railway dashboard (Deployments tab)
- Check `/api/health` on the target environment
- If the deploy fails, Railway auto-rolls back to the previous good deployment
- If you see an error, file a defect with:
  - The exact error message
  - The commit SHA that was deployed
  - Links to logs

## Testing

### Unit and component tests

```bash
npm run test
```

Write tests for:
- API routes (mock Prisma, test validation and response shapes)
- Client components (mock next-intl, test rendering and interactions)
- Utilities (test edge cases: empty input, nulls, large numbers)

Use Vitest's `describe`, `it`, `expect` (Vitest covers all of these).

Example:
```typescript
// lib/validation.test.ts
import { describe, it, expect } from 'vitest';
import { validateEmail } from './validation';

describe('validateEmail', () => {
  it('accepts valid email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });

  it('rejects email without @', () => {
    expect(validateEmail('user.example.com')).toBe(false);
  });

  it('rejects email without domain', () => {
    expect(validateEmail('user@')).toBe(false);
  });
});
```

### E2E tests

```bash
npm run test:e2e
```

Run against a running dev server:

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run test:e2e
```

E2E tests verify user flows end-to-end:
- Login flow
- Create, edit, delete customer
- Search and filter
- Locale switching (both languages)
- Mobile responsive layout (if applicable)

See `e2e/` for examples.

### Manual testing

For features that affect UX:
1. Run `npm run dev`
2. Test in both locales (EN and AR)
3. Test on desktop and mobile (browser dev tools)
4. Test accessibility (keyboard nav, screen reader if applicable)

## Code style

- **Formatting:** Prettier (run `npm run format`)
- **Linting:** ESLint (run `npm run lint`)
- **Type checking:** TypeScript strict mode (run `npm run typecheck`)
- **Naming:** camelCase for variables/functions, PascalCase for components and types

Example:
```typescript
// Good
const getCustomerById = async (id: string): Promise<Customer> => {
  const customer = await prisma.customer.findUnique({ where: { id } });
  return customer;
};

export const CustomerCard = ({ name, email }: CustomerProps) => {
  return <div>{name}</div>;
};
```

## When stuck

- Check recent commits (`git log --oneline`) to see how similar things were done
- Read the architecture guide (`docs/architecture.md`) and ADR-001 for design decisions
- Ask in Slack `#engineering` with:
  - What you're trying to do
  - What you've tried
  - The exact error
  - A link to your PR
- If it's blocking your PR, add the `help-wanted` label and notify a senior engineer

## Resources

- Architecture & design: `docs/architecture.md`
- ADR-001 (major decisions): [Link to project board TAH-14]
- i18n guide: `docs/i18n.md`
- Operations runbook: `docs/runbook.md`
