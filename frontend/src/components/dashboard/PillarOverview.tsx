import { ArrowUpRight, FileText, Search, Sparkles, Target, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { PillarScore } from '../../data/dashboard/dashboard.mock';
import { SCORE_TARGET, cardClass, pillarRoutes, statusTone } from './scoreTone';

interface Props {
  pillars: PillarScore[];
}

const iconMap: Record<string, React.ReactNode> = {
  search: <Search size={16} strokeWidth={2} />,
  'file-text': <FileText size={16} strokeWidth={2} />,
  zap: <Zap size={16} strokeWidth={2} />,
  target: <Target size={16} strokeWidth={2} />,
  sparkles: <Sparkles size={16} strokeWidth={2} />,
};

/**
 * Side-by-side pillar comparison. Each card is a compact bullet chart:
 * score, status, a filled bar against the "Excellent" target marker,
 * and the checks passed. Click through to the pillar dashboard.
 */
export default function PillarOverview({ pillars }: Props) {
  const navigate = useNavigate();

  return (
    <section aria-labelledby="pillar-performance-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-surface-500">Pillars</p>
          <h2 id="pillar-performance-title" className="mt-1 text-lg font-semibold tracking-tight text-surface-950">Performance by pillar</h2>
        </div>
        <span className="inline-flex items-center gap-2 text-xs text-surface-500">
          <span className="inline-block h-3 w-0.5 rounded-full bg-surface-900" aria-hidden="true" />
          Target {SCORE_TARGET} · Excellent
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {pillars.map((pillar) => {
          const tone = statusTone[pillar.status];
          const gap = SCORE_TARGET - pillar.score;
          return (
            <button
              key={pillar.key}
              type="button"
              onClick={() => navigate(pillarRoutes[pillar.key] ?? '/')}
              className={`${cardClass} group flex cursor-pointer flex-col p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
              aria-label={`Open ${pillar.label}, score ${pillar.score} out of 100, ${pillar.statusLabel}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-surface-100 text-surface-600 transition-colors group-hover:bg-brand-50 group-hover:text-brand-700">
                    {iconMap[pillar.icon] ?? <Target size={16} />}
                  </span>
                  <span className="truncate text-sm font-semibold text-surface-900">{pillar.label}</span>
                </span>
                <ArrowUpRight size={15} className="flex-shrink-0 text-surface-300 transition-colors group-hover:text-brand-600" aria-hidden="true" />
              </div>

              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="text-[30px] font-semibold leading-none tracking-tight text-surface-950 tabular-nums">{pillar.score}</span>
                <span className="text-xs font-medium text-surface-400">/100</span>
                <span className={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.badge}`}>
                  {pillar.statusLabel}
                </span>
              </div>

              {/* Bullet bar with target marker */}
              <div className="relative mt-3 h-2 w-full overflow-visible rounded-full bg-surface-100" aria-hidden="true">
                <div className={`h-full rounded-full ${tone.bar} transition-[width] duration-700 ease-out motion-reduce:transition-none`} style={{ width: `${pillar.score}%` }} />
                <span className="absolute -top-1 h-4 w-0.5 rounded-full bg-surface-900" style={{ left: `calc(${SCORE_TARGET}% - 1px)` }} />
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-surface-500">
                <span className="tabular-nums">
                  <span className="font-semibold text-surface-800">{pillar.checksPassed}</span>/{pillar.checksTotal} checks
                </span>
                <span className={gap > 0 ? 'tabular-nums' : 'font-medium text-success-700'}>
                  {gap > 0 ? `${gap} to target` : 'On target'}
                </span>
              </div>

              <p className="mt-2 line-clamp-2 text-xs leading-5 text-surface-500">{pillar.description}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
