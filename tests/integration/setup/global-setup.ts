import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { Client } from 'pg'

/**
 * Integration tests run against a real PostgreSQL wire protocol — never a
 * mock or an in-memory substitute for Prisma itself. In CI (or any
 * environment that already provides `DATABASE_URL`, e.g. a GitHub Actions
 * Postgres service container) we shell out to `prisma migrate deploy`, same
 * as production. Locally, where Docker/Postgres are not available, we stand
 * up an ephemeral, disposable Postgres via PGlite + pglite-socket — a real
 * Postgres engine (compiled to WASM) served over the real Postgres wire
 * protocol on a loopback socket — and apply the checked-in migration SQL
 * directly over the same in-process connection, because this sandbox does
 * not route a spawned child process's loopback traffic back to a socket this
 * process is listening on.
 */
export default async function setup() {
  const externalUrl = process.env.DATABASE_URL

  if (externalUrl) {
    await waitForDatabase(externalUrl)
    migrateViaCli(externalUrl)
    return
  }

  const port = 55000 + Math.floor(Math.random() * 5000)
  // pgbouncer=true tells Prisma to skip named prepared statements (the same
  // flag used for PgBouncer transaction pooling). Each Vitest test file is a
  // separate process reconnecting to the same long-lived PGlite instance, and
  // PGlite's prepared-statement namespace is not reliably scoped per logical
  // socket connection, so a named statement from a previous process's
  // connection can otherwise collide with the next one's. connection_limit=1
  // avoids PGlite's socket multiplexer, which does not reliably support more
  // than one concurrent connection — see
  // https://github.com/electric-sql/pglite/tree/main/packages/pglite-socket#readme.
  const url = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?connection_limit=1&pgbouncer=true`

  const db = await PGlite.create()
  const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 1 })
  await server.start()

  process.env.DATABASE_URL = url
  await applyMigrationsDirectly(url)

  return async () => {
    await server.stop()
    await db.close()
  }
}

async function waitForDatabase(url: string, attempts = 20): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const client = new Client({ connectionString: url })
    try {
      await client.connect()
      await client.query('SELECT 1')
      return
    } catch (error) {
      if (attempt === attempts) {
        throw new Error(`Database at ${url} never became reachable: ${String(error)}`)
      }
      await new Promise((resolve) => setTimeout(resolve, 150))
    } finally {
      await client.end().catch(() => {})
    }
  }
}

function migrateViaCli(databaseUrl: string) {
  const prismaBin = path.join(process.cwd(), 'node_modules', '.bin', 'prisma')
  execFileSync(prismaBin, ['migrate', 'deploy'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  })
}

// Applies every migration.sql file under prisma/migrations, in order, in-process.
async function applyMigrationsDirectly(databaseUrl: string): Promise<void> {
  const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations')
  const migrationFolders = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  const client = new Client({ connectionString: databaseUrl })
  await client.connect()
  try {
    for (const folder of migrationFolders) {
      const sql = readFileSync(path.join(migrationsDir, folder, 'migration.sql'), 'utf8')
      await client.query(sql)
    }
  } finally {
    await client.end()
  }
}
