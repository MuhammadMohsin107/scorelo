// One-shot migration runner (npm run db:migrate). Uses drizzle-orm's
// programmatic migrator so failures surface with real error messages.
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { db, pool } from './client.js';

try {
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('[scorelo-db] migrations applied');
} catch (error) {
  console.error('[scorelo-db] migration failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
