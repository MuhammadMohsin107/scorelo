import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { auditScores, audits } from '../db/schema.js';
import { ApiError } from '../middleware/error.js';
import { getCurrentStoreId } from './store.service.js';
import { listPriorityFindings } from './finding.service.js';

export async function getDashboardSummary(userId: number, storeId?: number) {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  const auditRows = await db.select().from(audits).where(eq(audits.storeId, resolvedStoreId)).orderBy(desc(audits.runAt)).limit(2);
  const latest = auditRows[0];
  if (!latest) throw new ApiError(404, 'No audits found', 'AUDITS_NOT_FOUND');
  const previous = auditRows[1] ?? null;
  const scores = await db.select().from(auditScores).where(eq(auditScores.auditId, latest.id));
  const priorityFindings = await listPriorityFindings(userId, resolvedStoreId);
  return { latest, previous, scores, priorityFindings: priorityFindings.map(({ finding }) => finding) };
}
