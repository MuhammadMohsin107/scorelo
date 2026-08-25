import { and, count, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { db } from '../db/client.js';
import { audits, findings } from '../db/schema.js';
import { ApiError } from '../middleware/error.js';
import { getCurrentStoreId } from './store.service.js';
import type { BulkFindingStatusInput, FindingListQuery, UpdateFindingStatusInput } from '../schemas/finding.schema.js';

function storeFindingCondition(storeId: number) {
  return eq(audits.storeId, storeId);
}

function optionalConditions(query: FindingListQuery) {
  const conditions = [];
  if (query.pillar) conditions.push(eq(findings.pillar, query.pillar));
  if (query.subPillar) conditions.push(eq(findings.subPillar, query.subPillar));
  if (query.status) conditions.push(eq(findings.status, query.status));
  if (query.severity) conditions.push(eq(findings.severity, query.severity));
  if (query.search) {
    const term = `%${query.search}%`;
    conditions.push(or(ilike(findings.title, term), ilike(findings.subPillar, term), ilike(findings.recommendation, term)));
  }
  return conditions;
}

export async function listFindings(userId: number, query: FindingListQuery, storeId?: number) {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  const offset = (query.page - 1) * query.limit;
  const conditions = [storeFindingCondition(resolvedStoreId), ...optionalConditions(query)];
  const where = and(...conditions);
  const [items, [{ total }]] = await Promise.all([
    db.select({ finding: findings }).from(findings).innerJoin(audits, eq(findings.auditId, audits.id)).where(where).orderBy(desc(findings.affectedCount), desc(findings.id)).limit(query.limit).offset(offset),
    db.select({ total: count() }).from(findings).innerJoin(audits, eq(findings.auditId, audits.id)).where(where),
  ]);

  return {
    items: items.map(({ finding }) => finding),
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
}

export async function listPriorityFindings(userId: number, storeId?: number, limit = 10) {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  return db.select({ finding: findings }).from(findings).innerJoin(audits, eq(findings.auditId, audits.id)).where(and(storeFindingCondition(resolvedStoreId), inArray(findings.status, ['open', 'reviewed']))).orderBy(desc(findings.severity), desc(findings.affectedCount)).limit(limit);
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
  const [updated] = auditIds.length === 0 ? [] : await db.update(findings).set({ status: input.status, statusChangedAt: new Date() }).where(and(eq(findings.id, id), inArray(findings.auditId, auditIds))).returning();
  if (!updated) throw new ApiError(404, 'Finding not found', 'FINDING_NOT_FOUND');
  return updated;
}

export async function bulkUpdateFindingStatus(userId: number, input: BulkFindingStatusInput, storeId?: number) {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  const eligible = await db.select({ id: findings.id }).from(findings).innerJoin(audits, eq(findings.auditId, audits.id)).where(and(storeFindingCondition(resolvedStoreId), inArray(findings.id, input.ids)));
  const eligibleIds = eligible.map(({ id }) => id);
  if (eligibleIds.length !== input.ids.length) throw new ApiError(404, 'One or more findings were not found', 'FINDINGS_NOT_FOUND');
  return db.update(findings).set({ status: input.status, statusChangedAt: new Date() }).where(inArray(findings.id, eligibleIds)).returning();
}
