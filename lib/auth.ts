import NextAuth, { CredentialsSignin, type User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { prisma } from "./db";
import { hashPassword, verifyPassword } from "./password";
import {
  clearLoginAttempts,
  isLoginRateLimited,
  recordFailedLoginAttempt,
} from "./rate-limit";
import { loginSchema } from "./validation";
import { maskEmail } from "./mask";

/** Malformed/missing email — maps to the `errEmail` i18n key client-side. */
export class InvalidEmailSignin extends CredentialsSignin {
  code = "invalid_email";
}

/**
 * Wrong password, unknown email, or password below the floor — one generic
 * code for all of them so the client cannot distinguish "no such account"
 * from "wrong password" (no email-enumeration via the error message).
 */
export class InvalidCredentialsSignin extends CredentialsSignin {
  code = "invalid_credentials";
}

export class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

// A real Argon2id hash verified on every "unknown email" path so the
// response time for an unknown email is indistinguishable from a wrong
// password on a known one — otherwise the login endpoint is a timing oracle
// for account enumeration.
let dummyHash: Promise<string> | undefined;
function getDummyHash() {
  dummyHash ??= hashPassword("timing-defense-constant-never-a-real-password");
  return dummyHash;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() ?? "unknown";
}

function logLoginAttempt(outcome: string, ip: string, email: string): void {
  // Structured, PII-minimised: never the password, email always masked.
  console.log(
    JSON.stringify({ event: "login_attempt", outcome, ip, email: maskEmail(email) }),
  );
}

/**
 * The actual credentials check, factored out of the Credentials provider's
 * `authorize` so it can be exercised directly in integration tests without
 * going through Auth.js's CSRF/cookie dance over HTTP.
 */
export async function authorizeCredentials(
  credentials: Partial<Record<"email" | "password", unknown>>,
  ip: string,
): Promise<User> {
  const rawEmail =
    typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";

  // The route handler (app/api/auth/[...nextauth]/route.ts) already rejects
  // over-budget requests with a real 429 + Retry-After before this ever
  // runs. This is a defense-in-depth re-check, not the primary enforcement
  // point.
  if (rawEmail && (await isLoginRateLimited(ip, rawEmail))) {
    logLoginAttempt("rate_limited", ip, rawEmail);
    throw new RateLimitedSignin();
  }

  const parsed = loginSchema.safeParse(credentials);
  if (!parsed.success) {
    await recordFailedLoginAttempt(ip, rawEmail || "unknown");
    const emailInvalid = parsed.error.issues.some((issue) => issue.path[0] === "email");
    logLoginAttempt(emailInvalid ? "invalid_email" : "invalid_credentials", ip, rawEmail);
    throw emailInvalid ? new InvalidEmailSignin() : new InvalidCredentialsSignin();
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  const hashToVerify = user?.passwordHash ?? (await getDummyHash());
  const valid = await verifyPassword(hashToVerify, password);

  if (!user || !valid) {
    await recordFailedLoginAttempt(ip, email);
    logLoginAttempt("invalid_credentials", ip, email);
    throw new InvalidCredentialsSignin();
  }

  await clearLoginAttempts(ip, email);
  logLoginAttempt("success", ip, email);
  return { id: user.id, email: user.email, name: user.name };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: (credentials, request) => authorizeCredentials(credentials, clientIp(request)),
    }),
  ],
});
