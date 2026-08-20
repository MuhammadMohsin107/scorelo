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

export default function SeoOpportunityList({ opportunities, onSelect }: Props) {
  return (
    <div className="bg-white border border-surface-200 rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-surface-200">
        <h2 className="text-lg font-bold text-surface-900">Optimization Opportunities</h2>
      </div>
      <div className="divide-y divide-surface-100">
        {opportunities.map((opp) => (
          <div key={opp.id} className="px-6 py-6 hover:bg-surface-50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-surface-900 mb-2">{opp.title}</h3>
                <p className="text-sm text-surface-600 mb-3">{opp.description}</p>
                <div className="flex flex-wrap gap-4 text-xs text-surface-500">
                  <span>Impact: <span className="font-medium text-surface-700">{opp.impact}</span></span>
                  <span>Effort: <span className="font-medium text-surface-700">{opp.effort}</span></span>
                </div>
              </div>
              <button
                onClick={() => onSelect?.(opp)}
                className="px-4 py-2 border border-surface-200 text-surface-700 hover:bg-surface-50 rounded-lg font-medium text-sm flex-shrink-0"
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
