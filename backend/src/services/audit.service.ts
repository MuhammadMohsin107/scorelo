import { and, count, desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { auditScores, audits, findings } from '../db/schema.js';
import { ApiError } from '../middleware/error.js';
import { getCurrentStoreId } from './store.service.js';
import type { AuditListQuery, LatestAuditQuery } from '../schemas/audit.schema.js';

export async function listAudits(userId: number, { page, limit }: AuditListQuery, storeId?: number) {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  const offset = (page - 1) * limit;
  const [items, [{ total }]] = await Promise.all([
    db.select().from(audits).where(eq(audits.storeId, resolvedStoreId)).orderBy(desc(audits.runAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(audits).where(eq(audits.storeId, resolvedStoreId)),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getLatestAudit(userId: number, { pillar }: LatestAuditQuery, storeId?: number) {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  const [audit] = await db.select().from(audits).where(eq(audits.storeId, resolvedStoreId)).orderBy(desc(audits.runAt)).limit(1);
  if (!audit) throw new ApiError(404, 'Latest audit not found', 'AUDIT_NOT_FOUND');

  const conditions = [eq(auditScores.auditId, audit.id)];
  if (pillar) conditions.push(eq(auditScores.pillar, pillar));
  const scores = await db.select().from(auditScores).where(and(...conditions));
  return { audit, scores };
}

export async function getAuditScores(userId: number, id: number, storeId?: number) {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  const [audit] = await db.select().from(audits).where(and(eq(audits.id, id), eq(audits.storeId, resolvedStoreId))).limit(1);
  if (!audit) throw new ApiError(404, 'Audit not found', 'AUDIT_NOT_FOUND');

  const scores = await db.select().from(auditScores).where(eq(auditScores.auditId, id));
  return { audit, scores };
}

interface SubPillarScoreDetails {
  /** 'unavailable' means the check could not measure this — the UI must render that state
   * rather than the numeric score, which is meaningless in that case. */
  status?: 'ok' | 'unavailable';
  unavailableReason?: string;
  summary?: string;
  healthChip?: string;
  contextLabel?: string;
  contextValue?: string;
  healthyStatus?: string;
  evidenceRows?: unknown[];
}

interface FindingDetails {
  issueType?: string;
  effort?: 'High' | 'Medium' | 'Low';
}

/**
 * Data-only slice of the frontend's SubPillarAnalysis contract (no columns/sorts/facet —
 * those are presentation config that stays in the frontend catalog, see backend-plan.md §3.1).
 */
export async function getSubPillarAnalysis(userId: number, pillar: string, subPillar: string, storeId?: number) {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  const [audit] = await db.select().from(audits).where(eq(audits.storeId, resolvedStoreId)).orderBy(desc(audits.runAt)).limit(1);
  if (!audit) throw new ApiError(404, 'Latest audit not found', 'AUDIT_NOT_FOUND');

  const [scoreRow] = await db
    .select()
    .from(auditScores)
    .where(and(eq(auditScores.auditId, audit.id), eq(auditScores.pillar, pillar), eq(auditScores.subPillar, subPillar)))
    .limit(1);
  if (!scoreRow) throw new ApiError(404, 'Sub-pillar analysis not found', 'SUB_PILLAR_NOT_FOUND');

  const findingRows = await db
    .select()
    .from(findings)
    .where(and(eq(findings.auditId, audit.id), eq(findings.pillar, pillar), eq(findings.subPillar, subPillar)));

  const details = (scoreRow.details ?? {}) as SubPillarScoreDetails;

  return {
    slug: subPillar,
    // Seeded demo rows predate the status field; they are genuine measured fixtures, so
    // absence of an explicit status means 'ok' rather than 'unavailable'.
    status: details.status ?? 'ok',
    unavailableReason: details.unavailableReason ?? null,
    /** 'seed' marks development/demo fixtures so the UI can never present them as a real audit. */
    source: audit.source,
    summary: details.summary ?? '',
    healthChip: details.healthChip ?? '',
    totals: {
      score: scoreRow.score,
      analyzed: scoreRow.analyzedCount ?? 0,
      healthy: scoreRow.healthyCount ?? 0,
      // Sum of affected items across findings (not a count of finding rows), floored at
      // analyzed - healthy — the same convention the frontend's buildAnalysis used.
      issues: Math.max(
        findingRows.reduce((sum, finding) => sum + finding.affectedCount, 0),
        (scoreRow.analyzedCount ?? 0) - (scoreRow.healthyCount ?? 0),
      ),
      critical: findingRows.filter((finding) => finding.severity === 'critical').reduce((sum, finding) => sum + finding.affectedCount, 0),
      contextLabel: details.contextLabel ?? '',
      contextValue: details.contextValue ?? '',
    },
    findings: findingRows.map((finding) => {
      const findingDetails = (finding.details ?? {}) as FindingDetails;
      return {
        id: String(finding.id),
        issueType: findingDetails.issueType ?? finding.title,
        title: finding.title,
        severity: finding.severity,
        affected: finding.affectedCount,
        impact: finding.impact,
        effort: findingDetails.effort ?? 'Medium',
        whatIsWrong: finding.problem ?? '',
        whyItMatters: finding.why,
        recommendation: finding.recommendation,
        // The rows THIS finding flagged, as recorded by the check that raised it. Without this the
        // UI can only re-derive a finding's evidence by matching issue type against the sub-pillar
        // sample, which returns the same handful of rows for every finding sharing that type.
        // Null for checks that raise a finding without attaching rows — the caller falls back.
        evidenceRows: (finding.evidenceRows as unknown[] | null) ?? undefined,
      };
    }),
    evidenceRows: details.evidenceRows ?? [],
    // Each sub-pillar names its own healthy state ('Lean', 'Optimized', 'Unique'…). Without this
    // the UI can only look for the literal word 'Healthy' and marks every good row as an issue.
    // Audits recorded before this field existed fall back to 'Healthy', which is what they used.
    healthyStatus: details.healthyStatus ?? 'Healthy',
    lastAnalyzed: audit.runAt,
  };
}
