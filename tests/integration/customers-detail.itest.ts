import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { DELETE, GET, PATCH } from '@/app/api/customers/[id]/route'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { AUTHENTICATED_SESSION, jsonRequest, resetDatabase } from './helpers'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
const mockedAuth = auth as unknown as Mock

beforeEach(async () => {
  await resetDatabase()
  mockedAuth.mockResolvedValue(AUTHENTICATED_SESSION as never)
})

function seedCustomer() {
  return prisma.customer.create({
    data: { name: 'Jane Cooper', email: 'jane@acme.test', status: 'ACTIVE' },
  })
}

describe('GET /api/customers/:id', () => {
  it('returns 401 when unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null)
    const res = await GET(jsonRequest('http://localhost/api/customers/x'), {
      params: Promise.resolve({ id: 'x' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 404 not_found for an unknown id', async () => {
    const res = await GET(jsonRequest('http://localhost/api/customers/missing'), {
      params: Promise.resolve({ id: 'missing' }),
    })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('not_found')
  })

  it('returns the customer', async () => {
    const customer = await seedCustomer()
    const res = await GET(jsonRequest(`http://localhost/api/customers/${customer.id}`), {
      params: Promise.resolve({ id: customer.id }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(customer.id)
    expect(body.email).toBe('jane@acme.test')
  })
})

describe('PATCH /api/customers/:id', () => {
  it('returns 401 when unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null)
    const res = await PATCH(
      jsonRequest('http://localhost/api/customers/x', { method: 'PATCH', body: '{}' }),
      { params: Promise.resolve({ id: 'x' }) },
    )
    expect(res.status).toBe(401)
  })

  it('updates allowed fields and returns 200', async () => {
    const customer = await seedCustomer()
    const res = await PATCH(
      jsonRequest(`http://localhost/api/customers/${customer.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'inactive' }),
      }),
      { params: Promise.resolve({ id: customer.id }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('inactive')
    expect(body.name).toBe('Jane Cooper')
  })

  it('returns 404 not_found for an unknown id', async () => {
    const res = await PATCH(
      jsonRequest('http://localhost/api/customers/missing', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'inactive' }),
      }),
      { params: Promise.resolve({ id: 'missing' }) },
    )
    expect(res.status).toBe(404)
  })

  it('returns 422 validation_failed for an invalid field', async () => {
    const customer = await seedCustomer()
    const res = await PATCH(
      jsonRequest(`http://localhost/api/customers/${customer.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ phone: 'not a phone!!' }),
      }),
      { params: Promise.resolve({ id: customer.id }) },
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.fields).toEqual({ phone: 'invalid_phone' })
  })

  it('returns 409 email_taken when the new email collides with another customer', async () => {
    const customer = await seedCustomer()
    await prisma.customer.create({
      data: { name: 'Other', email: 'other@acme.test', status: 'ACTIVE' },
    })

    const res = await PATCH(
      jsonRequest(`http://localhost/api/customers/${customer.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ email: 'other@acme.test' }),
      }),
      { params: Promise.resolve({ id: customer.id }) },
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('email_taken')
  })
})

describe('DELETE /api/customers/:id', () => {
  it('returns 401 when unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null)
    const res = await DELETE(
      jsonRequest('http://localhost/api/customers/x', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'x' }) },
    )
    expect(res.status).toBe(401)
  })

  it('hard deletes and returns 204, with no row left behind', async () => {
    const customer = await seedCustomer()
    const res = await DELETE(
      jsonRequest(`http://localhost/api/customers/${customer.id}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: customer.id }) },
    )
    expect(res.status).toBe(204)

    const stillThere = await prisma.customer.findUnique({ where: { id: customer.id } })
    expect(stillThere).toBeNull()
  })

  it('returns 404 not_found for an unknown id', async () => {
    const res = await DELETE(
      jsonRequest('http://localhost/api/customers/missing', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'missing' }) },
    )
    expect(res.status).toBe(404)
  })
})
