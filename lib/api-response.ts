import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export type ApiErrorCode =
  | 'unauthorized'
  | 'not_found'
  | 'validation_failed'
  | 'email_taken'
  | 'rate_limited'
  | 'internal_error'

export function errorResponse(
  status: number,
  error: ApiErrorCode,
  message: string,
  fields?: Record<string, string>,
) {
  return NextResponse.json(fields ? { error, message, fields } : { error, message }, { status })
}

/** Resolves the current session, or `null` if the caller is unauthenticated. */
export async function requireSession() {
  const session = await auth()
  return session?.user ? session : null
}
