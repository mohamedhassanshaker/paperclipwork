import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { GET, POST } from '@/app/api/customers/route'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { AUTHENTICATED_SESSION, jsonRequest, resetDatabase } from './helpers'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
const mockedAuth = auth as unknown as Mock

beforeEach(async () => {
  await resetDatabase()
  mockedAuth.mockResolvedValue(AUTHENTICATED_SESSION as never)
})

describe('GET /api/customers', () => {
  it('returns 401 when unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null)
    const res = await GET(jsonRequest('http://localhost/api/customers'))
    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({
      error: 'unauthorized',
      message: 'Authentication required.',
    })
  })

  it('lists customers with total and totalAll', async () => {
    await prisma.customer.createMany({
      data: [
        { name: 'Jane Cooper', email: 'jane@acme.test', status: 'ACTIVE' },
        { name: 'Omar Haddad', email: 'omar@acme.test', status: 'INACTIVE' },
      ],
    })

    const res = await GET(jsonRequest('http://localhost/api/customers'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(2)
    expect(body.totalAll).toBe(2)
    expect(body.page).toBe(1)
    expect(body.pageSize).toBe(25)
    expect(body.items).toHaveLength(2)
  })

  it('filters by q across name/email/company, case-insensitively, without affecting totalAll', async () => {
    await prisma.customer.createMany({
      data: [
        {
          name: 'Jane Cooper',
          email: 'jane@northwind.test',
          company: 'Northwind',
          status: 'ACTIVE',
        },
        { name: 'Omar Haddad', email: 'omar@alfanar.test', company: 'Alfanar', status: 'ACTIVE' },
      ],
    })

    const res = await GET(jsonRequest('http://localhost/api/customers?q=NORTH'))
    const body = await res.json()
    expect(body.total).toBe(1)
    expect(body.totalAll).toBe(2)
    expect(body.items[0].name).toBe('Jane Cooper')
  })

  it('paginates', async () => {
    await prisma.customer.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({
        name: `Customer ${i}`,
        email: `c${i}@acme.test`,
        status: 'ACTIVE' as const,
      })),
    })

    const res = await GET(jsonRequest('http://localhost/api/customers?page=2&pageSize=2'))
    const body = await res.json()
    expect(body.items).toHaveLength(2)
    expect(body.page).toBe(2)
    expect(body.pageSize).toBe(2)
    expect(body.total).toBe(5)
  })

  it('returns 422 validation_failed for a pageSize over the max', async () => {
    const res = await GET(jsonRequest('http://localhost/api/customers?pageSize=101'))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe('validation_failed')
  })
})

describe('POST /api/customers', () => {
  it('returns 401 when unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null)
    const res = await POST(
      jsonRequest('http://localhost/api/customers', { method: 'POST', body: '{}' }),
    )
    expect(res.status).toBe(401)
  })

  it('creates a customer and returns 201 with the lowercased email', async () => {
    const res = await POST(
      jsonRequest('http://localhost/api/customers', {
        method: 'POST',
        body: JSON.stringify({ name: 'Priya Nair', email: 'Priya@Lumen.test', status: 'active' }),
      }),
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.email).toBe('priya@lumen.test')
    expect(body.status).toBe('active')
    expect(typeof body.id).toBe('string')
    expect(body.phone).toBeNull()
    expect(body.company).toBeNull()
  })

  it('returns 422 with a per-field fields map for invalid input', async () => {
    const res = await POST(
      jsonRequest('http://localhost/api/customers', {
        method: 'POST',
        body: JSON.stringify({ name: '', email: 'not-an-email', status: 'bogus' }),
      }),
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe('validation_failed')
    expect(body.fields).toEqual({
      name: 'required',
      email: 'invalid_email',
      status: 'invalid_status',
    })
  })

  it('returns 409 email_taken on a duplicate email', async () => {
    await prisma.customer.create({
      data: { name: 'Existing', email: 'dup@acme.test', status: 'ACTIVE' },
    })

    const res = await POST(
      jsonRequest('http://localhost/api/customers', {
        method: 'POST',
        body: JSON.stringify({ name: 'New', email: 'dup@acme.test', status: 'active' }),
      }),
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('email_taken')
  })
})
