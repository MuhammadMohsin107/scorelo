import { ArrowRight, Clock3, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { RecommendedAction } from '../../data/dashboard/dashboard.mock';
import { cardClass, pillarRoutes } from './scoreTone';

interface Props {
  actions: RecommendedAction[];
}

const impactChip: Record<RecommendedAction['impact'], string> = {
  high: 'bg-success-50 text-success-700',
  medium: 'bg-brand-50 text-brand-700',
  low: 'bg-surface-100 text-surface-600',
};

/** Ranked next steps, each linking into the pillar that owns the fix. */
export default function RecommendedActions({ actions }: Props) {
  const navigate = useNavigate();
  const totalMinutes = actions.reduce((sum, action) => sum + (Number.parseInt(action.estimatedTime, 10) || 0), 0);

  return (
    <section className={`${cardClass} flex h-full flex-col`} aria-labelledby="recommended-actions-title">
      <div className="flex items-end justify-between gap-4 border-b border-surface-100 px-5 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-surface-500">Next steps</p>
          <h2 id="recommended-actions-title" className="mt-1 text-lg font-semibold tracking-tight text-surface-950">Recommended actions</h2>
        </div>
        {totalMinutes > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium tabular-nums text-surface-700">
            <Clock3 size={12} />~{totalMinutes} min total
          </span>
        )}
      </div>

      <div className="flex-1 divide-y divide-surface-100">
        {actions.map((action, index) => (
          <div key={action.id} className="group flex items-start gap-3 px-5 py-4 transition-colors duration-150 hover:bg-surface-50">
            <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-surface-900 text-xs font-semibold tabular-nums text-white">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-surface-900">{action.title}</p>
                <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${impactChip[action.impact]}`}>
                  <Zap size={10} />
                  {action.impact} impact
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-surface-500">{action.description}</p>
              <div className="mt-2 flex items-center gap-3 text-[11px] text-surface-500">
                <span className="rounded bg-surface-100 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-surface-600">{action.pillarLabel}</span>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Clock3 size={12} />
                  {action.estimatedTime}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(pillarRoutes[action.pillar] ?? '/')}
              className="inline-flex flex-shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-surface-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-surface-700 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
              aria-label={`Review ${action.title}`}
            >
              Review
              <ArrowRight size={13} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
