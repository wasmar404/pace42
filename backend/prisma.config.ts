import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { config as loadDotenv } from 'dotenv'
import { defineConfig } from 'prisma/config'

const envPath = resolve(process.cwd(), '..', '.env')
if (existsSync(envPath)) loadDotenv({ path: envPath })

export default defineConfig({
  schema: './schema.prisma',
})
