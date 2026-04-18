import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as schema from './schema'

const dbPath = process.env.DATABASE_PATH ?? './dev.db'
export const sqlite = new Database(dbPath, { create: true })
export const db = drizzle(sqlite, { schema })
