import { ArrowDownRight, ArrowUpRight, Info, Minus } from 'lucide-react';
import type { KeyMetric, OverallScore, ScoreTrendPoint } from '../../data/dashboard/dashboard.types';
import MetricSummary from './MetricSummary';
import { cardClass, statusTone } from './scoreTone';

interface Props {
  data: OverallScore;
  metrics: KeyMetric[];
  trend: ScoreTrendPoint[];
}

/**
 * `measured: false` renders an empty dashed ring and the words "Not measured" instead of a
 * number. The placeholder zero the backend stores is never shown — a store we could not measure
 * must not look like a store that scored 0.
 */
function ScoreRing({ score, hex, measured }: { score: number; hex: string; measured: boolean }) {
  const size = 152;
  const stroke = 11;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);

  return (
    <div
      className="relative h-[152px] w-[152px] flex-shrink-0"
      role="img"
      aria-label={measured ? `Overall score ${score} out of 100` : 'Overall score not measured yet'}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f4f4f5"
          strokeWidth={stroke}
          strokeDasharray={measured ? undefined : '4 7'}
        />
        {measured && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={hex}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="score-ring motion-reduce:transition-none"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {measured ? (
          <>
            <span className="text-[44px] font-semibold leading-none tracking-tight text-surface-950 tabular-nums">{score}</span>
            <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-surface-400">out of 100</span>
          </>
        ) : (
          <span className="px-4 text-center text-[13px] font-semibold leading-snug text-surface-400">Not measured</span>
        )}
      </div>
    </div>
  );
}

/**
 * Hero card: the one number that matters, its status, a plain-language
 * summary and the supporting KPI strip.
 */
export default function ScoreOverview({ data, metrics }: Props) {
  const tone = statusTone[data.status];
  const TrendIcon = data.trend === 'up' ? ArrowUpRight : data.trend === 'down' ? ArrowDownRight : Minus;
  const trendChip =
    data.trend === 'up'
      ? 'bg-success-50 text-success-700'
      : data.trend === 'down'
        ? 'bg-critical-50 text-critical-700'
        : 'bg-surface-100 text-surface-600';

  return (
    <section className={`${cardClass} relative overflow-hidden`} aria-labelledby="overall-health-title">
      <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-brand-100/50 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-300/60 to-transparent" aria-hidden="true" />

      <div className="relative p-6 md:p-7">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
          {/* Score + narrative */}
          <div className="flex min-w-0 flex-1 flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
            <ScoreRing score={data.score} hex={tone.hex} measured={data.measured} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-surface-500">Overall health</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                <h2 id="overall-health-title" className="text-2xl font-semibold tracking-tight text-surface-950">
                  {data.statusLabel}
                </h2>
                {/* A trend needs two comparable scores. With nothing measured there is no
                    delta to report, so the chip is omitted rather than shown as "0 pts". */}
                {data.measured && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${trendChip}`}>
                    <TrendIcon size={12} strokeWidth={2.5} />
                    {data.trend === 'up' ? '+' : data.trend === 'down' ? '-' : ''}
                    {data.trendValue} pts this week
                  </span>
                )}
              </div>
              <p className="mt-2.5 max-w-xl text-sm leading-6 text-surface-600">{data.description}</p>
              {/* A score computed from part of the catalogue must say so next to the number,
                  not only inside a sub-pillar summary the merchant may never open. */}
              {data.coverageNote && (
                <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-warning-50 px-2 py-1 text-xs font-medium text-warning-700 ring-1 ring-inset ring-warning-100">
                  <Info size={13} strokeWidth={2.2} />
                  Partial scan — {data.coverageNote}
                </p>
              )}
              <p className="mt-3 text-xs text-surface-500">
                {data.measured
                  ? 'Scored across the pillars Scorelo can currently measure.'
                  : 'Scorelo scores SEO, Content, Speed, CRO and AI Discovery once an audit has run.'}
              </p>
            </div>
          </div>

          <div className="lg:w-[300px] lg:flex-shrink-0 lg:border-l lg:border-surface-100 lg:pl-7">
            <MetricSummary metrics={metrics} overallScore={data} layout="column" />
          </div>

        </div>
      </div>
    </section>
  );
}
