export interface Opportunity {
  id: string;
  title: string;
  description: string;
  impact: 'High' | 'Medium' | 'Low';
  effort: 'High' | 'Medium' | 'Low';
  ctaLabel: string;
}

interface Props {
  opportunities: Opportunity[];
  onSelect?: (opportunity: Opportunity) => void;
}

/** Shared "Optimization Opportunities" list used at the bottom of every pillar sub-page. */
export default function PillarOpportunityList({ opportunities, onSelect }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)]">
      <div className="border-b border-surface-200 px-5 py-5 sm:px-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-600">Next best moves</div>
        <h2 className="mt-1 text-lg font-bold tracking-tight text-surface-900">Optimization Opportunities</h2>
      </div>
      <div className="divide-y divide-surface-100">
        {opportunities.map((opp) => (
          <div key={opp.id} className="px-5 py-5 transition-colors hover:bg-surface-50 sm:px-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
              <div>
                <h3 className="mb-2 font-bold text-surface-900">{opp.title}</h3>
                <p className="mb-3 max-w-3xl text-sm leading-6 text-surface-600">{opp.description}</p>
                <div className="flex flex-wrap gap-2 text-xs text-surface-500">
                  <span className="rounded-md bg-success-50 px-2 py-1">Impact: <span className="font-bold text-success-700">{opp.impact}</span></span>
                  <span className="rounded-md bg-surface-100 px-2 py-1">Effort: <span className="font-bold text-surface-700">{opp.effort}</span></span>
                </div>
              </div>
              <button
                onClick={() => onSelect?.(opp)}
                className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-surface-200 px-4 py-2 text-sm font-bold text-surface-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
              >
                {opp.ctaLabel}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
