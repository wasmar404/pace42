import { existsSync } from 'node:fs'

import { config as loadDotenv } from 'dotenv'
import { defineConfig } from 'prisma/config'

// Prisma config disables Prisma's automatic .env loading, so we load it here.
if (existsSync('.env')) loadDotenv({ path: '.env' })
if (existsSync('.env.local')) loadDotenv({ path: '.env.local', override: true })

export default defineConfig({
  schema: './schema.prisma',
})
