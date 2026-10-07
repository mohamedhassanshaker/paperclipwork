/**
 * Lifted verbatim from prisma/seed.ts's own SEED_CUSTOMERS array so the
 * suite's expectations never drift from what actually gets seeded. No real
 * customer data — synthetic, from the design prototype.
 */
export const SEEDED_CUSTOMERS = [
  { name: 'Jane Cooper', email: 'jane.cooper@northwind.com', phone: '+1 555 0142', company: 'Northwind', status: 'active' },
  { name: 'Omar Haddad', email: 'omar@alfanar.ae', phone: '+971 50 123 4567', company: 'Alfanar', status: 'active' },
  { name: 'Priya Nair', email: 'priya.nair@lumen.io', phone: '+44 20 7946 0958', company: 'Lumen', status: 'inactive' },
  { name: 'Lucas Martin', email: 'lucas@brightpath.fr', phone: '+33 1 84 88 00 00', company: 'Brightpath', status: 'active' },
] as const

export const E2E_ADMIN_EMAIL = 'e2e-admin@example.com'

export const LOCALES = ['en', 'ar'] as const
export type E2ELocale = (typeof LOCALES)[number]
