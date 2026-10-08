import { pathToFileURL } from "node:url";
import { prisma } from "../lib/db";
import { EnsureAdminError, ensureAdmin } from "../lib/ensure-admin";
import { maskEmail } from "../lib/mask";

/**
 * Pure plumbing between the process (env/argv/exit code) and `ensureAdmin`,
 * factored out so it can be exercised in a unit test without a real process
 * exit or a real database.
 */
export async function run(
  env: Record<string, string | undefined>,
  argv: string[],
): Promise<number> {
  const forceReset = argv.includes("--force-reset") || env.ADMIN_FORCE_RESET === "1";

  try {
    const result = await ensureAdmin({
      email: env.SEED_ADMIN_EMAIL,
      password: env.SEED_ADMIN_PASSWORD,
      forceReset,
    });

    switch (result.outcome) {
      case "skipped":
        console.log(`db:ensure-admin: skipped — ${result.reason}`);
        return 0;
      case "created":
        console.log(`db:ensure-admin: created admin user ${maskEmail(result.email)}`);
        return 0;
      case "unchanged":
        console.log(
          `db:ensure-admin: admin user ${maskEmail(result.email)} already exists — ` +
            "leaving the existing credential unchanged (pass --force-reset to overwrite)",
        );
        return 0;
      case "reset":
        console.log(
          `db:ensure-admin: --force-reset set — overwrote the credential for admin user ${maskEmail(result.email)}`,
        );
        return 0;
    }
  } catch (error) {
    if (error instanceof EnsureAdminError) {
      console.error(`db:ensure-admin: ${error.message}`);
      return 1;
    }
    console.error("db:ensure-admin: failed:", error instanceof Error ? error.message : error);
    return 1;
  }
}

async function main() {
  process.exitCode = await run(process.env, process.argv.slice(2));
}

// Only run as a side effect when invoked directly (`tsx scripts/ensure-admin.ts`),
// never when `run` is imported for testing.
const isDirectlyExecuted =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectlyExecuted) {
  main().finally(() => prisma.$disconnect());
}
