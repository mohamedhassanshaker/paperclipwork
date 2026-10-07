import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function flatten(obj, prefix = "") {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value)) return [[path, value.length]];
    return value && typeof value === "object"
      ? flatten(value, path)
      : [[path, null]];
  });
}

function loadEntries(path) {
  const url = new URL(path, import.meta.url);
  const json = JSON.parse(readFileSync(fileURLToPath(url), "utf8"));
  return new Map(flatten(json));
}

const en = loadEntries("../messages/en.json");
const ar = loadEntries("../messages/ar.json");

const missingInAr = [...en.keys()].filter((key) => !ar.has(key));
const missingInEn = [...ar.keys()].filter((key) => !en.has(key));
const arrayLengthMismatches = [...en.keys()]
  .filter((key) => ar.has(key) && en.get(key) !== null && en.get(key) !== ar.get(key))
  .map((key) => `  - ${key}: en has ${en.get(key)} items, ar has ${ar.get(key)} items`);

if (missingInAr.length || missingInEn.length || arrayLengthMismatches.length) {
  if (missingInAr.length) {
    console.error("Keys present in en.json but missing in ar.json:");
    for (const key of missingInAr) console.error(`  - ${key}`);
  }
  if (missingInEn.length) {
    console.error("Keys present in ar.json but missing in en.json:");
    for (const key of missingInEn) console.error(`  - ${key}`);
  }
  if (arrayLengthMismatches.length) {
    console.error("Array keys with mismatched item counts between locales:");
    for (const line of arrayLengthMismatches) console.error(line);
  }
  process.exit(1);
}

console.log(`i18n key parity OK (${en.size} keys, including array length checks).`);
