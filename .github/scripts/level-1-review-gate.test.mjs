// Self-test for the binding Level 1 review gate (TAH-66).
// Stubs the GitHub API with a local server and runs the real script as a child
// process, so the decision logic is exercised end to end without CI round-trips.
import { createServer } from "node:http";
import { writeFileSync, mkdtempSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const SCRIPT = process.argv[2] ?? new URL("./level-1-review-gate.mjs", import.meta.url).pathname;
const HEAD = "a".repeat(40);
const OLD = "b".repeat(40);

let state = {};
const server = createServer((req, res) => {
  const p = req.url.split("?")[0];
  let body = [];
  if (p.endsWith("/reviews")) body = state.reviews ?? [];
  else if (p.endsWith("/comments")) body = state.comments ?? [];
  else if (p.endsWith("/files")) body = state.files ?? [];
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const dir = mkdtempSync(path.join(tmpdir(), "gate-"));

const review = (body, at = "2026-10-08T06:00:00Z") => ({ body, submitted_at: at, html_url: "https://x/r" });
const comment = (body, at = "2026-10-08T06:00:00Z") => ({ body, created_at: at, html_url: "https://x/c" });
const verdict = (v, dim, sha = HEAD) =>
  `LEVEL-1-VERDICT: ${v}\nDimension: ${dim}\nCommit: ${sha}\nReviewer: Security Engineer\nIssue: TAH-60`;

const CASES = [
  ["T1  no verdict at all -> blocked", { files: ["README.md"] }, "FAIL"],
  ["T2  code-review APPROVE on head -> pass", { files: ["README.md"], reviews: [review(verdict("APPROVE", "code-review"))] }, "PASS"],
  ["T3  code-review BLOCK on head -> blocked", { files: ["README.md"], reviews: [review(verdict("BLOCK", "code-review"))] }, "FAIL"],
  [
    "T4  BLOCK then APPROVE on same commit -> latest wins, pass",
    { files: ["README.md"], reviews: [review(verdict("BLOCK", "code-review"), "2026-10-08T06:00:00Z"), review(verdict("APPROVE", "code-review"), "2026-10-08T07:00:00Z")] },
    "PASS",
  ],
  [
    "T5  APPROVE then BLOCK -> binding rejection, blocked",
    { files: ["README.md"], reviews: [review(verdict("APPROVE", "code-review"), "2026-10-08T06:00:00Z"), review(verdict("BLOCK", "code-review"), "2026-10-08T07:00:00Z")] },
    "FAIL",
  ],
  ["T6  APPROVE bound to an older commit -> stale, blocked", { files: ["README.md"], reviews: [review(verdict("APPROVE", "code-review", OLD))] }, "FAIL"],
  ["T7  PCI path: code-review alone is not enough", { files: ["prisma/schema.prisma"], reviews: [review(verdict("APPROVE", "code-review"))] }, "FAIL"],
  [
    "T8  PCI path with code-review + security-review -> pass",
    { files: ["prisma/schema.prisma"], reviews: [review(verdict("APPROVE", "code-review"), "2026-10-08T06:00:00Z"), review(verdict("APPROVE", "security-review"), "2026-10-08T06:30:00Z")] },
    "PASS",
  ],
  ["T9  pci-scope label forces security-review", { files: ["README.md"], labels: ["pci-scope"], reviews: [review(verdict("APPROVE", "code-review"))] }, "FAIL"],
  [
    "T10 BLOCK on a non-required dimension is still binding",
    { files: ["README.md"], reviews: [review(verdict("APPROVE", "code-review")), review(verdict("BLOCK", "security-review"))] },
    "FAIL",
  ],
  [
    "T11 verdict quoted in a fenced code block is ignored",
    { files: ["README.md"], comments: [comment("example:\n\n```\n" + verdict("APPROVE", "code-review") + "\n```\n")] },
    "FAIL",
  ],
  ["T12 malformed verdict (no Commit line) does not count", { files: ["README.md"], reviews: [review("LEVEL-1-VERDICT: APPROVE\nDimension: code-review\nReviewer: X\nIssue: TAH-1")] }, "FAIL"],
  ["T13 legacy-exempt PR passes without any verdict", { number: 14, files: ["README.md"] }, "PASS"],
  [
    "T14 touching the gate also requires gate-change-review",
    { files: [".github/scripts/level-1-review-gate.mjs"], reviews: [review(verdict("APPROVE", "code-review")), review(verdict("APPROVE", "security-review"))] },
    "FAIL",
  ],
  [
    "T15 gate change with all three dimensions -> pass",
    {
      files: [".github/scripts/level-1-review-gate.mjs"],
      reviews: [review(verdict("APPROVE", "code-review")), review(verdict("APPROVE", "security-review")), review(verdict("APPROVE", "gate-change-review"))],
    },
    "PASS",
  ],
  ["T16 verdict filed as an issue comment counts", { files: ["README.md"], comments: [comment(verdict("APPROVE", "code-review"))] }, "PASS"],
  [
    "T17 two verdicts in one body -> ambiguous, rejected",
    { files: ["README.md"], reviews: [review(verdict("APPROVE", "code-review") + "\n\n" + verdict("APPROVE", "code-review"))] },
    "FAIL",
  ],
];

let failed = 0;
for (const [name, fixture, expect] of CASES) {
  const { number = 99, labels = [], files = [], reviews = [], comments = [] } = fixture;
  state = { reviews, comments, files: files.map((f) => ({ filename: f })) };
  const ev = path.join(dir, "event.json");
  writeFileSync(ev, JSON.stringify({ pull_request: { number, head: { sha: HEAD }, labels: labels.map((n) => ({ name: n })) } }));

  const r = await new Promise((resolve) => {
    const c = spawn(process.execPath, [SCRIPT], {
      env: { ...process.env, GITHUB_TOKEN: "t", GITHUB_REPOSITORY: "o/r", GITHUB_EVENT_PATH: ev, GITHUB_API_URL: base, GITHUB_STEP_SUMMARY: "" },
    });
    let out = "";
    c.stdout.on("data", (d) => (out += d));
    c.stderr.on("data", (d) => (out += d));
    c.on("close", (status) => resolve({ status, out }));
  });

  const got = r.status === 0 ? "PASS" : "FAIL";
  const ok = got === expect;
  if (!ok) failed += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}  (expected ${expect}, got ${got})`);
  if (!ok) console.log(r.out);
}

server.close();
console.log(`\n${CASES.length - failed}/${CASES.length} passed`);
process.exit(failed === 0 ? 0 : 1);
