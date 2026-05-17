import { execSync } from 'node:child_process'
import { existsSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll } from 'vitest'

const ROOT = path.resolve(__dirname, '..')
const TEST_DB_PATH = path.join(ROOT, 'prisma', 'test.db')
const TEST_DB_JOURNAL = `${TEST_DB_PATH}-journal`

// Use a dedicated test SQLite database so we never touch dev.db.
process.env.DATABASE_URL = `file:${TEST_DB_PATH.replace(/\\/g, '/')}`
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET ?? 'test-secret-vU5/Xyz3roogjJBC7uWH7o9Wp7RnFSu1OpcyHaQ6NE='

beforeAll(() => {
  for (const f of [TEST_DB_PATH, TEST_DB_JOURNAL]) {
    if (existsSync(f)) {
      try {
        unlinkSync(f)
      } catch {
        /* ignore */
      }
    }
  }
  execSync('npx prisma db push --skip-generate', {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: 'pipe',
  })
})

afterAll(async () => {
  // Each suite that touches Prisma disconnects in its own afterAll.
})
