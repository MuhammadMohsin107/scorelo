import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';

export type KpiAccent = 'brand' | 'success' | 'warning' | 'critical' | 'info' | 'neutral';

interface PillarKpiCardProps {
  label: string;
  value: string;
  trend?: string;
  /** true = trend is a good outcome (green), false = bad (red), undefined = neutral (gray). Arrow direction always reflects the trend's actual sign. */
  trendGood?: boolean;
  /** Optional icon shown in a tinted tile at the top-right of the card. */
  icon?: LucideIcon;
  /** Tint used for the icon tile. Defaults to brand. */
  accent?: KpiAccent;
  subtitle?: string;
  breakdown?: { label: string; value: string; color?: string }[];
}

// Full class strings so Tailwind can see them at build time.
const accentTile: Record<KpiAccent, string> = {
  brand: 'bg-brand-50 text-brand-600 ring-brand-100',
  success: 'bg-success-50 text-success-600 ring-success-100',
  warning: 'bg-warning-50 text-warning-600 ring-warning-100',
  critical: 'bg-critical-50 text-critical-600 ring-critical-100',
  info: 'bg-info-50 text-info-600 ring-info-100',
  neutral: 'bg-surface-100 text-surface-600 ring-surface-200',
};

/** Shared KPI summary tile used across every pillar dashboard's metrics row. */
export default function PillarKpiCard({
  label,
  value,
  trend,
  trendGood,
  icon: Icon,
  accent = 'brand',
  subtitle,
  breakdown,
}: PillarKpiCardProps) {
  const cleanTrend = trend?.trim();
  const isDown = cleanTrend?.startsWith('-');
  const isFlat = cleanTrend === '0';

  const trendChip =
    trendGood === undefined
      ? 'bg-surface-100 text-surface-600'
      : trendGood
        ? 'bg-success-50 text-success-700'
        : 'bg-critical-50 text-critical-700';

  return (
    <div className="group relative rounded-xl border border-surface-200 bg-surface-0 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-surface-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-surface-500 leading-snug">{label}</p>
        {Icon && (
          <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ring-1 ${accentTile[accent]}`}>
            <Icon size={15} strokeWidth={2} />
          </span>
        )}
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="text-2xl font-semibold leading-none tracking-tight text-surface-900 tabular-nums">
          {value}
        </span>
        {cleanTrend && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${trendChip}`}>
            {isFlat ? <Minus size={11} /> : isDown ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
            {cleanTrend}
          </span>
        )}
      </div>

      {subtitle && <p className="mt-2 text-[11px] text-surface-500">{subtitle}</p>}

      {breakdown && (
        <div className="mt-3 flex gap-2 border-t border-surface-100 pt-3">
          {breakdown.map((item, idx) => (
            <div key={idx} className="flex-1">
              <p className="mb-0.5 text-[10px] text-surface-500">{item.label}</p>
              <p className="text-sm font-semibold text-surface-900">{item.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
