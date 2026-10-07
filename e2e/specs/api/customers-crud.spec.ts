import { expect, test, type APIRequestContext } from '@playwright/test'
import { apiLogin } from '../../support/auth'

test.describe('customers API', () => {
  let authed: APIRequestContext

  test.beforeAll(async ({ playwright, baseURL }) => {
    authed = await playwright.request.newContext({ baseURL })
    const res = await apiLogin(authed, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!)
    if (!res.ok() && res.status() !== 302 && res.status() !== 303) {
      throw new Error(`Fixture login failed with ${res.status()}: ${await res.text()}`)
    }
  })

  test.afterAll(async () => {
    await authed.dispose()
  })

  test('401 — unauthenticated GET is rejected', async ({ request }) => {
    const res = await request.get('/api/customers')
    expect(res.status()).toBe(401)
  })

  test('422 — creating a customer with an invalid body is rejected with field-level codes', async () => {
    const res = await authed.post('/api/customers', {
      data: { name: '', email: 'not-an-email', status: 'bogus' },
    })
    expect(res.status()).toBe(422)
    const body = await res.json()
    expect(body.error).toBe('validation_failed')
    expect(body.fields).toMatchObject({
      name: 'required',
      email: 'invalid_email',
      status: 'invalid_status',
    })
  })

  test('201 then 409 — duplicate email is rejected on create', async () => {
    const email = `dupe-${Date.now()}@example.com`
    const first = await authed.post('/api/customers', {
      data: { name: 'Dupe Test', email, status: 'active' },
    })
    expect(first.status()).toBe(201)

    const second = await authed.post('/api/customers', {
      data: { name: 'Dupe Test Two', email, status: 'active' },
    })
    expect(second.status()).toBe(409)
    expect(await second.json()).toMatchObject({ error: 'email_taken' })
  })

  test('404 — GET, PATCH, and DELETE on a non-existent id', async () => {
    const missingId = 'clxxxxxxxxxxxxxxxxxxxxxxx0'

    const get = await authed.get(`/api/customers/${missingId}`)
    expect(get.status()).toBe(404)

    const patch = await authed.patch(`/api/customers/${missingId}`, { data: { name: 'Ghost' } })
    expect(patch.status()).toBe(404)

    const del = await authed.delete(`/api/customers/${missingId}`)
    expect(del.status()).toBe(404)
  })

  test('204 then 404 — delete is hard, not soft: the row is actually gone', async () => {
    const email = `hard-delete-${Date.now()}@example.com`
    const created = await authed.post('/api/customers', {
      data: { name: 'Hard Delete Me', email, status: 'active' },
    })
    const { id } = await created.json()

    const del = await authed.delete(`/api/customers/${id}`)
    expect(del.status()).toBe(204)

    const getAfter = await authed.get(`/api/customers/${id}`)
    expect(getAfter.status()).toBe(404)
  })

  test('update rejects an email collision with another existing customer', async () => {
    const emailA = `collide-a-${Date.now()}@example.com`
    const emailB = `collide-b-${Date.now()}@example.com`
    await authed.post('/api/customers', { data: { name: 'A', email: emailA, status: 'active' } })
    const created = await authed.post('/api/customers', { data: { name: 'B', email: emailB, status: 'active' } })
    const { id } = await created.json()

    const res = await authed.patch(`/api/customers/${id}`, { data: { email: emailA } })
    expect(res.status()).toBe(409)
  })
})
