import { pathToFileURL } from 'node:url'
import { prisma } from '../lib/db'
import { ensureAdmin } from '../lib/ensure-admin'
import { maskEmail } from '../lib/mask'

// Synthetic sample data lifted verbatim from the design prototype's own SEED
// array (testclaudedesign/project/Customers App.dc.html) — no real customers.
const SEED_CUSTOMERS = [
  {
    name: 'Jane Cooper',
    email: 'jane.cooper@northwind.com',
    phone: '+1 555 0142',
    company: 'Northwind',
    status: 'ACTIVE' as const,
  },
  {
    name: 'Omar Haddad',
    email: 'omar@alfanar.ae',
    phone: '+971 50 123 4567',
    company: 'Alfanar',
    status: 'ACTIVE' as const,
  },
  {
    name: 'Priya Nair',
    email: 'priya.nair@lumen.io',
    phone: '+44 20 7946 0958',
    company: 'Lumen',
    status: 'INACTIVE' as const,
  },
  {
    name: 'Lucas Martin',
    email: 'lucas@brightpath.fr',
    phone: '+33 1 84 88 00 00',
    company: 'Brightpath',
    status: 'ACTIVE' as const,
  },
]

async function seedAdminUser(argv: string[]) {
  // One-shot by design: `prisma.seed` in package.json points here, so `prisma db
  // seed` (and anything that invokes it, including `prisma migrate reset`) runs
  // this with no args on every call. A sticky env var would silently re-arm a
  // credential overwrite on every such invocation; only an explicit,
  // per-invocation argv flag can force it (mirrors scripts/ensure-admin.ts).
  const forceReset = argv.includes('--force-reset')

  const result = await ensureAdmin({
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
    forceReset,
  })

  switch (result.outcome) {
    case 'skipped':
      console.log(`Skipping admin user seed: ${result.reason}`)
      break
    case 'created':
      console.log(`Seeded admin user ${maskEmail(result.email)}`)
      break
    case 'unchanged':
      console.log(`Admin user ${maskEmail(result.email)} already exists; leaving credential unchanged`)
      break
    case 'reset':
      console.log(`--force-reset set; overwrote credential for admin user ${maskEmail(result.email)}`)
      break
  }
}

async function seedCustomers() {
  for (const customer of SEED_CUSTOMERS) {
    await prisma.customer.upsert({
      where: { email: customer.email },
      update: {},
      create: customer,
    })
  }
  console.log(`Seeded ${SEED_CUSTOMERS.length} sample customers`)
}

export async function run(argv: string[]): Promise<void> {
  await seedAdminUser(argv)
  await seedCustomers()
}

// Only run as a side effect when invoked directly (`tsx prisma/seed.ts`),
// never when `run` is imported for testing.
const isDirectlyExecuted =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectlyExecuted) {
  run(process.argv.slice(2))
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
