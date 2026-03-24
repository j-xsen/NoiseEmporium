import { neon } from '@neondatabase/serverless'

// Tagged-template SQL client — queries are automatically parameterized.
const sql = neon(process.env.DATABASE_URL!)

export default sql
