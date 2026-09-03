import { ArrowRight, CheckCircle2 } from 'lucide-react';
import type { SubPillarFinding } from '../../../data/seo/subpillar.model';
import SeverityBadge from './SeverityBadge';
import { card, cardHeader, cardTitle, eyebrow, toneStyles } from './tone';

interface Props {
  findings: SubPillarFinding[];
  onInvestigate: (finding: SubPillarFinding) => void;
  /** Sub-pillar-specific empty-state copy. */
  emptyTitle: string;
  emptyBody: string;
}

/**
 * Prioritized findings — severity first, each one stating what it costs
 * and opening the investigation drawer.
 */
export default function FindingsList({ findings, onInvestigate, emptyTitle, emptyBody }: Props) {
  const open = findings.filter((finding) => finding.affected > 0);

  if (open.length === 0) {
    return (
      <section className={`${card} p-8 text-center`} aria-labelledby="sp-findings-title">
        <span className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full ${toneStyles.healthy.tile}`}>
          <CheckCircle2 size={22} strokeWidth={2} aria-hidden="true" />
        </span>
        <h2 id="sp-findings-title" className="mt-3 text-base font-semibold text-surface-900">
          {emptyTitle}
        </h2>
        <p className="mt-1 text-sm text-surface-500">{emptyBody}</p>
      </section>
    );
  }

  return (
    <section className={`${card} overflow-hidden`} aria-labelledby="sp-findings-title">
      <div className={`${cardHeader} flex flex-wrap items-end justify-between gap-3 px-6 py-4`}>
        <div>
          <p className={eyebrow}>Findings</p>
          <h2 id="sp-findings-title" className={`mt-1.5 ${cardTitle}`}>
            What Scorelo found
          </h2>
        </div>
        <span className="rounded-md border border-surface-200 bg-surface-0 px-2 py-1 text-[11px] font-semibold tabular-nums text-surface-600">
          {open.length} issue {open.length === 1 ? 'type' : 'types'}
        </span>
      </div>

      <ul className="divide-y divide-surface-200">
        {open.map((finding) => {
          const tone = toneStyles[finding.severity];
          return (
            <li key={finding.id}>
              <button
                type="button"
                onClick={() => onInvestigate(finding)}
                className="group flex w-full cursor-pointer items-start gap-4 px-6 py-4 text-left transition-colors hover:bg-surface-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
                aria-label={`Investigate ${finding.title}, ${finding.affected} affected`}
              >
                <span className={`mt-1 h-10 w-[3px] flex-shrink-0 rounded-full ${tone.rail}`} aria-hidden="true" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={finding.severity} />
                    <h3 className="text-sm font-semibold text-surface-900">{finding.title}</h3>
                  </div>
                  <p className="mt-1.5 text-sm leading-6 text-surface-600">{finding.whyItMatters}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-surface-500">
                    <span>
                      <span className="font-semibold tabular-nums text-surface-800">{finding.affected.toLocaleString()}</span>{' '}
                      affected
                    </span>
                    <span>
                      Impact <span className="font-semibold text-surface-700">{finding.impact}</span>
                    </span>
                    <span>
                      Effort <span className="font-semibold text-surface-700">{finding.effort}</span>
                    </span>
                  </div>
                </div>

                <span className="mt-1 hidden flex-shrink-0 items-center gap-1 text-xs font-semibold text-brand-700 sm:inline-flex">
                  Investigate
                  <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
