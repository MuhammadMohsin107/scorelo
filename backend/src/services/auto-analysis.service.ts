import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { audits, stores } from '../db/schema.js';
import { env } from '../config/env.js';
import { ApiError } from '../middleware/error.js';
import { createAuditJob } from './job.service.js';
import { hasStoreDataSource } from '../audit-engine/store-data/index.js';

/**
 * ─── Scheduled re-analysis ───────────────────────────────────────────
 *
 * Runs a store's audit again once its chosen interval has elapsed.
 *
 * THE SETTING ALREADY EXISTED. `stores.auto_analysis` and `stores.analysis_frequency` have been
 * columns since the schema was written, Settings → Analysis has offered the toggle and the
 * frequency dropdown the whole time, and the API has persisted both. Nothing anywhere read them:
 * there was no scheduler, no cron and no interval in the process, so the switch did nothing in
 * either position and "Weekly" described an analysis that never happened. This is what makes it a
 * setting rather than decoration.
 *
 * DUE-NESS IS DERIVED, NOT TRACKED. There is no "last auto-run" column and none is needed — the
 * newest `audits.runAt` for the store IS when it was last analysed, whoever triggered it. So a
 * merchant who presses Refresh on Monday does not also get an automatic run on Tuesday; the clock
 * restarts from the real analysis, not from a separate schedule ticking alongside it.
 *
 * IT REUSES createAuditJob RATHER THAN RUNNING AUDITS ITSELF. That one function already refuses a
 * store with no live Shopify connection, already refuses a second concurrent run, and is already
 * backed by a partial unique index that makes "at most one active job per store" atomic. A
 * scheduler with its own copy of those rules would be a second place for them to drift — and the
 * index means that even two schedulers (a future cluster deployment) cannot double-run a store.
 * Its `userId` argument is the tenancy seam, so the store's own owner is passed: the scheduler
 * gets exactly the access that merchant has, and no more.
 */

/**
 * Settings offers exactly these four, and `updateStoreSchema` enum-validates writes to them.
 * Exported so a test can fail the build if the two lists ever drift — a frequency the API accepts
 * but this map does not know would silently never run.
 */
export const FREQUENCY_DAYS: Record<string, number> = {
  Daily: 1,
  Weekly: 7,
  Fortnightly: 14,
  Monthly: 30,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a store is due for another analysis.
 *
 * `lastRunAt` is the newest REAL audit of the store, whoever started it — so pressing Refresh by
 * hand postpones the automatic run rather than running alongside it.
 *
 * Pure, and the whole decision this feature rests on, so it is tested directly rather than only
 * through a sweep that needs a database.
 */
export function isAnalysisDue(lastRunAt: Date | null, frequency: string, now: Date): boolean {
  const intervalDays = FREQUENCY_DAYS[frequency];
  // An unrecognised frequency is not a reason to invent an interval and analyse on a guess.
  if (!intervalDays) return false;
  // A connected store that has never been analysed is due now: that first audit is the point of
  // connecting, and there is no previous run to count from.
  if (!lastRunAt) return true;
  return now.getTime() - lastRunAt.getTime() >= intervalDays * DAY_MS;
}

export interface AutoAnalysisSweep {
  /** Stores with auto-analysis switched on. */
  considered: number;
  /** Runs actually queued this sweep. */
  started: number;
  /** Due, but skipped — no connection, a run already in flight, or the per-sweep cap. */
  skipped: number;
}

/**
 * Queues a run for every store whose interval has elapsed.
 *
 * NEVER THROWS. It is called from a timer with no caller to return an error to, and one store's
 * problem must not stop the rest of the sweep or kill the interval.
 */
export async function runDueAutoAnalyses(now: Date = new Date()): Promise<AutoAnalysisSweep> {
  const sweep: AutoAnalysisSweep = { considered: 0, started: 0, skipped: 0 };

  let candidates: Array<typeof stores.$inferSelect>;
  try {
    candidates = await db.select().from(stores).where(eq(stores.autoAnalysis, true));
  } catch (error) {
    console.warn(`[scorelo-auto] could not read stores: ${error instanceof Error ? error.message : 'unknown error'}`);
    return sweep;
  }

  sweep.considered = candidates.length;

  for (const store of candidates) {
    try {
      if (!FREQUENCY_DAYS[store.analysisFrequency]) {
        console.warn(`[scorelo-auto] store ${store.id} has an unknown analysis frequency "${store.analysisFrequency}" — skipped`);
        sweep.skipped += 1;
        continue;
      }

      // Checked before reading audits: a disconnected store can never produce one, and asking
      // would only queue a job the worker is guaranteed to fail.
      if (!(await hasStoreDataSource(store.id))) {
        sweep.skipped += 1;
        continue;
      }

      // 'engine' only. A seeded development fixture is not an analysis of this store, and letting
      // one count would hold off the real audit the merchant is waiting for.
      const [latest] = await db
        .select({ runAt: audits.runAt })
        .from(audits)
        .where(and(eq(audits.storeId, store.id), eq(audits.source, 'engine')))
        .orderBy(desc(audits.runAt))
        .limit(1);

      if (!isAnalysisDue(latest?.runAt ?? null, store.analysisFrequency, now)) continue;

      // Counted only against stores that are actually DUE, so the cap throttles real work rather
      // than being spent on stores that needed nothing. Whatever it defers stays due and is
      // picked up by the next sweep.
      if (sweep.started >= env.autoAnalysisMaxPerSweep) {
        sweep.skipped += 1;
        continue;
      }

      await createAuditJob(store.ownerId, store.id);
      sweep.started += 1;
      console.log(
        `[scorelo-auto] queued ${store.analysisFrequency.toLowerCase()} re-analysis for store ${store.id} `
        + `(last analysed ${latest ? latest.runAt.toISOString() : 'never'})`,
      );
    } catch (error) {
      // AUDIT_RUN_IN_PROGRESS is the expected case when a merchant pressed Refresh moments ago,
      // or a previous sweep's run is still going. Not a fault, and not worth a warning.
      if (error instanceof ApiError && error.code === 'AUDIT_RUN_IN_PROGRESS') {
        sweep.skipped += 1;
        continue;
      }
      sweep.skipped += 1;
      console.warn(`[scorelo-auto] store ${store.id} skipped: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  return sweep;
}

let timer: NodeJS.Timeout | null = null;

/**
 * Starts the sweep timer. Safe to call once at boot; calling it twice is a no-op.
 *
 * The first sweep is deliberately delayed rather than run at startup. A deploy restarts the
 * process, and a restart is not a reason to analyse every store — without the delay, redeploying
 * three times in an afternoon would trigger three rounds of audits.
 */
export function startAutoAnalysisScheduler(): void {
  if (!env.autoAnalysisEnabled) {
    console.log('[scorelo-auto] scheduled re-analysis is disabled (AUTO_ANALYSIS_ENABLED=false)');
    return;
  }
  if (timer) return;

  const sweep = () => {
    void runDueAutoAnalyses()
      .then((result) => {
        // Logged only when it did something. A quiet scheduler should be quiet in the logs.
        if (result.started > 0) {
          console.log(`[scorelo-auto] sweep queued ${result.started} run(s) across ${result.considered} store(s)`);
        }
      })
      .catch((error) => console.warn(`[scorelo-auto] sweep failed: ${error instanceof Error ? error.message : 'unknown error'}`));
  };

  setTimeout(sweep, env.autoAnalysisStartDelayMs);
  timer = setInterval(sweep, env.autoAnalysisIntervalMs);
  // Never hold the process open for a timer. Without this a shutdown waits on the next sweep.
  timer.unref();

  console.log(
    `[scorelo-auto] scheduled re-analysis active — sweeping every ${Math.round(env.autoAnalysisIntervalMs / 60_000)} min, `
    + `max ${env.autoAnalysisMaxPerSweep} run(s) per sweep`,
  );
}
