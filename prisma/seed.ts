import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../lib/password'

const prisma = new PrismaClient()

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
  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD

  if (!email || !password) {
    console.log(
      'Skipping admin user seed: SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must both be set ' +
        '(e.g. via Railway secrets). Never hardcode a seed password.',
    )
    return
  }

  const passwordHash = await hashPassword(password)
  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { passwordHash },
    create: { email: email.toLowerCase(), passwordHash, name: 'Admin' },
  })
  console.log(`Seeded admin user ${email}`)
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
