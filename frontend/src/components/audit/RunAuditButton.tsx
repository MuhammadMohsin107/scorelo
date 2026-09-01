import { Link } from 'react-router-dom';
import { AlertCircle, Loader2, PlugZap, Radar } from 'lucide-react';
import { useAuditRun } from '../../data/useAuditRun';

interface Props {
  /** Called once a run finishes successfully so the host page can reload its own data. */
  onComplete: () => void;
  label?: string;
}

/**
 * Starts a REAL audit run and waits for it, reusing the same repository calls the dashboard's
 * first-run state uses (startAuditRun -> waitForAuditRun). It exists so a sub-pillar page can
 * offer "Run an audit" that actually runs one.
 *
 * Previously these pages rendered `<Link to="/">Run an audit</Link>` — a button that only
 * navigated to the dashboard while claiming to run an audit. Replacing the link with a button
 * alone would have been worse (a dead control), which is why this is wired to the job API.
 *
 * Duplicate runs are the BACKEND's decision, not this component's guess: it refuses a second
 * concurrent run with `AUDIT_RUN_IN_PROGRESS`, which is surfaced here as a plain message. The
 * button is also disabled while a run is in flight, so the common case never reaches that error.
 */
export default function RunAuditButton({ onComplete, label = 'Run an audit' }: Props) {
  const { state, progress, error, run } = useAuditRun();

  if (state === 'error' && error) {
    return (
      <div className="mt-6 flex flex-col items-center gap-3">
        <p className="flex items-center gap-1.5 text-sm text-critical-700">
          <AlertCircle size={15} />
          {error.message}
        </p>
        {error.needsConnection ? (
          <Link to="/integrations" className="btn-primary">
            <PlugZap size={15} />
            Connect your store
          </Link>
        ) : (
          <button onClick={() => void run(onComplete)} className="btn-primary">
            <Radar size={15} />
            Try again
          </button>
        )}
      </div>
    );
  }

  return (
    <button onClick={() => void run(onComplete)} disabled={state === 'running'} className="btn-primary mt-6 disabled:opacity-70">
      {state === 'running' ? (
        <>
          <Loader2 size={15} className="animate-spin" />
          Analyzing your store… {progress}%
        </>
      ) : (
        <>
          <Radar size={15} />
          {label}
        </>
      )}
    </button>
  );
}
