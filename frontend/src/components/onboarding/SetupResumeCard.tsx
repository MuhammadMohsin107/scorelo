import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ListChecks } from 'lucide-react';
import { Button } from '../workflows/WorkflowPrimitives';
import {
  STEP_META,
  TOTAL_STEPS,
  fetchOnboarding,
  reopenOnboarding,
  type OnboardingSnapshot,
} from '../../data/onboarding.repository';

/**
 * Shown on the dashboard when guided setup exists but is not finished.
 *
 * This is where a merchant who chose "Finish later" gets setup back. It states exactly what is
 * still outstanding — by name, not as a percentage — because "2 of 5 steps" does not tell anyone
 * whether the missing one matters, and "Keywords" does.
 *
 * Renders nothing at all when there is no connected store, when setup is complete, or when the
 * check fails. A card that cannot say something true stays off the page.
 */
export default function SetupResumeCard() {
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<OnboardingSnapshot | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const state = await fetchOnboarding();
        if (!cancelled) setSnapshot(state);
      } catch {
        // Silent: a resume prompt is an aid, and failing to load one is not worth an error on a
        // merchant's dashboard.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!snapshot || !snapshot.connected || snapshot.completedAt) return null;

  const outstanding = snapshot.progress.filter((entry) => entry.status !== 'complete');
  if (outstanding.length === 0) return null;

  const done = TOTAL_STEPS - outstanding.length;
  const outstandingNames = outstanding
    .map((entry) => STEP_META[entry.step - 1]?.title)
    .filter((title): title is string => Boolean(title));

  const resume = async () => {
    setOpening(true);
    try {
      // Clears the deferral server-side, so returning here is a deliberate re-entry rather than
      // a redirect loop with the gate.
      await reopenOnboarding();
    } catch {
      // Navigating anyway is correct: the setup page re-reads state on mount and will show
      // whatever is actually true.
    }
    navigate('/onboarding');
  };

  return (
    <section className="rounded-lg border border-brand-200 bg-brand-50/50 px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
            <ListChecks size={16} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[12.5px] font-bold tracking-tight text-surface-950">
              Finish setting up Scorelo
            </h2>
            <p className="mt-0.5 max-w-xl text-[11.5px] leading-[1.45] text-surface-600">
              {done > 0
                ? `${done} of ${TOTAL_STEPS} steps done. Still to go: ${outstandingNames.join(', ')}.`
                : `Five short steps — ${outstandingNames.join(', ')} — so your audit is judged against your real business, not a generic store.`}
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {snapshot.progress.map((entry) => {
                const title = STEP_META[entry.step - 1]?.title ?? `Step ${entry.step}`;
                return (
                  <li
                    key={entry.step}
                    className={`flex items-center gap-1 text-[11px] font-medium ${
                      entry.status === 'complete' ? 'text-success-700' : 'text-surface-500'
                    }`}
                  >
                    {entry.status === 'complete' ? (
                      <Check size={11} strokeWidth={3} aria-hidden="true" />
                    ) : (
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 rounded-full ${
                          entry.status === 'skipped' ? 'bg-warning-500' : 'bg-surface-300'
                        }`}
                      />
                    )}
                    {title}
                    {entry.status === 'skipped' && <span className="text-surface-400">(skipped)</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <Button onClick={() => void resume()} disabled={opening}>
            {opening ? 'Opening…' : done > 0 ? 'Resume setup' : 'Start setup'}
            <ArrowRight size={13} className="ml-1 inline align-[-1px]" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </section>
  );
}
