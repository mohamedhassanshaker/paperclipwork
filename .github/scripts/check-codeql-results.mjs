#!/usr/bin/env node
// Fails the codeql CI job if any result carries error severity. The CodeQL
// action itself never fails the build on findings, so this makes "blocking
// on error-severity results" explicit (TAH-33 / SEC-09b).
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const dir = process.argv[2] ?? "codeql-results";

let files;
try {
  files = readdirSync(dir).filter((f) => f.endsWith(".sarif"));
} catch (err) {
  console.error(`Could not read CodeQL output directory "${dir}": ${err.message}`);
  process.exit(1);
}

if (files.length === 0) {
  console.error(`No SARIF files found in "${dir}" — did the analyze step run?`);
  process.exit(1);
}

let errorCount = 0;
for (const file of files) {
  const sarif = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
  for (const run of sarif.runs ?? []) {
    const rulesById = new Map();
    for (const rule of run.tool?.driver?.rules ?? []) {
      rulesById.set(rule.id, rule);
    }
    for (const result of run.results ?? []) {
      const rule = rulesById.get(result.ruleId);
      // CodeQL omits `level` on the result when it matches the rule's
      // default severity, so fall back to the rule's configured level.
      const level = result.level ?? rule?.defaultConfiguration?.level ?? "warning";
      if (level === "error") {
        errorCount += 1;
        console.error(`[error] ${result.ruleId}: ${result.message?.text ?? "(no message)"}`);
      }
    }
  }
}

if (errorCount > 0) {
  console.error(`\nCodeQL found ${errorCount} error-severity result(s). Failing the build.`);
  process.exit(1);
}

console.log("CodeQL: no error-severity results.");
