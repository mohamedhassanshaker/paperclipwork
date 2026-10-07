import NextAuth from "next-auth";
import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { authConfig } from "./lib/auth.config";
import { routing, type Locale } from "./i18n/routing";

// Edge-safe auth check only (see lib/auth.config.ts) — the Credentials
// provider and its Prisma/Argon2 dependencies never load in this file.
const { auth } = NextAuth(authConfig);

const intlMiddleware = createMiddleware(routing);

const PROTECTED_API_PREFIXES = ["/api/customers", "/api/dashboard"];

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

export default auth((request) => {
  const { pathname } = request.nextUrl;

  if (PROTECTED_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    if (!request.auth) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Everything else below is a page route under /[locale]/**. The login
  // page itself must stay reachable while signed out.
  const locale = extractLocale(pathname);
  const pageSegment = pathAfterLocale(pathname, locale);

  if (pageSegment !== "/login" && !request.auth) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  return intlMiddleware(request);
});

export const config = {
  // Runs on every request except Next.js internals and static files; API
  // routes are included so /api/customers* and /api/dashboard/* are gated,
  // while /api/auth/* and /api/health stay implicitly public (not in
  // PROTECTED_API_PREFIXES above).
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
