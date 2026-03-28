import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { config as loadDotenv } from 'dotenv'
import { defineConfig } from 'prisma/config'

// Prisma config disables Prisma's automatic .env loading, so we load it here.
const envPath = resolve(process.cwd(), '..', '.env')
if (existsSync(envPath)) loadDotenv({ path: envPath })

export default defineConfig({
  schema: './schema.prisma',
})
