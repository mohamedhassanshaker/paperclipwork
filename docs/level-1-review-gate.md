# Binding Level 1 review gate

Company operating rules v2 §2 make a Level 1 review verdict **binding**: a
rejection stops the merge. Before TAH-66 that was enforced only by agents
voluntarily honouring prose in a Paperclip comment. GitHub branch protection
could not see the verdict at all, so an agent that simply did not read the
review issue could merge straight through, and a BLOCK had no mechanical teeth.

This gate makes the verdict a required status check on `main`.

## Why the verdict is not a GitHub review approval

Every agent in this company pushes as the same GitHub account that opens the
pull request. GitHub refuses a real approval from the author:

```
Review Can not approve your own pull request
```

So `required_approving_review_count` can never be satisfied, and reviewing
agents can only file a `COMMENT` review. The verdict therefore lives in the
**body** of a review or comment, in a machine-readable form that the gate reads.

## Filing a verdict

Post this as a pull request review (preferred) or an ordinary pull request
comment. All five lines are required.

<pre>
LEVEL-1-VERDICT: APPROVE
Dimension: code-review
Commit: &lt;the full 40-character head SHA you reviewed&gt;
Reviewer: &lt;your agent role, e.g. Security Engineer&gt;
Issue: TAH-&lt;the review issue&gt;
</pre>

`LEVEL-1-VERDICT` is `APPROVE` or `BLOCK`. Nothing else is accepted.

### Dimensions

| Dimension | Required when |
| --- | --- |
| `code-review` | always (v2 §2) |
| `security-review` | the pull request carries a label or touches a path listed in `.github/security/level-1-review.json` — PCI-sensitive surfaces per v2 §16 |
| `gate-change-review` | the pull request changes the gate itself |

## The rules the gate enforces

- **Fails closed.** No verdict is a failure. A malformed verdict is a failure.
  An API error is a failure.
- **Bound to a commit.** A verdict counts only if its `Commit:` line is the
  current head SHA. Pushing a new commit invalidates every earlier verdict —
  the mechanical equivalent of `dismiss_stale_reviews`.
- **BLOCK is binding on any dimension**, required or not. Fix the finding, push
  the fix, and obtain a fresh APPROVE on the new commit. Re-running the check
  does not clear a BLOCK.
- **Latest verdict wins per dimension**, among verdicts bound to the head
  commit. A reviewer can correct their own verdict by filing a newer one.
- **Quoted templates are ignored.** Verdict text inside a fenced code block does
  not count, so documentation and examples are safe.
- **One verdict per body.** Two `LEVEL-1-VERDICT` lines in one comment is
  ambiguous and is rejected.
- **The gate reads its own definition from the base branch**, not from the pull
  request, so a pull request cannot rewrite the control that judges it.
- **The gate self-tests on every run** (`level-1-review-gate.test.mjs`, 17
  cases). If the self-test cannot run, the gate fails.

## What this gate does not do

It cannot tell a reviewing agent apart from the authoring agent, because they
are the same GitHub identity. The gate enforces that a verdict **exists**, is
**fresh**, covers every **required dimension**, and is **not a BLOCK**. It
records who claimed the review and under which Paperclip issue, which is the
audit trail; it does not cryptographically prove separation of duties.

Closing that last gap needs a second GitHub identity for reviewer agents, which
cannot be provisioned without a human (see TAH-66). Until then, the compensating
control is this gate plus the Paperclip review issue, where a different agent
with a different role genuinely performs the review.

## Branch protection

The context `level-1-review-gate` is required on `main` and pinned to the GitHub
Actions app, so the check cannot be satisfied by a commit status posted from an
agent's token.

## Legacy exemption

Pull requests #9, #14 and #16 were already open when the gate landed. They are
exempt by explicit number in `.github/security/level-1-review.json`. That list
is closed — it never grows. Every pull request opened after the gate landed is
enforced.
