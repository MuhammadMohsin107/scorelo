import { and, count, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { updateReturning } from '../db/returning.js';
import { audits, findings } from '../db/schema.js';
import { ApiError } from '../middleware/error.js';
import { getCurrentStoreId } from './store.service.js';
import type { BulkFindingStatusInput, FindingListQuery, UpdateFindingStatusInput } from '../schemas/finding.schema.js';

function storeFindingCondition(storeId: number) {
  return eq(audits.storeId, storeId);
}

/**
 * Findings belong to ONE audit, and every re-run writes a fresh set. Scoping reads to the newest
 * audit is what stops the Fix Center showing the same issue once per historical run — three
 * audits of this store were rendering 48 rows for 16 real problems, and "10 open" on the
 * dashboard was counting the same handful of issues repeatedly.
 *
 * Correlated subquery rather than a second round trip, so the list and its COUNT(*) can never
 * disagree about which audit they are describing.
 */
function latestAuditCondition(storeId: number) {
  return eq(
    findings.auditId,
    sql`(SELECT MAX(${audits.id}) FROM ${audits} WHERE ${audits.storeId} = ${storeId})`,
  );
}

/**
 * Severity is a varchar, so ORDER BY severity DESC sorted it ALPHABETICALLY —
 * medium > low > high > critical — which pushed critical findings to the very bottom of the
 * "priority" list. In practice /findings/priority returned ten mediums and never surfaced a
 * critical or high at all. FIELD() imposes the real severity ladder instead.
 */
const severityRank = sql`FIELD(${findings.severity}, 'critical', 'high', 'medium', 'low')`;

function optionalConditions(query: FindingListQuery) {
  const conditions = [];
  if (query.pillar) conditions.push(eq(findings.pillar, query.pillar));
  if (query.subPillar) conditions.push(eq(findings.subPillar, query.subPillar));
  if (query.status) conditions.push(eq(findings.status, query.status));
  if (query.severity) conditions.push(eq(findings.severity, query.severity));
  if (query.search) {
    const term = `%${query.search}%`;
    // Postgres needed ILIKE for a case-insensitive match; MySQL's default collation
    // (utf8mb4_general_ci / _0900_ai_ci) already compares LIKE case-insensitively.
    conditions.push(or(like(findings.title, term), like(findings.subPillar, term), like(findings.recommendation, term)));
  }
  return conditions;
}

export async function listFindings(userId: number, query: FindingListQuery, storeId?: number) {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  const offset = (query.page - 1) * query.limit;
  const conditions = [storeFindingCondition(resolvedStoreId), latestAuditCondition(resolvedStoreId), ...optionalConditions(query)];
  const where = and(...conditions);
  const [items, [{ total }]] = await Promise.all([
    db.select({ finding: findings }).from(findings).innerJoin(audits, eq(findings.auditId, audits.id)).where(where).orderBy(severityRank, desc(findings.affectedCount), desc(findings.id)).limit(query.limit).offset(offset),
    db.select({ total: count() }).from(findings).innerJoin(audits, eq(findings.auditId, audits.id)).where(where),
  ]);

  return {
    items: items.map(({ finding }) => finding),
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
}

export async function listPriorityFindings(userId: number, storeId?: number, limit = 10) {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  const rows = await db
    .select({ finding: findings })
    .from(findings)
    .innerJoin(audits, eq(findings.auditId, audits.id))
    .where(and(
      storeFindingCondition(resolvedStoreId),
      latestAuditCondition(resolvedStoreId),
      inArray(findings.status, ['open', 'reviewed']),
    ))
    .orderBy(severityRank, desc(findings.affectedCount))
    .limit(limit);
  // Unwrapped here rather than by each caller: GET /findings/priority was returning the raw
  // join shape [{ finding: {...} }], so every consumer had to know about the wrapper.
  return rows.map(({ finding }) => finding);
}

export async function getFinding(userId: number, id: number, storeId?: number) {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  const [result] = await db.select({ finding: findings }).from(findings).innerJoin(audits, eq(findings.auditId, audits.id)).where(and(eq(findings.id, id), storeFindingCondition(resolvedStoreId))).limit(1);
  if (!result) throw new ApiError(404, 'Finding not found', 'FINDING_NOT_FOUND');
  return result.finding;
}

export async function updateFindingStatus(userId: number, id: number, input: UpdateFindingStatusInput, storeId?: number) {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  const auditRows = await db.select({ id: audits.id }).from(audits).where(eq(audits.storeId, resolvedStoreId));
  const auditIds = auditRows.map(({ id: auditId }) => auditId);
  const [updated] = auditIds.length === 0 ? [] : await updateReturning(findings, { status: input.status, statusChangedAt: new Date() }, and(eq(findings.id, id), inArray(findings.auditId, auditIds)));
  if (!updated) throw new ApiError(404, 'Finding not found', 'FINDING_NOT_FOUND');
  return updated;
}

export async function bulkUpdateFindingStatus(userId: number, input: BulkFindingStatusInput, storeId?: number) {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  const eligible = await db.select({ id: findings.id }).from(findings).innerJoin(audits, eq(findings.auditId, audits.id)).where(and(storeFindingCondition(resolvedStoreId), inArray(findings.id, input.ids)));
  const eligibleIds = eligible.map(({ id }) => id);
  if (eligibleIds.length !== input.ids.length) throw new ApiError(404, 'One or more findings were not found', 'FINDINGS_NOT_FOUND');
  return updateReturning(findings, { status: input.status, statusChangedAt: new Date() }, inArray(findings.id, eligibleIds));
}
