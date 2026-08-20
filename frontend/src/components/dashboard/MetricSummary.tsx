import { ArrowDownRight, ArrowUpRight, CircleAlert, FileCheck2, ListChecks, type LucideIcon } from 'lucide-react';
import type { KeyMetric, OverallScore } from '../../data/dashboard/dashboard.mock';

interface Props {
  metrics: KeyMetric[];
  overallScore: OverallScore;
  layout?: 'row' | 'column';
}

const metricIcon: Record<string, LucideIcon> = {
  issues: ListChecks,
  critical: CircleAlert,
  passed: FileCheck2,
};

const metricTile: Record<string, string> = {
  issues: 'bg-surface-100 text-surface-600',
  critical: 'bg-critical-50 text-critical-700',
  passed: 'bg-success-50 text-success-700',
};

/**
 * Compact KPI strip. Rendered inside the Overall Health hero so the
 * headline score and its supporting numbers read as one unit.
 */
export default function MetricSummary({ metrics, overallScore, layout = 'row' }: Props) {
  const standardMetrics = metrics.filter((metric) => metric.id !== 'overall-health');

  return (
    <div
      className={layout === 'column'
        ? 'grid grid-cols-1 divide-y divide-surface-100'
        : 'grid grid-cols-1 divide-y divide-surface-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0'}
      aria-label={`Supporting metrics for overall score ${overallScore.score}`}
    >
      {standardMetrics.map((metric) => {
        const Icon = metricIcon[metric.id] ?? ListChecks;
        const isPositive = metric.id === 'issues' ? metric.trend === 'down' : metric.trend === 'up';
        const TrendIcon = metric.trend === 'down' ? ArrowDownRight : ArrowUpRight;

        return (
          <div key={metric.id} className={layout === 'column'
            ? 'flex items-center gap-3 py-3 first:pt-0 last:pb-0'
            : 'flex items-center gap-3 py-3 sm:px-5 sm:py-1 first:sm:pl-0 last:sm:pr-0'}>
            <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${metricTile[metric.id] ?? 'bg-surface-100 text-surface-600'}`}>
              <Icon size={16} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-surface-500">{metric.label}</p>
              <div className="mt-0.5 flex items-baseline gap-2">
                <p className="text-xl font-semibold tracking-tight text-surface-950 tabular-nums">
                  {metric.value.toLocaleString()}
                  {metric.suffix && <span className="ml-1 text-xs font-medium text-surface-400">{metric.suffix}</span>}
                </p>
                {metric.trend && metric.trendValue !== undefined && (
                  <span
                    className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                      isPositive ? 'bg-success-50 text-success-700' : 'bg-critical-50 text-critical-700'
                    }`}
                  >
                    <TrendIcon size={12} />
                    {metric.trend === 'up' ? '+' : '-'}
                    {metric.trendValue}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
