import { PrismaClient } from '@prisma/client'

/**
 * Direct Prisma access from the test process, same convention as
 * tests/integration/helpers.ts — the suite talks to the same Postgres
 * instance the app server under test is using (DATABASE_URL is set by
 * e2e/global-setup.ts before this module is ever imported).
 */
export const prisma = new PrismaClient()

export async function resetLoginAttempts(): Promise<void> {
  await prisma.loginAttempt.deleteMany()
}

export async function countLoginAttempts(email: string): Promise<number> {
  return prisma.loginAttempt.count({ where: { email } })
}
