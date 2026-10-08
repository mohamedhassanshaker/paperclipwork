import { prisma } from "./db";
import { hashPassword } from "./password";
import { loginSchema } from "./validation";

/** Thrown for genuine operator error — a deploy must fail loudly on this, not silently continue. */
export class EnsureAdminError extends Error {}

export interface EnsureAdminOptions {
  email: string | undefined;
  password: string | undefined;
  /** Re-hash and overwrite an existing user's credential. Default: never overwrite. */
  forceReset?: boolean;
}

export type EnsureAdminResult =
  | { outcome: "skipped"; reason: string }
  | { outcome: "created"; email: string }
  | { outcome: "unchanged"; email: string }
  | { outcome: "reset"; email: string };

/**
 * Create-if-missing, admin-only user provisioning — safe to run on every
 * deploy. Never overwrites an existing `passwordHash` unless `forceReset` is
 * explicitly set, so a routine deploy can never silently revert the one
 * operational credential this app has no self-service recovery for
 * (ADR-001 §8).
 */
export async function ensureAdmin(options: EnsureAdminOptions): Promise<EnsureAdminResult> {
  const { email, password, forceReset = false } = options;

  if (!email || !password) {
    return {
      outcome: "skipped",
      reason:
        "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must both be set (e.g. via Railway secrets). " +
        "Never hardcode a seed password.",
    };
  }

  const passwordCheck = loginSchema.shape.password.safeParse(password);
  if (!passwordCheck.success) {
    throw new EnsureAdminError(
      "SEED_ADMIN_PASSWORD does not meet the minimum password policy (8+ characters).",
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existing && !forceReset) {
    return { outcome: "unchanged", email: normalizedEmail };
  }

  const passwordHash = await hashPassword(password);

  if (existing) {
    await prisma.user.update({ where: { email: normalizedEmail }, data: { passwordHash } });
    return { outcome: "reset", email: normalizedEmail };
  }

  await prisma.user.create({
    data: { email: normalizedEmail, passwordHash, name: "Admin" },
  });
  return { outcome: "created", email: normalizedEmail };
}
