// MySQL has no RETURNING clause, so an insert or update cannot hand back the rows it
// touched the way Postgres did. These helpers restore that shape with a follow-up SELECT.
//
// The read is not atomic with the write: a concurrent transaction can change a row between
// the two statements, so what comes back is the row's current state rather than a snapshot
// taken at write time. Every caller here reads its own just-written row and would re-render
// the newer value anyway, so that is the correct outcome — but do not reach for these when
// a caller depends on seeing exactly what it wrote.

import { eq, inArray, type SQL } from 'drizzle-orm';
import type { MySqlColumn, MySqlTable } from 'drizzle-orm/mysql-core';
import { db } from './client.js';

/** Every table in this schema has an auto-increment `id`, which is what makes the re-read possible. */
type TableWithId = MySqlTable & { id: MySqlColumn };

/**
 * Inserts one row and returns it, read back by the id MySQL assigned.
 * Mirrors `.insert(t).values(v).returning()` destructured to its single row.
 */
export async function insertReturning<T extends TableWithId>(
  table: T,
  values: T['$inferInsert'],
): Promise<T['$inferSelect']> {
  const [header] = await db.insert(table).values(values);
  const [row] = await db.select().from(table).where(eq(table.id, header.insertId)).limit(1);
  if (!row) throw new Error(`insertReturning: row ${header.insertId} vanished after insert`);
  return row as T['$inferSelect'];
}

/**
 * Updates the rows matching `where` and returns them.
 *
 * The ids are captured BEFORE the update on purpose: an update commonly changes the very
 * column the predicate tests (marking every unread notification as read, say), so re-running
 * the predicate afterwards would match nothing. Reading by id is stable either way.
 */
export async function updateReturning<T extends TableWithId>(
  table: T,
  values: Partial<T['$inferInsert']>,
  where: SQL | undefined,
): Promise<T['$inferSelect'][]> {
  const targets = await db.select({ id: table.id }).from(table).where(where);
  const ids = targets.map(({ id }) => id as number);
  if (ids.length === 0) return [];

  await db.update(table).set(values).where(inArray(table.id, ids));
  return db.select().from(table).where(inArray(table.id, ids)) as Promise<T['$inferSelect'][]>;
}
