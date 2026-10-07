import { prisma } from "./db";

/**
 * Login throttle (interface-contract §4.1). Backed by Postgres, not
 * in-process memory — Railway may run more than one instance and restarts
 * are routine, so an in-memory counter would silently provide no
 * protection at all. Two independent counters, both enforced: per source IP
 * and per submitted email (normalised lowercase). Only failed attempts are
 * recorded; a successful login clears both counters.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function windowStart(): Date {
  return new Date(Date.now() - WINDOW_MS);
}

export async function isLoginRateLimited(ip: string, email: string): Promise<boolean> {
  const since = windowStart();
  const [ipCount, emailCount] = await Promise.all([
    prisma.loginAttempt.count({ where: { ip, createdAt: { gt: since } } }),
    prisma.loginAttempt.count({ where: { email, createdAt: { gt: since } } }),
  ]);
  return ipCount >= MAX_ATTEMPTS || emailCount >= MAX_ATTEMPTS;
}

/** Seconds until the oldest attempt in either window ages out. 0 if neither counter is tripped. */
export async function loginRetryAfterSeconds(ip: string, email: string): Promise<number> {
  const since = windowStart();
  const [oldestIp, oldestEmail] = await Promise.all([
    prisma.loginAttempt.findFirst({
      where: { ip, createdAt: { gt: since } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.loginAttempt.findFirst({
      where: { email, createdAt: { gt: since } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const candidates = [oldestIp, oldestEmail].filter((row): row is NonNullable<typeof row> => row !== null);
  if (candidates.length === 0) return 0;
  const oldest = candidates.reduce((a, b) => (a.createdAt < b.createdAt ? a : b));
  const retryAt = oldest.createdAt.getTime() + WINDOW_MS;
  return Math.max(1, Math.ceil((retryAt - Date.now()) / 1000));
}

export async function recordFailedLoginAttempt(ip: string, email: string): Promise<void> {
  // Opportunistic purge: a failed attempt is the only write this table ever
  // sees outside of the success-path delete, so it's also the cheapest place
  // to bound retention — rows are personal data (IP + email) with no
  // purpose once they've aged out of the throttle window.
  await prisma.loginAttempt.deleteMany({ where: { createdAt: { lte: windowStart() } } });
  await prisma.loginAttempt.create({ data: { ip, email } });
}

/** Clears both counters after a successful authentication. */
export async function clearLoginAttempts(ip: string, email: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { OR: [{ ip }, { email }] } });
}
