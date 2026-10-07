export type Session = {
  user: { id: string; email: string; name?: string | null }
  expires: string
}

// TODO(TAH-19): replace with the real Auth.js v5 credentials session lookup.
// Route handlers only need an `auth(): Promise<Session | null>` shape, so
// this fails closed (always unauthenticated) until the real provider lands —
// no route can be reached without a session either way before TAH-19 ships
// the login flow. Mirrors the lib/stub-session.ts placeholder pattern.
export async function auth(): Promise<Session | null> {
  return null
}
