import { NextRequest, NextResponse } from "next/server";
import { handlers } from "@/lib/auth";
import { clientIp } from "@/lib/auth";
import { isLoginRateLimited, loginRetryAfterSeconds } from "@/lib/rate-limit";

export const { GET } = handlers;

/**
 * Auth.js's Credentials flow has no way to surface a custom HTTP status or
 * header from a thrown error in `authorize()` — it always normalises to its
 * own redirect/JSON-error shape. The interface-contract (§4.1) requires a
 * literal `429` with a `Retry-After` header, so the throttle is enforced
 * here, in front of Auth.js, for the one route it actually matters on.
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const isCredentialsCallback = url.pathname.endsWith("/callback/credentials");

  if (!isCredentialsCallback) {
    return handlers.POST(request);
  }

  const bodyText = await request.text();
  const email = new URLSearchParams(bodyText).get("email")?.trim().toLowerCase() ?? "";
  const ip = clientIp(request);

  if (email && (await isLoginRateLimited(ip, email))) {
    const retryAfter = await loginRetryAfterSeconds(ip, email);
    return NextResponse.json(
      {
        error: "rate_limited",
        message: "Too many sign-in attempts. Try again in a few minutes.",
      },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  // Body already consumed above — forward an equivalent request so Auth.js
  // can read it again.
  const forwarded = new NextRequest(request.url, {
    method: "POST",
    headers: request.headers,
    body: bodyText,
  });
  return handlers.POST(forwarded);
}
