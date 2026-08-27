import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { insertReturning } from '../db/returning.js';
import { jobs } from '../db/schema.js';
import { ApiError } from '../middleware/error.js';
import { getCurrentStoreId } from './store.service.js';
import { runAuditJob } from '../audit-engine/runner.js';
import { hasStoreDataSource } from '../audit-engine/store-data/index.js';

export async function createAuditJob(userId: number, storeId?: number) {
  // getCurrentStoreId scopes to stores this user owns, so a customer can never trigger
  // an audit against another customer's store by passing an arbitrary storeId.
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);

  // Reject up-front rather than queueing a job that would inevitably fail in the worker.
  if (!(await hasStoreDataSource(resolvedStoreId))) {
    throw new ApiError(400, 'Connect a Shopify store before running an audit', 'STORE_NOT_CONNECTED');
  }

  // The upfront SELECT is just a fast-path for the common case (nicer error before doing any
  // insert work) — it is NOT what prevents the race. `jobs_store_active_unique_idx` (a partial
  // unique index in schema.ts) is what actually makes "at most one active job per store" atomic;
  // the catch below turns its violation into the same clean 409 for the concurrent case.
  const [existing] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.storeId, resolvedStoreId), inArray(jobs.status, ['queued', 'running'])))
    .limit(1);
  if (existing) throw new ApiError(409, 'An audit run is already in progress for this store', 'AUDIT_RUN_IN_PROGRESS');

  let job;
  try {
    job = await insertReturning(jobs, { storeId: resolvedStoreId, type: 'audit_run' });
  } catch (error) {
    // MySQL reports a unique-index violation as ER_DUP_ENTRY (1062); Postgres used SQLSTATE
    // 23505. Both mean jobs_store_active_unique_idx rejected a second active job for this store.
    if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'An audit run is already in progress for this store', 'AUDIT_RUN_IN_PROGRESS');
    }
    throw error;
  }
  if (!job) throw new ApiError(500, 'Unable to start audit run', 'AUDIT_RUN_CREATE_FAILED');

  // Fire-and-forget: the HTTP response returns immediately with the job id for polling.
  // runAuditJob owns the job's full lifecycle (including writing 'failed' on any error), so
  // this .catch is only a last-resort safety net against a rejection before its own try/catch runs.
  void runAuditJob(job.id).catch((error) => {
    console.error('[scorelo-api] audit job crashed before entering its own error handling', error);
  });

  return job;
}

export async function getJob(userId: number, id: number, storeId?: number) {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.storeId, resolvedStoreId))).limit(1);
  if (!job) throw new ApiError(404, 'Job not found', 'JOB_NOT_FOUND');
  return job;
}
