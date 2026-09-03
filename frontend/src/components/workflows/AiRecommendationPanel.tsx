import { useEffect, useState } from 'react';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { fetchAiRecommendation, fetchAiStatus, type AiRecommendation } from '../../data/findings.repository';

interface Props {
  /** The finding's id as rendered by the UI. Only a numeric id is a real database row. */
  findingId: string;
}

/**
 * Optional AI enhancement for a single finding, rendered beneath the deterministic
 * recommendation that the drawer already shows.
 *
 * The deterministic text is the source of truth and is never replaced or hidden — AI output sits
 * below it as clearly-labelled advisory copy. Generation is user-triggered (one click, one call;
 * the backend caches the result on the finding), never fired on render, so opening a drawer
 * repeatedly costs nothing.
 *
 * The component renders NOTHING at all unless the server reports a model is configured and this
 * finding is a real database row, so the action is never offered where it is guaranteed to fail.
 */
export default function AiRecommendationPanel({ findingId }: Props) {
  // Catalog-derived findings carry slug ids ('ai-issue-1') and have no row to enhance.
  const isPersisted = /^\d+$/.test(findingId);

  const [available, setAvailable] = useState(false);
  const [ai, setAi] = useState<AiRecommendation | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isPersisted) return;
    let active = true;
    // Clear when the drawer switches to a different finding.
    setAi(null);
    setMessage(null);
    fetchAiStatus()
      .then((status) => { if (active) setAvailable(status.enabled); })
      .catch(() => { if (active) setAvailable(false); });
    return () => { active = false; };
  }, [findingId, isPersisted]);

  if (!isPersisted || (!available && !ai)) return null;

  const generate = async (force: boolean) => {
    setPending(true);
    setMessage(null);
    try {
      const result = await fetchAiRecommendation(findingId, force);
      if (result.enhanced && result.ai) {
        setAi(result.ai);
        setModel(result.model);
      } else {
        // Never surface a provider error verbatim — the deterministic advice above still stands.
        setMessage('AI enhancement is unavailable right now. The recommendation above still applies.');
      }
    } catch {
      setMessage('AI enhancement is unavailable right now. The recommendation above still applies.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-4 border-t border-brand-100 pt-3">
      {ai && (
        <div className="rounded-lg border border-brand-200 bg-surface-0/70 p-3">
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
            <Sparkles size={12} aria-hidden="true" />
            AI-enhanced recommendation
            <span className="ml-auto font-medium normal-case tracking-normal text-surface-500">
              {ai.confidence} confidence{model ? ` · ${model}` : ''}
            </span>
          </p>
          <p className="mt-2 text-sm leading-6 text-surface-700">{ai.recommendation}</p>
          <p className="mt-2 text-xs leading-5 text-surface-600">
            <span className="font-semibold">Why it matters: </span>{ai.whyItMatters}
          </p>
          <p className="mt-1.5 text-xs leading-5 text-surface-600">
            <span className="font-semibold">Next step: </span>{ai.suggestedAction}
          </p>
          <p className="mt-2.5 text-[11px] text-surface-400">
            Advisory only — Scorelo has not changed anything on your store.
          </p>
        </div>
      )}

      {message && <p className="text-xs text-surface-500">{message}</p>}

      {available && (
        <button
          type="button"
          onClick={() => void generate(ai !== null)}
          disabled={pending}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-surface-0 px-3 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:border-brand-300 hover:text-brand-800 disabled:opacity-60"
        >
          {pending
            ? <Loader2 size={13} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            : ai
              ? <RefreshCw size={13} aria-hidden="true" />
              : <Sparkles size={13} aria-hidden="true" />}
          {pending ? 'Generating…' : ai ? 'Regenerate' : 'Improve with AI'}
        </button>
      )}
    </div>
  );
}
