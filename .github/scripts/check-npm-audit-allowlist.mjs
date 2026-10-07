#!/usr/bin/env node
// Fails the npm-audit CI job on any advisory that is not covered by the
// risk-acceptance allowlist, or whose acceptance has expired. See
// .github/security/npm-audit-allowlist.json (SEC-04 / TAH-24, TAH-33).
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const allowlistPath = path.join(__dirname, "..", "security", "npm-audit-allowlist.json");
const allowlist = JSON.parse(readFileSync(allowlistPath, "utf8"));

const today = new Date().toISOString().slice(0, 10);
const expired = allowlist.accepted.filter((entry) => entry.reviewBy < today);
const active = allowlist.accepted.filter((entry) => entry.reviewBy >= today);
const activeIds = new Set(active.map((entry) => entry.id));

let auditJson;
try {
  const raw = execSync("npm audit --json", {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 32,
  });
  auditJson = JSON.parse(raw);
} catch (err) {
  // npm audit exits non-zero whenever it finds any vulnerability; the JSON
  // report we need is still on stdout.
  const stdout = err.stdout?.toString();
  if (!stdout) {
    console.error("npm audit did not produce a JSON report:", err.message);
    process.exit(1);
  }
  auditJson = JSON.parse(stdout);
}

const NOISE_SEVERITIES = new Set(["low", "info"]);
const found = new Map();
for (const vuln of Object.values(auditJson.vulnerabilities ?? {})) {
  for (const via of vuln.via ?? []) {
    if (typeof via !== "object" || !via.url) continue;
    const id = via.url.split("/").pop();
    if (NOISE_SEVERITIES.has(via.severity)) continue;
    if (!found.has(id)) {
      found.set(id, { id, package: vuln.name, title: via.title, severity: via.severity });
    }
  }
}

const unaccepted = [...found.values()].filter((advisory) => !activeIds.has(advisory.id));

if (expired.length > 0) {
  console.error("The following allowlist entries are past their review date and no longer suppress the build:");
  for (const entry of expired) {
    console.error(`  ${entry.id} (${entry.package}) — review was due ${entry.reviewBy}`);
  }
  console.error("");
}

if (unaccepted.length > 0) {
  console.error("npm audit found advisories that are not covered by the risk-acceptance allowlist:");
  for (const advisory of unaccepted) {
    console.error(`  ${advisory.id} (${advisory.package}, ${advisory.severity}): ${advisory.title}`);
  }
  console.error(
    "\nEither fix the advisory, or get it risk-accepted at Level 2 (Security Engineer/CTO) and add it to " +
      ".github/security/npm-audit-allowlist.json with a rationale and a review date.",
  );
}

if (expired.length > 0 || unaccepted.length > 0) {
  process.exit(1);
}

console.log(
  `npm audit: ${found.size} advisory(ies) found (moderate severity or above), all covered by the risk-acceptance allowlist.`,
);
