import NextAuth from "next-auth";
import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { authConfig } from "./lib/auth.config";
import { routing, type Locale } from "./i18n/routing";

// Edge-safe auth check only (see lib/auth.config.ts) — the Credentials
// provider and its Prisma/Argon2 dependencies never load in this file.
const { auth } = NextAuth(authConfig);

const intlMiddleware = createMiddleware(routing);

// Default-deny: every /api/** path requires a session unless listed here.
// A new route handler is protected automatically — it has to be added to
// this allowlist to become public, rather than remembered as an exception
// in a "protected prefixes" list that a future route can silently miss.
const PUBLIC_API_PREFIXES = ["/api/auth", "/api/health"];

function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function extractLocale(pathname: string): Locale {
  const segment = pathname.split("/")[1];
  return (routing.locales as readonly string[]).includes(segment)
    ? (segment as Locale)
    : routing.defaultLocale;
}

function pathAfterLocale(pathname: string, locale: Locale): string {
  const rest = pathname.slice(locale.length + 1);
  return rest === "" ? "/" : rest;
}

function buildCsp(nonce: string): string {
  // Next.js's dev-server React Fast Refresh runtime applies hot-reloaded
  // modules via eval() (webpack's `webpackHotUpdate` path) — with no
  // 'unsafe-eval', `next dev` throws an uncaught EvalError out of
  // main-app.js on every navigation, which aborts hydration before any
  // page script (including the login form's submit handler) ever attaches.
  // Production builds never load this runtime, so 'unsafe-eval' never
  // reaches a real deployment — see lib/auth.config.ts's useSecureCookies
  // for the same NODE_ENV-gated pattern.
  const scriptSrc =
    process.env.NODE_ENV === "production"
      ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
      : `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`;
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

function applySecurityHeaders(response: NextResponse, csp: string): NextResponse {
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  if (pathname.startsWith("/api/")) {
    if (!isPublicApiPath(pathname) && !request.auth) {
      return applySecurityHeaders(
        NextResponse.json({ error: "unauthorized" }, { status: 401 }),
        csp,
      );
    }
    return applySecurityHeaders(NextResponse.next(), csp);
  }

  // Everything else below is a page route under /[locale]/**. The login
  // page itself must stay reachable while signed out.
  const locale = extractLocale(pathname);
  const pageSegment = pathAfterLocale(pathname, locale);

  if (pageSegment !== "/login" && !request.auth) {
    return applySecurityHeaders(
      NextResponse.redirect(new URL(`/${locale}/login`, request.url)),
      csp,
    );
  }

  const intlResponse = intlMiddleware(request);
  if (intlResponse.headers.has("location")) {
    // A locale-correction redirect; nothing renders on this response, so
    // there is no inline script for the nonce to apply to.
    return applySecurityHeaders(intlResponse, csp);
  }

  // Rebuild as a request-header-forwarding continuation so Next.js can
  // apply this nonce to its own framework-injected inline scripts during
  // the RSC render — next-intl's plain NextResponse.next() has no way to
  // carry that on its own.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  intlResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return applySecurityHeaders(response, csp);
});

export const config = {
  // Runs on every request except Next.js internals and static files, plus
  // every /api/** path explicitly (the first pattern alone would skip any
  // API path containing a dot, e.g. /api/customers/ab.cd).
  matcher: ["/((?!_next|_vercel|.*\\..*).*)", "/api/:path*"],
};
