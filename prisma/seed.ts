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

async function seedAdminUser() {
  const result = await ensureAdmin({
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
    forceReset: process.env.ADMIN_FORCE_RESET === '1',
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
      console.log(`ADMIN_FORCE_RESET set; overwrote credential for admin user ${maskEmail(result.email)}`)
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

async function main() {
  await seedAdminUser()
  await seedCustomers()
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
