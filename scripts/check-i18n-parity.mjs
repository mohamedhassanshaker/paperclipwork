import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function flatten(obj, prefix = "") {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object" && !Array.isArray(value)
      ? flatten(value, path)
      : [path];
  });
}

function loadKeys(path) {
  const url = new URL(path, import.meta.url);
  const json = JSON.parse(readFileSync(fileURLToPath(url), "utf8"));
  return new Set(flatten(json));
}

const en = loadKeys("../messages/en.json");
const ar = loadKeys("../messages/ar.json");

const missingInAr = [...en].filter((key) => !ar.has(key));
const missingInEn = [...ar].filter((key) => !en.has(key));

if (missingInAr.length || missingInEn.length) {
  if (missingInAr.length) {
    console.error("Keys present in en.json but missing in ar.json:");
    for (const key of missingInAr) console.error(`  - ${key}`);
  }
  if (missingInEn.length) {
    console.error("Keys present in ar.json but missing in en.json:");
    for (const key of missingInEn) console.error(`  - ${key}`);
  }
  process.exit(1);
}

console.log(`i18n key parity OK (${en.size} keys).`);
