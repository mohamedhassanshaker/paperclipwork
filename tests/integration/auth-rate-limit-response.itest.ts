import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/[...nextauth]/route";
import { recordFailedLoginAttempt } from "@/lib/rate-limit";
import { resetDatabase } from "./helpers";

const EMAIL = "admin@company.com";
const IP = "203.0.113.5";

function credentialsCallbackRequest(email: string, ip: string) {
  const body = new URLSearchParams({ email, password: "whatever", csrfToken: "test" });
  return new NextRequest("http://localhost/api/auth/callback/credentials", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-for": ip,
    },
    body: body.toString(),
  });
}

describe("POST /api/auth/callback/credentials — throttle short-circuit", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("responds 429 with a Retry-After header once the per-email budget is spent, without reaching Auth.js", async () => {
    for (let i = 0; i < 10; i++) {
      await recordFailedLoginAttempt(IP, EMAIL);
    }

    const res = await POST(credentialsCallbackRequest(EMAIL, IP));

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toMatch(/^\d+$/);
    await expect(res.json()).resolves.toEqual({
      error: "rate_limited",
      message: "Too many sign-in attempts. Try again in a few minutes.",
    });
  });

  it("does not leak whether the throttled email exists: same response shape for an unknown email", async () => {
    const unknownEmail = "nobody@company.com";
    for (let i = 0; i < 10; i++) {
      await recordFailedLoginAttempt(IP, unknownEmail);
    }

    const res = await POST(credentialsCallbackRequest(unknownEmail, IP));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toMatch(/^\d+$/);
  });
});
