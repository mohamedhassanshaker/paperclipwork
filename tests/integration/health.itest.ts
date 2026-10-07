import { describe, expect, it } from 'vitest'
import { GET } from '@/app/api/health/route'
import { resetDatabase } from './helpers'

describe('GET /api/health', () => {
  it('returns 200 ok when the database is reachable, unauthenticated', async () => {
    await resetDatabase()
    const res = await GET()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ status: 'ok', db: 'ok' })
  })
})
