import { Prisma, type Customer as PrismaCustomer } from '@prisma/client'
import { prisma } from '@/lib/db'

export type CustomerStatus = 'active' | 'inactive'

export type Customer = {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
  status: CustomerStatus
  createdAt: string
}

export type CustomerCreateData = {
  name: string
  email: string
  phone?: string | null
  company?: string | null
  status: CustomerStatus
}

export type CustomerUpdateData = Partial<CustomerCreateData>

export type CustomerListParams = {
  q?: string
  page: number
  pageSize: number
}

export type CustomerListResult = {
  items: Customer[]
  total: number
  totalAll: number
  page: number
  pageSize: number
}

export type MonthlyBucket = { month: string; count: number }

export type DashboardStats = {
  total: number
  active: number
  inactive: number
  activePct: number
  monthly: MonthlyBucket[]
}

/** Thrown by `create`/`update` when the email collides with an existing customer. */
export class EmailTakenError extends Error {
  constructor() {
    super('email_taken')
    this.name = 'EmailTakenError'
  }
}

export interface CustomerRepository {
  list(params: CustomerListParams): Promise<CustomerListResult>
  findById(id: string): Promise<Customer | null>
  create(data: CustomerCreateData): Promise<Customer>
  /** Returns `null` if no customer with that id exists. */
  update(id: string, data: CustomerUpdateData): Promise<Customer | null>
  /** Returns `false` if no customer with that id exists. */
  delete(id: string): Promise<boolean>
  stats(now?: Date): Promise<DashboardStats>
  healthCheck(): Promise<boolean>
}

const MONTHLY_WINDOW_SIZE = 12
const UNIQUE_CONSTRAINT_VIOLATION = 'P2002'
const RECORD_NOT_FOUND = 'P2025'

function toWireStatus(status: 'ACTIVE' | 'INACTIVE'): CustomerStatus {
  return status === 'ACTIVE' ? 'active' : 'inactive'
}

function toDbStatus(status: CustomerStatus): 'ACTIVE' | 'INACTIVE' {
  return status === 'active' ? 'ACTIVE' : 'INACTIVE'
}

function toWire(customer: PrismaCustomer): Customer {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    company: customer.company,
    status: toWireStatus(customer.status),
    createdAt: customer.createdAt.toISOString(),
  }
}

function isPrismaKnownError(
  error: unknown,
  code: string,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Oldest-first list of the `count` trailing months, inclusive of `now`'s month. */
function trailingMonthKeys(now: Date, count: number): string[] {
  const months: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    months.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))))
  }
  return months
}

export class PrismaCustomerRepository implements CustomerRepository {
  async list({ q, page, pageSize }: CustomerListParams): Promise<CustomerListResult> {
    const where: Prisma.CustomerWhereInput | undefined = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { company: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined

    const [items, total, totalAll] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.customer.count({ where }),
      prisma.customer.count(),
    ])

    return { items: items.map(toWire), total, totalAll, page, pageSize }
  }

  async findById(id: string): Promise<Customer | null> {
    const customer = await prisma.customer.findUnique({ where: { id } })
    return customer ? toWire(customer) : null
  }

  async create(data: CustomerCreateData): Promise<Customer> {
    const existing = await prisma.customer.findUnique({ where: { email: data.email } })
    if (existing) {
      throw new EmailTakenError()
    }

    try {
      const customer = await prisma.customer.create({
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone ?? null,
          company: data.company ?? null,
          status: toDbStatus(data.status),
        },
      })
      return toWire(customer)
    } catch (error) {
      if (isPrismaKnownError(error, UNIQUE_CONSTRAINT_VIOLATION)) {
        throw new EmailTakenError()
      }
      throw error
    }
  }

  async update(id: string, data: CustomerUpdateData): Promise<Customer | null> {
    if (data.email !== undefined) {
      const existing = await prisma.customer.findUnique({ where: { email: data.email } })
      if (existing && existing.id !== id) {
        throw new EmailTakenError()
      }
    }

    try {
      const customer = await prisma.customer.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(data.company !== undefined ? { company: data.company } : {}),
          ...(data.status !== undefined ? { status: toDbStatus(data.status) } : {}),
        },
      })
      return toWire(customer)
    } catch (error) {
      if (isPrismaKnownError(error, RECORD_NOT_FOUND)) {
        return null
      }
      if (isPrismaKnownError(error, UNIQUE_CONSTRAINT_VIOLATION)) {
        throw new EmailTakenError()
      }
      throw error
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.customer.delete({ where: { id } })
      return true
    } catch (error) {
      if (isPrismaKnownError(error, RECORD_NOT_FOUND)) {
        return false
      }
      throw error
    }
  }

  async stats(now: Date = new Date()): Promise<DashboardStats> {
    const months = trailingMonthKeys(now, MONTHLY_WINDOW_SIZE)
    const windowStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHLY_WINDOW_SIZE - 1), 1),
    )

    const [total, active, inactive, rowsInWindow] = await Promise.all([
      prisma.customer.count(),
      prisma.customer.count({ where: { status: 'ACTIVE' } }),
      prisma.customer.count({ where: { status: 'INACTIVE' } }),
      prisma.customer.findMany({
        where: { createdAt: { gte: windowStart } },
        select: { createdAt: true },
      }),
    ])

    const counts = new Map(months.map((month) => [month, 0]))
    for (const row of rowsInWindow) {
      const key = monthKey(row.createdAt)
      if (counts.has(key)) {
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
    }

    return {
      total,
      active,
      inactive,
      activePct: total > 0 ? Math.round((active / total) * 100) : 0,
      monthly: months.map((month) => ({ month, count: counts.get(month) ?? 0 })),
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`
      return true
    } catch {
      return false
    }
  }
}

export const customerRepository: CustomerRepository = new PrismaCustomerRepository()
