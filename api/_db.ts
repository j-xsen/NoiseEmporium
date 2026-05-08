// _db.ts — Neon serverless PostgreSQL client.
//
// `sql` is a tagged-template function: sql`SELECT * FROM t WHERE id = ${id}`
// automatically parameterises the query — never interpolate values directly.
// DATABASE_URL is set in Vercel environment variables and points to the Neon
// connection string (includes pooling via ?sslmode=require).

import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

export default sql
