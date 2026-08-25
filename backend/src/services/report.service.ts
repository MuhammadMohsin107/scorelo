import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { auditScores, audits } from '../db/schema.js';
import { ApiError } from '../middleware/error.js';
import { getCurrentStoreId } from './store.service.js';
import type { ReportTrendQuery } from '../schemas/report.schema.js';

export async function getReportTrend(userId: number, { limit }: ReportTrendQuery, storeId?: number) {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  const auditsInRange = await db.select().from(audits).where(eq(audits.storeId, resolvedStoreId)).orderBy(desc(audits.runAt)).limit(limit);
  return auditsInRange.reverse().map((audit) => ({ id: audit.id, runAt: audit.runAt, overallScore: audit.overallScore }));
}

export async function getReportComparison(userId: number, storeId?: number) {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  const auditRows = await db.select().from(audits).where(eq(audits.storeId, resolvedStoreId)).orderBy(desc(audits.runAt)).limit(2);
  if (auditRows.length === 0) throw new ApiError(404, 'No completed audits found', 'AUDITS_NOT_FOUND');

  const current = auditRows[0];
  const previous = auditRows[1] ?? null;
  const currentScores = await db.select().from(auditScores).where(eq(auditScores.auditId, current.id));
  const previousScores = previous ? await db.select().from(auditScores).where(eq(auditScores.auditId, previous.id)) : [];
  return { current, previous, currentScores, previousScores };
}

export function escapeCsv(value: string | number | Date | null) {
  const text = value instanceof Date ? value.toISOString() : String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function getReportCsv(userId: number, storeId?: number) {
  const comparison = await getReportComparison(userId, storeId);
  const previousByKey = new Map(comparison.previousScores.map((score) => [`${score.pillar}:${score.subPillar ?? ''}`, score]));
  const lines = ['Pillar,Sub-pillar,Current score,Previous score,Change'];
  for (const score of comparison.currentScores) {
    const previous = previousByKey.get(`${score.pillar}:${score.subPillar ?? ''}`);
    const change = previous ? score.score - previous.score : '';
    lines.push([score.pillar, score.subPillar, score.score, previous?.score ?? '', change].map(escapeCsv).join(','));
  }
  return lines.join('\n');
}
