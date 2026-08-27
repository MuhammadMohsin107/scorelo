import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { env } from '../config/env.js';
import * as schema from './schema.js';

export const pool = mysql.createPool({
  uri: env.databaseUrl,
  connectionLimit: 10,
  // Pin the session to UTC. MySQL renders DATETIME in the session time zone, so without
  // this a server set to local time would read back values shifted from what was written.
  timezone: 'Z',
  // mysql2 returns DECIMAL/BIGINT as strings by default; the schema uses neither, but
  // this keeps a future BIGINT column from silently arriving as a string.
  supportBigNumbers: true,
});

export const db = drizzle(pool, { schema, mode: 'default' });

/** True when MySQL answers a trivial query. Never throws. */
export async function pingDatabase(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
