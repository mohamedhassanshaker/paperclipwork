import { describe, expect, it } from "vitest";
import en from "./en.json";
import ar from "./ar.json";

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("message catalogues", () => {
  it("expose the exact same keys in en and ar", () => {
    expect(flattenKeys(en).sort()).toEqual(flattenKeys(ar).sort());
  });
});
