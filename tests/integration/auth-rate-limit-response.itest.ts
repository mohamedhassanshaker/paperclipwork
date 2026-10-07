import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/[...nextauth]/route";
import { clientIp } from "@/lib/auth";
import { recordFailedLoginAttempt, UNRESOLVED_CLIENT_IP } from "@/lib/rate-limit";
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

/**
 * Regression coverage for TAH-31: clientIp() used to take X-Forwarded-For's
 * *left-most* entry, which is whatever the caller sends — fully forgeable.
 * Requests here carry two hops: a caller-controlled left entry and a fixed
 * right-most entry standing in for the one real proxy hop (Railway) that
 * actually appends to the header. Only the right-most entry may be trusted,
 * so it's what the 10 prior failures below are seeded under — exactly what
 * `recordFailedLoginAttempt` would have stored had those failures gone
 * through this same (correctly derived) IP on the way in.
 *
 * The one triggering request per test goes through the real route handler
 * (not a seed call) so the assertion exercises clientIp() itself: before
 * the fix it would have derived the forged left hop instead, missed the
 * seeded bucket entirely, and never returned 429.
 */
const TRUSTED_PROXY_HOP = "198.51.100.9"; // stands in for Railway's edge

function spoofedCredentialsCallbackRequest(email: string, forgedLeftHop: string) {
  const body = new URLSearchParams({ email, password: "whatever", csrfToken: "test" });
  return new NextRequest("http://localhost/api/auth/callback/credentials", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-for": `${forgedLeftHop}, ${TRUSTED_PROXY_HOP}`,
    },
    body: body.toString(),
  });
}

describe("POST /api/auth/callback/credentials — per-IP throttle resists X-Forwarded-For spoofing", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("still trips the per-IP counter despite a rotating forged left-most XFF hop", async () => {
    for (let i = 0; i < 10; i++) {
      await recordFailedLoginAttempt(TRUSTED_PROXY_HOP, `prior-rotating-${i}@company.com`);
    }

    const res = await POST(
      spoofedCredentialsCallbackRequest("new-victim-rotating@company.com", "7.7.7.99"),
    );

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toMatch(/^\d+$/);
  });

  it("behaves identically with a fixed forged left-most XFF hop — forging the header confers no advantage", async () => {
    for (let i = 0; i < 10; i++) {
      await recordFailedLoginAttempt(TRUSTED_PROXY_HOP, `prior-fixed-${i}@company.com`);
    }

    const res = await POST(
      spoofedCredentialsCallbackRequest("new-victim-fixed@company.com", "8.8.8.8"),
    );

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toMatch(/^\d+$/);
  });

});

describe("clientIp() — trusted-hop derivation", () => {
  afterEach(() => {
    delete process.env.TRUSTED_PROXY_DEPTH;
  });

  function requestWithForwardedFor(forwarded: string | undefined) {
    const headers = new Headers();
    if (forwarded !== undefined) headers.set("x-forwarded-for", forwarded);
    return new NextRequest("http://localhost/api/auth/callback/credentials", {
      method: "POST",
      headers,
    });
  }

  it("ignores a forged left-most hop, rotating or fixed, and always trusts the right-most one", () => {
    expect(clientIp(requestWithForwardedFor(`7.7.7.1, ${TRUSTED_PROXY_HOP}`))).toBe(
      TRUSTED_PROXY_HOP,
    );
    expect(clientIp(requestWithForwardedFor(`7.7.7.2, ${TRUSTED_PROXY_HOP}`))).toBe(
      TRUSTED_PROXY_HOP,
    );
    expect(clientIp(requestWithForwardedFor(`8.8.8.8, ${TRUSTED_PROXY_HOP}`))).toBe(
      TRUSTED_PROXY_HOP,
    );
  });

  it("does not bucket distinct real callers together: a different right-most hop derives a different IP", () => {
    const first = clientIp(requestWithForwardedFor("7.7.7.99, 198.51.100.9"));
    const second = clientIp(requestWithForwardedFor("7.7.7.99, 198.51.100.200"));

    expect(first).toBe("198.51.100.9");
    expect(second).toBe("198.51.100.200");
    expect(first).not.toBe(second);
  });

  it("fails closed to a non-shared sentinel when X-Forwarded-For is missing entirely", () => {
    expect(clientIp(requestWithForwardedFor(undefined))).toBe(UNRESOLVED_CLIENT_IP);
  });

  it("fails closed when the header has fewer hops than the configured trusted-proxy depth", () => {
    process.env.TRUSTED_PROXY_DEPTH = "2";
    // Only one hop present: a misconfigured depth (or a request that skipped
    // a trusted hop) must not silently fall back to trusting it.
    expect(clientIp(requestWithForwardedFor("7.7.7.1"))).toBe(UNRESOLVED_CLIENT_IP);
  });

  it("honours a configured trusted-proxy depth greater than one", () => {
    process.env.TRUSTED_PROXY_DEPTH = "2";
    expect(clientIp(requestWithForwardedFor("7.7.7.1, 10.0.0.5, 198.51.100.9"))).toBe(
      "10.0.0.5",
    );
  });
});
