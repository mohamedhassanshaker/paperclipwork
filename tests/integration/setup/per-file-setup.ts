import { afterAll } from 'vitest'
import { prisma } from '@/lib/db'

// Each test file is a separate process reconnecting to the same long-lived
// PGlite instance (see global-setup.ts). Disconnecting gracefully here, as
// opposed to letting the process exit and the socket close abruptly, avoids
// leaving stale per-connection state (e.g. prepared statements) behind for
// the next file's connection.
afterAll(async () => {
  await prisma.$disconnect()
})
