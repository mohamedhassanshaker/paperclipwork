import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'

const port = Number(process.argv[2] ?? 54329)

const db = await PGlite.create()
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 10 })
await server.start()

console.log(`READY postgresql://postgres:postgres@127.0.0.1:${port}/postgres`)

process.on('SIGTERM', async () => {
  await server.stop()
  await db.close()
  process.exit(0)
})
