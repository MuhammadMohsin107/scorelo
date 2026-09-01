import { useState } from 'react';
import { ApiError } from '../lib/api';
import { startAuditRun, waitForAuditRun } from './audits.repository';

/**
 * Starts a REAL audit run and waits for it to finish.
 *
 * Extracted so every control that claims to (re)analyse the store shares one implementation:
 * the sub-pillar "Run an audit" button and the "Refresh" button on all five pillar dashboards.
 * Before this, Refresh only re-fetched the audit that was already stored — it re-read the same
 * rows and rendered the same numbers, which is why clicking it appeared to do nothing.
 *
 * Duplicate runs are the BACKEND's decision, not a guess made here: it refuses a second
 * concurrent run with `AUDIT_RUN_IN_PROGRESS`. `running` also disables the caller's control, so
 * the common case never reaches that error.
 */

export type AuditRunState = 'idle' | 'running' | 'error';

export interface AuditRunError {
  message: string;
  /** True when the store has no live Shopify connection — the caller should link to /integrations. */
  needsConnection: boolean;
}

export interface UseAuditRun {
  state: AuditRunState;
  running: boolean;
  /** 0-100, from the job's own progress field. */
  progress: number;
  error: AuditRunError | null;
  /** Runs an audit and awaits it. `onComplete` fires only on success. */
  run: (onComplete?: () => void | Promise<void>) => Promise<void>;
  reset: () => void;
}

export function useAuditRun(): UseAuditRun {
  const [state, setState] = useState<AuditRunState>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<AuditRunError | null>(null);

  const run = async (onComplete?: () => void | Promise<void>) => {
    setState('running');
    setProgress(0);
    setError(null);
    try {
      const job = await startAuditRun();
      const finished = await waitForAuditRun(job.id, (update) => setProgress(update.progress));
      if (finished.status === 'failed') {
        setState('error');
        // The job's own error is written by the runner and is already merchant-safe.
        setError({ message: finished.error ?? 'The audit run failed. Please try again.', needsConnection: false });
        return;
      }
      setState('idle');
      await onComplete?.();
    } catch (err) {
      setState('error');
      setError({
        message: err instanceof ApiError ? err.message : 'Could not start the audit run. Please try again.',
        needsConnection: err instanceof ApiError && err.code === 'STORE_NOT_CONNECTED',
      });
    }
  };

  return {
    state,
    running: state === 'running',
    progress,
    error,
    run,
    reset: () => { setState('idle'); setError(null); },
  };
}
