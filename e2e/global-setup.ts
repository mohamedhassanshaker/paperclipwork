import { randomBytes } from 'node:crypto'
import { execFile, execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { Client } from 'pg'
import { E2E_ADMIN_EMAIL } from './support/fixtures'

const ROOT = path.resolve(__dirname, '..')
const PORT = Number(process.env.E2E_PORT ?? 4310)

/**
 * Brings up, in order: a real Postgres (ephemeral PGlite locally, or
 * whatever DATABASE_URL CI already provides — mirrors
 * tests/integration/setup/global-setup.ts) → migrations → a seeded admin +
 * the four prototype customers → the app itself (`next dev`, same process
 * that reproduced TAH-30 live). Returns a teardown closure Playwright calls
 * once after the whole run.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const stopDb = await setupDatabase()
  await seed()
  const appProcess = await startApp()

  return async () => {
    appProcess.kill('SIGTERM')
    await stopDb()
  }
}

async function setupDatabase(): Promise<() => Promise<void>> {
  const externalUrl = process.env.DATABASE_URL
  if (externalUrl) {
    await waitForDatabase(externalUrl)
    migrateViaCli(externalUrl)
    return async () => {}
  }

  const port = 56000 + Math.floor(Math.random() * 4000)
  const url = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?connection_limit=1&pgbouncer=true`

  const db = await PGlite.create()
  // tests/integration/setup/global-setup.ts uses maxConnections: 1 safely
  // because it only ever drives the repository directly in-process. This
  // suite also boots a live `next dev` server (its own process, holding its
  // own pooled connection) while spec files that need direct DB assertions
  // (e2e/support/db.ts) open a second, independent PrismaClient — two
  // concurrent consumers, so a single-connection cap starves whichever
  // connects second with an unhelpful "can't reach database server".
  const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 10 })
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

function migrateViaCli(databaseUrl: string): void {
  const prismaBin = path.join(ROOT, 'node_modules', '.bin', 'prisma')
  execFileSync(prismaBin, ['migrate', 'deploy'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  })
}

async function applyMigrationsDirectly(databaseUrl: string): Promise<void> {
  const migrationsDir = path.join(ROOT, 'prisma', 'migrations')
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

const execFileAsync = promisify(execFile)

async function seed(): Promise<void> {
  // Random per-run, never committed or logged — this is a disposable
  // ephemeral database, but there is no reason to use a guessable password.
  const adminPassword = randomBytes(18).toString('base64url')
  process.env.E2E_ADMIN_EMAIL = E2E_ADMIN_EMAIL
  process.env.E2E_ADMIN_PASSWORD = adminPassword

  const tsxBin = path.join(ROOT, 'node_modules', '.bin', 'tsx')
  // execFileSync (TAH-23 follow-up defect) deterministically broke the
  // embedded-PGlite path: it blocks this process's event loop until the
  // child exits, but the PGLiteSocketServer this child needs to connect to
  // also runs on this process's event loop — starving its own dependency.
  // The async execFile keeps this process's loop free to service that
  // socket while awaiting the child. Harmless for the external-DATABASE_URL
  // path (a real Postgres doesn't need this process's event loop at all).
  try {
    await execFileAsync(tsxBin, ['prisma/seed.ts'], {
      cwd: ROOT,
      env: {
        ...process.env,
        SEED_ADMIN_EMAIL: E2E_ADMIN_EMAIL,
        SEED_ADMIN_PASSWORD: adminPassword,
      },
    })
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: string; stderr?: string }
    throw new Error(`prisma/seed.ts failed:\n${stdout ?? ''}${stderr ?? String(error)}`)
  }
}

async function startApp(): Promise<ChildProcess> {
  const nextBin = path.join(ROOT, 'node_modules', '.bin', 'next')
  const child = spawn(nextBin, ['dev', '-p', String(PORT)], {
    cwd: ROOT,
    env: {
      ...process.env,
      // Dev mode, not `next start`: faster CI boot, and it's the exact mode
      // TAH-30's own repro used — the middleware gate bug (and its fix) is
      // mode-independent. The release gate's regression run against a real
      // Railway `next start` staging deployment is the prod-mode check.
      NODE_ENV: 'development',
      AUTH_SECRET: process.env.AUTH_SECRET ?? randomBytes(24).toString('base64url'),
      PORT: String(PORT),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const output: Buffer[] = []
  child.stdout?.on('data', (chunk) => output.push(chunk))
  child.stderr?.on('data', (chunk) => output.push(chunk))
  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      // eslint-disable-next-line no-console
      console.error(`[e2e] app server exited early (code ${code}):\n${Buffer.concat(output).toString('utf8')}`)
    }
  })

  await waitForHealth(`http://127.0.0.1:${PORT}/api/health`, child, output)
  return child
}

async function waitForHealth(url: string, child: ChildProcess, output: Buffer[], attempts = 120): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (child.exitCode !== null) {
      throw new Error(`App server exited before becoming healthy:\n${Buffer.concat(output).toString('utf8')}`)
    }
    try {
      // Any HTTP response — even a 307 — means the server is up and
      // listening. Whether /api/health answers *correctly* (200, bypassing
      // auth) is itself something this suite asserts on, not a precondition
      // for starting it (see e2e/specs/api/middleware-gate.spec.ts, TAH-30).
      await fetch(url)
      return
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`App server at ${url} never became healthy within timeout.`)
}
