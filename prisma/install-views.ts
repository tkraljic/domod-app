import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const sql = readFileSync(join(__dirname, 'views.sql'), 'utf-8')
  // Run statements individually so a syntax error pinpoints the offending one.
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'))

  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt)
  }
  console.log(`✅ Installed ${statements.length} view statement(s).`)
  console.log('   Try: SELECT * FROM "DeliveryReadable";')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
