import { beforeEach, describe, expect, it } from "vitest";
import {
  authorizeCredentials,
  InvalidCredentialsSignin,
  InvalidEmailSignin,
  RateLimitedSignin,
} from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/db";
import { isLoginRateLimited, loginRetryAfterSeconds } from "@/lib/rate-limit";
import { resetDatabase } from "./helpers";

const IP = "203.0.113.1";
const EMAIL = "admin@company.com";
const PASSWORD = "a-strong-password-123";

beforeEach(async () => {
  await resetDatabase();
  await prisma.user.create({
    data: { email: EMAIL, passwordHash: await hashPassword(PASSWORD), name: "Admin" },
  });
});

describe("authorizeCredentials", () => {
  it("returns the user on a valid login and clears any prior throttle state", async () => {
    // Seed one prior failure so we can prove success clears it.
    await authorizeCredentials({ email: EMAIL, password: "wrong" }, IP).catch(() => {});

    const user = await authorizeCredentials({ email: EMAIL, password: PASSWORD }, IP);
    expect(user).toMatchObject({ email: EMAIL, name: "Admin" });
    expect(typeof user.id).toBe("string");

    expect(await isLoginRateLimited(IP, EMAIL)).toBe(false);
  });

  it("rejects a wrong password with the generic invalid_credentials code", async () => {
    await expect(
      authorizeCredentials({ email: EMAIL, password: "totally-wrong" }, IP),
    ).rejects.toBeInstanceOf(InvalidCredentialsSignin);
  });

  it("rejects an unknown email with the same generic code as a wrong password (no enumeration)", async () => {
    let unknownError: unknown;
    let wrongPasswordError: unknown;
    try {
      await authorizeCredentials({ email: "nobody@company.com", password: PASSWORD }, IP);
    } catch (error) {
      unknownError = error;
    }
    try {
      await authorizeCredentials({ email: EMAIL, password: "nope" }, IP);
    } catch (error) {
      wrongPasswordError = error;
    }
    expect(unknownError).toBeInstanceOf(InvalidCredentialsSignin);
    expect(wrongPasswordError).toBeInstanceOf(InvalidCredentialsSignin);
    expect((unknownError as InvalidCredentialsSignin).code).toBe(
      (wrongPasswordError as InvalidCredentialsSignin).code,
    );
  });

  it("rejects a malformed email with its own distinguishable code", async () => {
    await expect(
      authorizeCredentials({ email: "not-an-email", password: PASSWORD }, IP),
    ).rejects.toBeInstanceOf(InvalidEmailSignin);
  });

  it("rejects a password below the 8-character floor", async () => {
    await expect(
      authorizeCredentials({ email: EMAIL, password: "short1" }, IP),
    ).rejects.toBeInstanceOf(InvalidCredentialsSignin);
  });

  it("trips the per-email rate limit after 10 failed attempts and reports a positive Retry-After", async () => {
    for (let i = 0; i < 10; i++) {
      await authorizeCredentials({ email: EMAIL, password: "wrong" }, IP).catch(() => {});
    }

    await expect(
      authorizeCredentials({ email: EMAIL, password: "wrong" }, IP),
    ).rejects.toBeInstanceOf(RateLimitedSignin);

    const retryAfter = await loginRetryAfterSeconds(IP, EMAIL);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(15 * 60);
  });

  it("trips the per-IP rate limit across different emails from the same IP", async () => {
    for (let i = 0; i < 10; i++) {
      await authorizeCredentials({ email: `nobody-${i}@company.com`, password: "wrong" }, IP).catch(
        () => {},
      );
    }

    await expect(
      authorizeCredentials({ email: "yet-another@company.com", password: "wrong" }, IP),
    ).rejects.toBeInstanceOf(RateLimitedSignin);
  });

  it("keeps per-email and per-IP counters independent across different IPs", async () => {
    for (let i = 0; i < 10; i++) {
      await authorizeCredentials({ email: EMAIL, password: "wrong" }, "198.51.100.9").catch(
        () => {},
      );
    }

    // Same email, different IP: the email counter is shared and should now be tripped too.
    await expect(
      authorizeCredentials({ email: EMAIL, password: "wrong" }, "198.51.100.200"),
    ).rejects.toBeInstanceOf(RateLimitedSignin);
  });
});
