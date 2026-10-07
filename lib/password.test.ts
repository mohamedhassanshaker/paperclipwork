import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("hashPassword / verifyPassword", () => {
  it("produces an Argon2id PHC-format hash, never the plaintext", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain("correct horse battery staple");
  });

  it("verifies the correct password", async () => {
    const hash = await hashPassword("a-strong-password-123");
    await expect(verifyPassword(hash, "a-strong-password-123")).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("a-strong-password-123");
    await expect(verifyPassword(hash, "wrong-password")).resolves.toBe(false);
  });

  it("salts each hash differently, even for the same password", async () => {
    const [a, b] = await Promise.all([hashPassword("same-password"), hashPassword("same-password")]);
    expect(a).not.toBe(b);
  });
});
