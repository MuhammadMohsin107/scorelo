import { useEffect, useRef } from 'react';
import { ArrowRight, Lightbulb, X } from 'lucide-react';
import { investigationEvidence, type EvidenceRow, type SubPillarFinding } from '../../../data/seo/subpillar.model';
import AiRecommendationPanel from '../../workflows/AiRecommendationPanel';
import SeverityBadge from './SeverityBadge';
import { eyebrow, toneStyles } from './tone';

interface Props {
  finding: SubPillarFinding | null;
  evidence: EvidenceRow[];
  /**
   * The items the user opened this drawer for — the row whose Investigate button was pressed, or
   * every ticked row when the pressed row was part of a tick selection. Empty when the drawer was
   * opened from the findings list, where an issue was chosen but no item.
   */
  selectedRows?: EvidenceRow[];
  onClose: () => void;
  /** Filter the evidence table to this issue and close the drawer. */
  onReviewAffected: (finding: SubPillarFinding) => void;
}

const EVIDENCE_PREVIEW = 4;

/**
 * Investigation panel. Opens beside the findings list so the user can
 * read the evidence without losing their place on the page.
 *
 * WHICH ROWS THIS SHOWS. When the user selected items, exactly those items — investigating an
 * item is a question about that item, and padding the list with other examples reads as though
 * the selection was ignored. Only when nothing was selected (opened from the findings list) does
 * a sample stand in, preferring the rows the check itself attributed to the finding over the
 * sub-pillar sample, which is shared between findings of the same issue type.
 */
export default function InvestigationDrawer({ finding, evidence, selectedRows = [], onClose, onReviewAffected }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isOpen = finding !== null;

  // Escape to close, focus the panel on open, lock background scroll.
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!finding) return null;

  const isSelection = selectedRows.length > 0;
  const preview = investigationEvidence(finding, evidence, selectedRows, EVIDENCE_PREVIEW);
  // "and N more" belongs to a sample, not to a selection — the user is looking at everything they
  // picked, so telling them items are hidden would be wrong.
  const notShown = isSelection ? 0 : finding.affected - preview.length;
  const tone = toneStyles[finding.severity];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <div className="absolute inset-0 bg-surface-950/25 motion-safe:animate-fade-in" onClick={onClose} aria-hidden="true" />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sp-drawer-title"
        className="relative flex h-full w-full max-w-lg flex-col bg-surface-0 shadow-2xl motion-safe:animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-surface-200 px-6 py-5">
          <div className="min-w-0">
            <p className={eyebrow}>Issue detail</p>
            <h2 id="sp-drawer-title" className="mt-1.5 text-lg font-semibold tracking-tight text-surface-950">
              {finding.title}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <SeverityBadge severity={finding.severity} />
              <span className="text-xs text-surface-500">
                <span className="font-semibold tabular-nums text-surface-800">{finding.affected.toLocaleString()}</span>{' '}
                affected
              </span>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg text-surface-500 transition-colors hover:bg-surface-100 hover:text-surface-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Close issue detail"
          >
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-surface-500">What is wrong</h3>
            <p className="mt-2 text-sm leading-6 text-surface-700">{finding.whatIsWrong}</p>
          </section>

          <section className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-surface-500">Why it matters</h3>
            <p className="mt-2 text-sm leading-6 text-surface-700">{finding.whyItMatters}</p>
          </section>

          <section className="mt-5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-surface-500">
                {isSelection ? (preview.length === 1 ? 'Selected item' : 'Selected items') : 'Evidence'}
              </h3>
              <span className="text-[11px] text-surface-400">
                {isSelection
                  ? `${preview.length} of ${finding.affected.toLocaleString()} affected`
                  : `${preview.length} of ${finding.affected.toLocaleString()}`}
              </span>
            </div>

            {preview.length === 0 ? (
              <p className="mt-2 rounded-lg bg-surface-50 px-3 py-3 text-xs text-surface-500">
                No sampled items for this issue in the current crawl extract.
              </p>
            ) : (
              <ul className="mt-2 space-y-2.5">
                {preview.map((row) => (
                  <li
                    key={row.id}
                    className={`rounded-xl border p-3 ${isSelection ? 'border-brand-300 bg-brand-50/60 ring-1 ring-brand-200' : 'border-surface-200 bg-surface-50/60'}`}
                  >
                    {row.current?.meta && (
                      <p className="truncate font-mono text-[11px] text-surface-600">{row.current.meta}</p>
                    )}

                    <div className="mt-2 space-y-1.5">
                      {row.current && (
                        <div className="flex items-start gap-2">
                          <span className={`mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-surface-400">
                              {row.current.label}
                            </p>
                            <p className={`text-xs ${row.current.value ? 'text-surface-800' : 'italic text-surface-400'}`}>
                              {row.current.value || 'not present'}
                            </p>
                            {row.note && <p className="mt-0.5 text-[11px] text-surface-500">{row.note}</p>}
                          </div>
                        </div>
                      )}

                      {row.suggested && (
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-success-500" aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-surface-400">
                              {row.suggested.label}
                            </p>
                            <p className="text-xs text-surface-800">{row.suggested.value}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {notShown > 0 && (
              <p className="mt-2 text-[11px] text-surface-500">
                and {notShown.toLocaleString()} more in the full crawl.
              </p>
            )}
          </section>

          <section className="mt-5 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
            <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-700">
              <Lightbulb size={13} aria-hidden="true" />
              Scorelo recommendation
            </h3>
            <p className="mt-2 text-sm leading-6 text-surface-700">{finding.recommendation}</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-surface-600">
              <span>
                Impact <span className="font-semibold text-surface-800">{finding.impact}</span>
              </span>
              <span>
                Effort <span className="font-semibold text-surface-800">{finding.effort}</span>
              </span>
            </div>
            <AiRecommendationPanel findingId={finding.id} />
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-surface-200 px-6 py-4">
          <button
            type="button"
            onClick={() => onReviewAffected(finding)}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            Review affected items
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
