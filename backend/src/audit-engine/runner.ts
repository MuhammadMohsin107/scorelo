import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { auditScores, audits, findings, jobs, stores } from '../db/schema.js';
import { checkRegistry } from './index.js';
import { scoreOverall, scorePillar } from './scoring.js';
import { resolveStoreDataProvider, StoreDataError, type StoreDataProvider, type StoreSnapshot } from './store-data/index.js';
import { unavailableResult, type AuditCheck, type PillarKey, type SubPillarResult } from './types.js';

/** Seams for integration tests to drive the worker without a live Shopify shop.
 * Production always uses the defaults. */
export interface RunnerDeps {
  resolveProvider?: (storeId: number) => Promise<StoreDataProvider>;
  checks?: AuditCheck[];
}

const PILLAR_ORDER: PillarKey[] = ['seo', 'content', 'speed', 'cro', 'ai-discovery'];

/** Structured log line. Never includes tokens, secrets or credentials — only ids and counts. */
function log(event: string, fields: Record<string, unknown>) {
  console.log(JSON.stringify({ event, ...fields, at: new Date().toISOString() }));
}

interface PillarOutcome {
  pillar: PillarKey;
  subPillarResults: SubPillarResult[];
  failedChecks: string[];
}

/**
 * Executes every registered check against one shared snapshot.
 *
 * Failure isolation (master prompt C5): a check that throws is recorded as an `unavailable`
 * result for its own sub-pillar and the run continues. One broken check can never discard an
 * entire audit, and its failure is surfaced honestly rather than scored as a zero.
 */
async function runChecks(
  snapshot: StoreSnapshot,
  jobId: number,
  checks: AuditCheck[],
  onProgress: (done: number, total: number) => Promise<void>,
): Promise<PillarOutcome[]> {
  const byPillar = new Map<PillarKey, PillarOutcome>();
  for (const pillar of PILLAR_ORDER) {
    byPillar.set(pillar, { pillar, subPillarResults: [], failedChecks: [] });
  }

  let done = 0;
  for (const check of checks) {
    const outcome = byPillar.get(check.pillar);
    if (!outcome) continue;

    try {
      outcome.subPillarResults.push(await check.execute(snapshot));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown check failure';
      log('audit.check_failed', { jobId, checkId: check.id, error: message });
      outcome.failedChecks.push(check.id);
      outcome.subPillarResults.push(unavailableResult(check.subPillar, `This check could not complete: ${message}`));
    }

    done += 1;
    await onProgress(done, checks.length);
  }

  // Only pillars that actually produced results are persisted — an unimplemented pillar is
  // absent rather than present-with-a-zero, so the UI can show "not yet available".
  return [...byPillar.values()].filter((outcome) => outcome.subPillarResults.length > 0);
}

async function persistAudit(storeId: number, outcomes: PillarOutcome[], snapshot: StoreSnapshot, checkCount: number): Promise<number> {
  const pillarScores = outcomes.map((outcome) => scorePillar(outcome.subPillarResults));
  const overall = scoreOverall(pillarScores);

  return db.transaction(async (tx) => {
    // MySQL has no RETURNING; $returningId reads back the auto-increment id the insert
    // assigned. Used directly rather than via db/returning.ts so the read stays inside
    // this transaction — the audit row is not visible outside it until commit.
    const [audit] = await tx
      .insert(audits)
      .values({
        storeId,
        // audits.overall_score is NOT NULL; when nothing was measurable we store 0 but record
        // overallAvailable:false so consumers can render "unavailable" instead of a fake zero.
        overallScore: overall ?? 0,
        source: 'engine',
        metadata: {
          overallAvailable: overall !== null,
          provider: 'shopify',
          shopDomain: snapshot.shop.domain,
          capturedAt: snapshot.capturedAt.toISOString(),
          coverage: snapshot.coverage,
          scope: snapshot.scope,
          resourceCounts: {
            products: snapshot.products.length,
            collections: snapshot.collections.length,
            pages: snapshot.pages.length,
            articles: snapshot.articles.length,
            policies: snapshot.policies.length,
          },
          snapshotWarnings: snapshot.warnings,
          failedChecks: outcomes.flatMap((outcome) => outcome.failedChecks),
          checksRegistered: checkCount,
        },
      })
      .$returningId();
    if (!audit) throw new Error('Failed to create audit record');

    for (const [index, outcome] of outcomes.entries()) {
      const pillarScore = pillarScores[index];
      const measured = outcome.subPillarResults.filter((result) => result.status === 'ok');

      await tx.insert(auditScores).values({
        auditId: audit.id,
        pillar: outcome.pillar,
        subPillar: null,
        score: pillarScore ?? 0,
        checksTotal: measured.reduce((sum, result) => sum + result.analyzedCount, 0),
        checksPassed: measured.reduce((sum, result) => sum + result.healthyCount, 0),
        details: { status: pillarScore === null ? 'unavailable' : 'ok' },
      });

      for (const result of outcome.subPillarResults) {
        await tx.insert(auditScores).values({
          auditId: audit.id,
          pillar: outcome.pillar,
          subPillar: result.subPillar,
          score: result.score,
          analyzedCount: result.analyzedCount,
          healthyCount: result.healthyCount,
          details: result.details,
        });

        for (const finding of result.findings) {
          await tx.insert(findings).values({
            auditId: audit.id,
            pillar: outcome.pillar,
            subPillar: result.subPillar,
            title: finding.title,
            severity: finding.severity,
            resolutionType: finding.resolutionType ?? null,
            affectedCount: finding.affectedCount,
            affectedLabel: finding.affectedLabel,
            impact: finding.impact,
            scoreLift: finding.scoreLift,
            why: finding.why,
            recommendation: finding.recommendation,
            problem: finding.problem,
            evidence: finding.evidence,
            evidenceRows: finding.evidenceRows ?? null,
            details: finding.details,
          });
        }
      }
    }

    return audit.id;
  });
}

/**
 * Runs one audit job end to end and owns its lifecycle (running -> succeeded/failed).
 * Fire-and-forget from job.service.ts, so it must never throw: every exit path writes a
 * terminal job status, ensuring a job is never left stuck in `running`.
 */
export async function runAuditJob(jobId: number, deps: RunnerDeps = {}): Promise<void> {
  const checks = deps.checks ?? checkRegistry;
  const resolveProvider = deps.resolveProvider ?? resolveStoreDataProvider;

  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job) return;

  try {
    await db.update(jobs).set({ status: 'running', startedAt: new Date(), progress: 0 }).where(eq(jobs.id, jobId));
    log('audit.started', { jobId, storeId: job.storeId });

    const [store] = await db.select().from(stores).where(eq(stores.id, job.storeId)).limit(1);
    if (!store) throw new Error('Store not found');

    // Fetch once, normalize once, reuse across every check (master prompt: PERFORMANCE).
    const provider = await resolveProvider(job.storeId);
    const snapshot = await provider.buildSnapshot();
    log('audit.snapshot_built', {
      jobId,
      storeId: job.storeId,
      products: snapshot.products.length,
      collections: snapshot.collections.length,
      pages: snapshot.pages.length,
      articles: snapshot.articles.length,
      warnings: snapshot.warnings.length,
    });

    const outcomes = await runChecks(snapshot, jobId, checks, async (done, total) => {
      const progress = total === 0 ? 90 : Math.min(90, Math.round((done / total) * 90));
      await db.update(jobs).set({ progress }).where(eq(jobs.id, jobId));
    });

    const auditId = await persistAudit(job.storeId, outcomes, snapshot, checks.length);
    await db.update(jobs).set({ status: 'succeeded', progress: 100, auditId, finishedAt: new Date() }).where(eq(jobs.id, jobId));
    log('audit.completed', { jobId, storeId: job.storeId, auditId, pillars: outcomes.length });
  } catch (error) {
    const message =
      error instanceof StoreDataError
        ? `${error.code}: ${error.message}`
        : error instanceof Error
          ? error.message
          : 'Unknown error';
    await db.update(jobs).set({ status: 'failed', error: message, finishedAt: new Date() }).where(eq(jobs.id, jobId));
    log('audit.failed', { jobId, storeId: job.storeId, error: message });
  }
}
