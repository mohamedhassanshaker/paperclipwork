import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { GET } from '@/app/api/dashboard/stats/route'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { AUTHENTICATED_SESSION, resetDatabase } from './helpers'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
const mockedAuth = auth as unknown as Mock

beforeEach(async () => {
  await resetDatabase()
  mockedAuth.mockResolvedValue(AUTHENTICATED_SESSION as never)
})

describe('GET /api/dashboard/stats', () => {
  it('returns 401 when unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns zero-filled stats with no customers, and no revenue/region fields', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(0)
    expect(body.active).toBe(0)
    expect(body.inactive).toBe(0)
    expect(body.activePct).toBe(0)
    expect(body.monthly).toHaveLength(12)
    expect(body.monthly.every((m: { count: number }) => m.count === 0)).toBe(true)
    expect(body.revenue).toBeUndefined()
    expect(body.region).toBeUndefined()
  })

  it('computes totals, activePct, and a real oldest-first createdAt rollup', async () => {
    const now = new Date()
    const twoMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 15))

    await prisma.customer.createMany({
      data: [
        { name: 'A', email: 'a@acme.test', status: 'ACTIVE', createdAt: now },
        { name: 'B', email: 'b@acme.test', status: 'ACTIVE', createdAt: now },
        { name: 'C', email: 'c@acme.test', status: 'INACTIVE', createdAt: twoMonthsAgo },
      ],
    })

    const res = await GET()
    const body = await res.json()
    expect(body.total).toBe(3)
    expect(body.active).toBe(2)
    expect(body.inactive).toBe(1)
    expect(body.activePct).toBe(67) // round(2/3 * 100)
    expect(body.monthly).toHaveLength(12)

    const currentKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
    expect(body.monthly[11].month).toBe(currentKey)
    expect(body.monthly[11].count).toBe(2)
    expect(body.monthly[9].count).toBe(1)
    expect(body.monthly[0].month < body.monthly[11].month).toBe(true)
  })
})
