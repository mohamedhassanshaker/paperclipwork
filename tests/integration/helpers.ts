import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

export async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Customer", "User", "LoginAttempt" RESTART IDENTITY CASCADE',
  )
}

export function jsonRequest(
  url: string,
  init?: { method?: string; body?: string },
): NextRequest {
  return new NextRequest(url, {
    method: init?.method,
    body: init?.body,
    headers: { 'content-type': 'application/json' },
  })
}

export const AUTHENTICATED_SESSION = {
  user: { id: 'test-user-id', email: 'admin@example.com' },
  expires: '2099-01-01T00:00:00.000Z',
}
