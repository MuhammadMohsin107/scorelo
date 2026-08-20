import type { SubPillarFinding, SubPillarTotals } from '../../../data/seo/subpillar.model';
import { card, cardHeader, cardTitle, eyebrow, toneStyles } from './tone';

interface Props {
  totals: SubPillarTotals;
  findings: SubPillarFinding[];
  /** Filter the evidence table to one issue type. */
  onSelectIssue: (issueType: string) => void;
}

/**
 * What the remaining problem is actually made of, ranked by severity.
 * No decorative chart — the bars are the comparison.
 */
export default function HealthCard({ totals, findings, onSelectIssue }: Props) {
  const open = findings.filter((finding) => finding.affected > 0);
  const maxAffected = Math.max(...open.map((finding) => finding.affected), 1);

  return (
    <section className={`${card} flex h-full flex-col overflow-hidden`} aria-labelledby="sp-health-title">
      <div className={`${cardHeader} px-6 py-4`}>
        <p className={eyebrow}>Breakdown</p>
        <h2 id="sp-health-title" className={`mt-1.5 ${cardTitle}`}>
          Where the issues are
        </h2>
      </div>

      <div className="px-6 py-5">
        {open.length === 0 ? (
          <p className="py-6 text-center text-sm text-surface-500">Nothing flagged in the latest analysis.</p>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-medium text-surface-600">
                What the {totals.issues.toLocaleString()} issues are
              </span>
              <span className="text-[11px] text-surface-400">by severity</span>
            </div>

            <ul className="mt-3 space-y-3">
              {open.map((finding) => {
                const tone = toneStyles[finding.severity];
                const share = (finding.affected / totals.issues) * 100;
                return (
                  <li key={finding.id}>
                    <button
                      type="button"
                      onClick={() => onSelectIssue(finding.issueType)}
                      className="group w-full cursor-pointer rounded-lg px-1 py-1 text-left transition-colors hover:bg-surface-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      aria-label={`Filter evidence to ${finding.issueType}: ${finding.affected} affected`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-surface-700 group-hover:text-surface-900">
                          <span className={`h-2 w-2 flex-shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
                          {finding.issueType}
                        </span>
                        <span className="flex-shrink-0 text-xs tabular-nums text-surface-500">
                          <span className="font-semibold text-surface-900">{finding.affected.toLocaleString()}</span>
                          <span className="ml-1.5 text-surface-400">{share.toFixed(0)}%</span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-100">
                        <div
                          className={`h-full rounded-full ${tone.bar} transition-[width] duration-700 ease-out motion-reduce:transition-none`}
                          style={{ width: `${(finding.affected / maxAffected) * 100}%` }}
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
