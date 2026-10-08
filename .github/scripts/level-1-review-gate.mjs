#!/usr/bin/env node
// Binding Level 1 review gate (TAH-66).
//
// Company operating rules v2 §2 make a Level 1 review verdict binding: a
// rejection stops the merge. Until this gate existed that was enforced only by
// agents voluntarily honouring prose in a Paperclip comment — GitHub branch
// protection could not see the verdict at all. Every agent pushes as the same
// GitHub account that opens the PR, so GitHub refuses a real APPROVE review
// ("Can not approve your own pull request") and the verdict can only be filed
// as a COMMENT review, which satisfies nothing.
//
// This script turns the verdict into a required status check. It reads the
// machine-readable verdict blocks that reviewing agents post on the PR, binds
// each one to the exact head commit, and fails the check unless every required
// dimension carries a fresh APPROVE. It fails closed: no verdict is a failure,
// a stale verdict is a failure, and a BLOCK is a failure that no amount of
// re-running will clear.
//
// See docs/level-1-review-gate.md for the verdict format and the rules.
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, "..", "security", "level-1-review.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));

const token = process.env.GITHUB_TOKEN;
const repoSlug = process.env.GITHUB_REPOSITORY;
const eventPath = process.env.GITHUB_EVENT_PATH;

if (!token || !repoSlug || !eventPath) {
  fail("The gate could not read its own inputs (GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_EVENT_PATH). A check that cannot run is a check that failed.");
}

const event = JSON.parse(readFileSync(eventPath, "utf8"));
const pr = event.pull_request;
if (!pr) {
  fail("No pull_request in the event payload; this gate only runs on pull requests.");
}

const prNumber = pr.number;
// The verdict is bound to a commit, not to a pull request. A push invalidates
// every verdict that came before it, which is the mechanical equivalent of
// GitHub's dismiss_stale_reviews.
const headSha = pr.head.sha.toLowerCase();

const lines = [];
const say = (s = "") => lines.push(s);

say(`# Level 1 review gate`);
say();
say(`- Pull request: **#${prNumber}**`);
say(`- Head commit: \`${headSha}\``);
say();

const legacy = new Set(config.legacyPullRequests?.numbers ?? []);
if (legacy.has(prNumber)) {
  say(`## Result: PASS (legacy exemption)`);
  say();
  say(
    `PR #${prNumber} was already open when this gate landed (TAH-66) and is on the closed exemption list in \`.github/security/level-1-review.json\`. It proceeds under the previous, prose-only rule. The list never grows; every pull request opened after the gate landed is enforced.`,
  );
  finish(0);
}

const apiBase = (process.env.GITHUB_API_URL ?? "https://api.github.com").replace(/\/$/, "");

const api = async (urlPath) => {
  const res = await fetch(`${apiBase}${urlPath}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "level-1-review-gate",
    },
  });
  if (!res.ok) {
    fail(`GitHub API ${urlPath} returned ${res.status}. A check that cannot run is a check that failed.`);
  }
  return res.json();
};

const paged = async (urlPath) => {
  const out = [];
  for (let page = 1; page <= 10; page += 1) {
    const sep = urlPath.includes("?") ? "&" : "?";
    const batch = await api(`${urlPath}${sep}per_page=100&page=${page}`);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
};

const [reviews, comments, files] = await Promise.all([
  paged(`/repos/${repoSlug}/pulls/${prNumber}/reviews`),
  paged(`/repos/${repoSlug}/issues/${prNumber}/comments`),
  paged(`/repos/${repoSlug}/pulls/${prNumber}/files`),
]);

const changedPaths = files.map((f) => f.filename);
const labels = (pr.labels ?? []).map((l) => l.name.toLowerCase());

// Which dimensions must carry a fresh APPROVE before this PR can merge.
const required = new Set(config.requiredDimensions ?? ["code-review"]);

const securityByLabel = (config.securityReview?.labels ?? []).filter((l) => labels.includes(l.toLowerCase()));
const securityByPath = changedPaths.filter((p) =>
  (config.securityReview?.paths ?? []).some((glob) => globToRegExp(glob).test(p)),
);
if (securityByLabel.length > 0 || securityByPath.length > 0) {
  required.add("security-review");
}

// Changing the gate itself needs its own explicit verdict, so a rewrite of the
// control cannot ride in on an ordinary code review.
const gateFilesTouched = changedPaths.filter((p) => (config.gateFiles ?? []).includes(p));
if (gateFilesTouched.length > 0) {
  required.add("gate-change-review");
}

say(`## Required dimensions`);
say();
for (const dim of required) {
  let why = "always required (v2 §2)";
  if (dim === "security-review") {
    why = securityByLabel.length
      ? `label: ${securityByLabel.join(", ")}`
      : `path: ${securityByPath.slice(0, 5).join(", ")}${securityByPath.length > 5 ? ` (+${securityByPath.length - 5} more)` : ""}`;
  }
  if (dim === "gate-change-review") why = `gate files changed: ${gateFilesTouched.join(", ")}`;
  say(`- \`${dim}\` — ${why}`);
}
say();

// ---------------------------------------------------------------------------
// Parse verdicts
// ---------------------------------------------------------------------------

const carriers = [
  ...reviews.map((r) => ({
    kind: "review",
    body: r.body ?? "",
    at: r.submitted_at ?? "",
    url: r.html_url,
  })),
  ...comments.map((c) => ({
    kind: "comment",
    body: c.body ?? "",
    at: c.created_at ?? "",
    url: c.html_url,
  })),
];

const verdicts = [];
const malformed = [];

for (const carrier of carriers) {
  // Strip fenced code so documentation that quotes the template cannot be
  // mistaken for a real verdict.
  const body = carrier.body.replace(/```[\s\S]*?```/g, "").replace(/~~~[\s\S]*?~~~/g, "");
  if (!/^[ \t]*LEVEL-1-VERDICT:/im.test(body)) continue;

  const occurrences = body.match(/^[ \t]*LEVEL-1-VERDICT:/gim) ?? [];
  if (occurrences.length > 1) {
    malformed.push({ ...carrier, reason: "more than one LEVEL-1-VERDICT line in a single body" });
    continue;
  }

  const verdict = field(body, "LEVEL-1-VERDICT", /(APPROVE|BLOCK)/);
  const dimension = field(body, "Dimension", /([a-z0-9-]+)/);
  const commit = field(body, "Commit", /([0-9a-f]{40})/i);
  const reviewer = field(body, "Reviewer", /(\S[^\n]*?)/);
  const issue = field(body, "Issue", /(TAH-\d+)/i);

  if (!verdict || !dimension || !commit || !reviewer || !issue) {
    malformed.push({
      ...carrier,
      reason: `missing or malformed field(s): ${[
        ["LEVEL-1-VERDICT", verdict],
        ["Dimension", dimension],
        ["Commit", commit],
        ["Reviewer", reviewer],
        ["Issue", issue],
      ]
        .filter(([, v]) => !v)
        .map(([k]) => k)
        .join(", ")}`,
    });
    continue;
  }

  verdicts.push({
    verdict: verdict.toUpperCase(),
    dimension: dimension.toLowerCase(),
    commit: commit.toLowerCase(),
    reviewer,
    issue: issue.toUpperCase(),
    at: carrier.at,
    url: carrier.url,
    onHead: commit.toLowerCase() === headSha,
  });
}

verdicts.sort((a, b) => a.at.localeCompare(b.at));

say(`## Verdicts found`);
say();
if (verdicts.length === 0) {
  say(`None.`);
} else {
  say(`| Verdict | Dimension | Reviewer | Issue | Commit | On head | Filed |`);
  say(`| --- | --- | --- | --- | --- | --- | --- |`);
  for (const v of verdicts) {
    say(
      `| **${v.verdict}** | \`${v.dimension}\` | ${v.reviewer} | ${v.issue} | \`${v.commit.slice(0, 8)}\` | ${v.onHead ? "yes" : "**no — stale**"} | [link](${v.url}) |`,
    );
  }
}
say();

if (malformed.length > 0) {
  say(`### Ignored — malformed verdict blocks`);
  say();
  for (const m of malformed) say(`- [${m.kind}](${m.url}): ${m.reason}`);
  say();
  say(`A malformed verdict counts as no verdict. Repost it in the exact format from \`docs/level-1-review-gate.md\`.`);
  say();
}

// ---------------------------------------------------------------------------
// Decide
// ---------------------------------------------------------------------------

const onHead = verdicts.filter((v) => v.onHead);
const failures = [];

// A BLOCK is binding on every dimension, required or not.
for (const dim of new Set(onHead.map((v) => v.dimension))) {
  const latest = onHead.filter((v) => v.dimension === dim).at(-1);
  if (latest.verdict === "BLOCK") {
    failures.push(
      `\`${dim}\`: **BLOCK** from ${latest.reviewer} (${latest.issue}) — ${latest.url}. A Level 1 rejection is binding and stops the merge. Fix the finding, push the fix, and obtain a fresh APPROVE on the new commit.`,
    );
  }
}

for (const dim of required) {
  const latest = onHead.filter((v) => v.dimension === dim).at(-1);
  if (!latest) {
    const stale = verdicts.filter((v) => v.dimension === dim).at(-1);
    failures.push(
      stale
        ? `\`${dim}\`: the only verdict is bound to \`${stale.commit.slice(0, 8)}\`, not to head \`${headSha.slice(0, 8)}\`. It was invalidated by a later push. A fresh verdict on the current commit is required.`
        : `\`${dim}\`: no verdict on the head commit. This gate fails closed — an unreviewed change does not merge.`,
    );
  }
}

say(`## Result: ${failures.length === 0 ? "PASS" : "FAIL"}`);
say();
if (failures.length === 0) {
  say(`Every required dimension carries an APPROVE bound to the head commit, and no dimension is blocked.`);
  finish(0);
}

for (const f of failures) say(`- ${f}`);
say();
say(`Record the verdict on this pull request as a review or a comment, in this format:`);
say();
say("```");
say("LEVEL-1-VERDICT: APPROVE");
say("Dimension: code-review");
say(`Commit: ${headSha}`);
say("Reviewer: <your agent role>");
say("Issue: TAH-<the review issue>");
say("```");
finish(1);

// ---------------------------------------------------------------------------

function field(body, name, valueRe) {
  const re = new RegExp(`^[ \\t]*${name}:[ \\t]*${valueRe.source}[ \\t]*$`, "im");
  const m = body.match(re);
  return m ? m[1] : null;
}

function globToRegExp(glob) {
  let out = "";
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*" && glob[i + 2] === "/") {
      out += "(?:.*/)?"; // "**/" — zero or more leading directories
      i += 2;
    } else if (c === "*" && glob[i + 1] === "*") {
      out += ".*";
      i += 1;
    } else if (c === "*") {
      out += "[^/]*";
    } else if (".+^${}()|[]\\?".includes(c)) {
      out += `\\${c}`;
    } else {
      out += c;
    }
  }
  return new RegExp(`^${out}$`);
}

function finish(code) {
  const summary = lines.join("\n");
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
    } catch {
      /* summary is a convenience, never the control */
    }
  }
  process.exit(code);
}

function fail(message) {
  console.error(`level-1-review-gate: ${message}`);
  process.exit(1);
}
