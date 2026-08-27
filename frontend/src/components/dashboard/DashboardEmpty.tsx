import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Globe, Loader2, PlugZap, Radar } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { startAuditRun, waitForAuditRun } from '../../data/audits.repository';

interface Props {
  /** Called once an audit run finishes successfully, so the dashboard can reload. */
  onAuditComplete: () => void;
}

type RunState = 'idle' | 'running' | 'error';

/**
 * Shown when the store has no audits yet — a first-run state, not a failure. The backend is
 * the only authority on whether a run is possible, so this offers the run and translates the
 * refusal (`STORE_NOT_CONNECTED`) into a connect prompt rather than pre-guessing the answer.
 */
export default function DashboardEmpty({ onAuditComplete }: Props) {
  const [state, setState] = useState<RunState>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<{ message: string; needsConnection: boolean } | null>(null);

  const runAudit = async () => {
    setState('running');
    setProgress(0);
    setError(null);
    try {
      const job = await startAuditRun();
      const finished = await waitForAuditRun(job.id, (update) => setProgress(update.progress));
      if (finished.status === 'failed') {
        setState('error');
        setError({ message: finished.error ?? 'The audit run failed. Please try again.', needsConnection: false });
        return;
      }
      onAuditComplete();
    } catch (err) {
      setState('error');
      setError({
        message: err instanceof ApiError ? err.message : 'Could not start the audit run. Please try again.',
        needsConnection: err instanceof ApiError && err.code === 'STORE_NOT_CONNECTED',
      });
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] p-5 pb-16 md:p-8">
      <div className="card flex min-h-[420px] flex-col items-center justify-center p-8 text-center md:p-12">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
          {state === 'running' ? (
            <Loader2 size={28} className="animate-spin text-brand-600" />
          ) : (
            <Radar size={28} className="text-brand-600" />
          )}
        </div>

        <h2 className="mb-2 text-lg font-semibold text-surface-900">
          {state === 'running' ? 'Analyzing your store' : 'No audits yet'}
        </h2>
        <p className="mb-6 max-w-md text-sm text-surface-500">
          {state === 'running'
            ? 'This takes a couple of minutes. Your dashboard opens as soon as the first audit finishes.'
            : 'Run your first audit to score your store across all pillars and see what to fix first.'}
        </p>

        {state === 'running' && (
          <div className="mb-6 w-full max-w-xs">
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-100">
              <div
                className="h-full rounded-full bg-brand-500 transition-[width] duration-500"
                style={{ width: `${Math.max(progress, 4)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-surface-400">{progress}% complete</p>
          </div>
        )}

        {error && (
          <div className="mb-6 flex max-w-md items-start gap-2.5 rounded-xl border border-critical-200 bg-critical-50 p-3.5 text-left">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-critical-500" />
            <div>
              <p className="text-sm text-critical-700">{error.message}</p>
              {error.needsConnection && (
                <Link
                  to="/integrations"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-critical-700 underline underline-offset-2"
                >
                  <PlugZap size={14} />
                  Connect your store
                </Link>
              )}
            </div>
          </div>
        )}

        {state !== 'running' && (
          <button onClick={runAudit} className="btn-primary">
            <Radar size={16} />
            {state === 'error' ? 'Try again' : 'Run your first audit'}
          </button>
        )}

        <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-surface-400">
          <Globe size={12} />
          An audit reads your store through its connected data source — nothing is changed.
        </p>
      </div>
    </div>
  );
}
