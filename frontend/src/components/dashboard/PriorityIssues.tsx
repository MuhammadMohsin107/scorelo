import { useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, Info, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { PriorityIssue, Severity } from '../../data/dashboard/dashboard.mock';
import { cardClass, pillarRoutes } from './scoreTone';

interface Props {
  issues: PriorityIssue[];
}

type Filter = 'all' | Severity;

const severityOrder: Severity[] = ['critical', 'high', 'medium', 'low'];

const severityConfig: Record<Severity, { label: string; icon: React.ReactNode; tile: string; dot: string }> = {
  critical: { label: 'Critical', icon: <AlertCircle size={15} />, tile: 'bg-critical-50 text-critical-700', dot: 'bg-critical-500' },
  high: { label: 'High', icon: <AlertTriangle size={15} />, tile: 'bg-warning-50 text-warning-700', dot: 'bg-warning-500' },
  medium: { label: 'Medium', icon: <Target size={15} />, tile: 'bg-brand-50 text-brand-700', dot: 'bg-brand-500' },
  low: { label: 'Low', icon: <Info size={15} />, tile: 'bg-surface-100 text-surface-600', dot: 'bg-surface-400' },
};

/**
 * Open issues across every pillar, most severe first, with a severity
 * filter so the list can be narrowed without leaving the dashboard.
 */
export default function PriorityIssues({ issues }: Props) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(
    () => issues.reduce<Record<Severity, number>>((acc, issue) => ({ ...acc, [issue.severity]: acc[issue.severity] + 1 }), { critical: 0, high: 0, medium: 0, low: 0 }),
    [issues],
  );

  const visible = useMemo(() => {
    const sorted = [...issues].sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity));
    return filter === 'all' ? sorted : sorted.filter((issue) => issue.severity === filter);
  }, [issues, filter]);

  const chips: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: issues.length },
    ...severityOrder.map((s) => ({ key: s as Filter, label: severityConfig[s].label, count: counts[s] })),
  ];

  return (
    <section className={`${cardClass} flex h-full flex-col`} aria-labelledby="priority-issues-title">
      <div className="border-b border-surface-100 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-surface-500">Issues</p>
            <h2 id="priority-issues-title" className="mt-1 text-lg font-semibold tracking-tight text-surface-950">Priority issues</h2>
          </div>
          <span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-surface-700">{issues.length} open</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter issues by severity">
          {chips.map((chip) => {
            const isActive = filter === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setFilter(chip.key)}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ${
                  isActive
                    ? 'bg-surface-900 text-white'
                    : 'border border-surface-200 bg-white text-surface-600 hover:border-surface-300 hover:bg-surface-50'
                }`}
              >
                {chip.key !== 'all' && <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-white/80' : severityConfig[chip.key as Severity].dot}`} aria-hidden="true" />}
                {chip.label}
                <span className={`tabular-nums ${isActive ? 'text-white/70' : 'text-surface-400'}`}>{chip.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 divide-y divide-surface-100">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-5 py-12 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success-50 text-success-700">
              <CheckCircle2 size={20} />
            </span>
            <p className="text-sm font-semibold text-surface-900">No {filter} issues</p>
            <p className="text-xs text-surface-500">Nothing in this severity right now.</p>
          </div>
        ) : (
          visible.map((issue) => {
            const config = severityConfig[issue.severity];
            return (
              <div key={issue.id} className="group flex items-center gap-3 px-5 py-3.5 transition-colors duration-150 hover:bg-surface-50">
                <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${config.tile}`} aria-label={config.label} title={config.label}>
                  {config.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-surface-900">{issue.title}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-surface-500">
                    <span className="rounded bg-surface-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-surface-600">{issue.pillarLabel}</span>
                    <span className="truncate">{issue.description}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(pillarRoutes[issue.pillar] ?? '/')}
                  className="inline-flex flex-shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50 hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  aria-label={`${issue.actionLabel}: ${issue.title}`}
                >
                  {issue.actionLabel}
                  <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
