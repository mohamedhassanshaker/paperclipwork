import { describe, expect, it } from "vitest";
import { maskEmail } from "./mask";

describe("maskEmail", () => {
  it("keeps the first character and the full domain", () => {
    expect(maskEmail("admin@company.com")).toBe("a***@company.com");
  });

  it("falls back to a fixed placeholder for a string with no @", () => {
    expect(maskEmail("not-an-email")).toBe("***");
  });
});
