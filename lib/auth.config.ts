import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe subset of the Auth.js config. The Edge middleware runtime cannot
 * load Prisma's engine or @node-rs/argon2 (both are Node-only native
 * bindings), so the Credentials provider itself lives only in lib/auth.ts,
 * which runs in the Node.js runtime (route handlers, server components).
 * middleware.ts imports this file, never lib/auth.ts.
 */
export const authConfig = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8, // 8h session — internal admin tool, not a consumer app
  },
  pages: {
    signIn: "/login",
  },
  trustHost: true, // required behind Railway's reverse proxy
  // Auth.js infers `Secure` from the request/AUTH_URL, which silently
  // downgrades the session cookie if AUTH_URL is ever misconfigured.
  // Assert it explicitly instead of relying on inference.
  useSecureCookies: process.env.NODE_ENV === "production",
  providers: [],
  callbacks: {
    authorized({ auth }) {
      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;
