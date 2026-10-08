import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { EnsureAdminError, ensureAdmin } from "@/lib/ensure-admin";
import { verifyPassword } from "@/lib/password";
import { resetDatabase } from "./helpers";

const EMAIL = "Admin@Company.com";
const NORMALIZED_EMAIL = "admin@company.com";
const PASSWORD = "a-strong-password-123";

beforeEach(async () => {
  await resetDatabase();
});

describe("ensureAdmin", () => {
  it("skips without touching the database when either env var is missing", async () => {
    const result = await ensureAdmin({ email: undefined, password: PASSWORD });
    expect(result.outcome).toBe("skipped");
    expect(await prisma.user.count()).toBe(0);

    const result2 = await ensureAdmin({ email: EMAIL, password: undefined });
    expect(result2.outcome).toBe("skipped");
    expect(await prisma.user.count()).toBe(0);
  });

  it("fails loudly when the password is below the 8-character floor", async () => {
    await expect(ensureAdmin({ email: EMAIL, password: "short1" })).rejects.toBeInstanceOf(
      EnsureAdminError,
    );
    expect(await prisma.user.count()).toBe(0);
  });

  it("creates the admin user, lower-cased, when none exists", async () => {
    const result = await ensureAdmin({ email: EMAIL, password: PASSWORD });
    expect(result).toEqual({ outcome: "created", email: NORMALIZED_EMAIL });

    const user = await prisma.user.findUnique({ where: { email: NORMALIZED_EMAIL } });
    expect(user).not.toBeNull();
    expect(await verifyPassword(user!.passwordHash, PASSWORD)).toBe(true);
  });

  it("is idempotent: running twice in a row is a no-op the second time", async () => {
    await ensureAdmin({ email: EMAIL, password: PASSWORD });
    const before = await prisma.user.findUnique({ where: { email: NORMALIZED_EMAIL } });

    const second = await ensureAdmin({ email: EMAIL, password: PASSWORD });
    expect(second).toEqual({ outcome: "unchanged", email: NORMALIZED_EMAIL });

    const after = await prisma.user.findUnique({ where: { email: NORMALIZED_EMAIL } });
    expect(after!.passwordHash).toBe(before!.passwordHash);
  });

  it("never overwrites an existing passwordHash by default, even with a different password", async () => {
    await ensureAdmin({ email: EMAIL, password: PASSWORD });
    const before = await prisma.user.findUnique({ where: { email: NORMALIZED_EMAIL } });

    const result = await ensureAdmin({ email: EMAIL, password: "a-completely-different-pw" });
    expect(result).toEqual({ outcome: "unchanged", email: NORMALIZED_EMAIL });

    const after = await prisma.user.findUnique({ where: { email: NORMALIZED_EMAIL } });
    expect(after!.passwordHash).toBe(before!.passwordHash);
    expect(await verifyPassword(after!.passwordHash, PASSWORD)).toBe(true);
  });

  it("overwrites the existing credential when forceReset is set", async () => {
    await ensureAdmin({ email: EMAIL, password: PASSWORD });
    const newPassword = "a-completely-different-pw";

    const result = await ensureAdmin({ email: EMAIL, password: newPassword, forceReset: true });
    expect(result).toEqual({ outcome: "reset", email: NORMALIZED_EMAIL });

    const after = await prisma.user.findUnique({ where: { email: NORMALIZED_EMAIL } });
    expect(await verifyPassword(after!.passwordHash, newPassword)).toBe(true);
    expect(await verifyPassword(after!.passwordHash, PASSWORD)).toBe(false);
  });

  it("still enforces the password floor on a forced reset", async () => {
    await ensureAdmin({ email: EMAIL, password: PASSWORD });

    await expect(
      ensureAdmin({ email: EMAIL, password: "short1", forceReset: true }),
    ).rejects.toBeInstanceOf(EnsureAdminError);

    const after = await prisma.user.findUnique({ where: { email: NORMALIZED_EMAIL } });
    expect(await verifyPassword(after!.passwordHash, PASSWORD)).toBe(true);
  });
});
