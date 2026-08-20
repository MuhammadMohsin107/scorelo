import { AlertOctagon, CheckCircle2, FileSearch, ListChecks, type LucideIcon } from 'lucide-react';
import type { SubPillarTotals } from '../../../data/seo/subpillar.model';
import { card, eyebrow, scoreHex, statusFromScore, toneStyles } from './tone';

interface Props {
  totals: SubPillarTotals;
  summary: string;
  healthChip: string;
}

function ScoreDial({ score }: { score: number }) {
  const size = 148;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Score ${score} out of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#eeeef0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={scoreHex(score)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="score-ring"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[46px] font-semibold leading-none tracking-[-0.04em] text-surface-950 tabular-nums">{score}</span>
        <span className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-surface-400">/ 100</span>
      </div>
    </div>
  );
}

// Hairline placement per cell: on mobile the grid is 2x2 (so cells 2 and
// 3 need a top rule), from sm up it is a single row of 4.
const cellBorder = ['', 'border-l', 'border-t sm:border-t-0 sm:border-l', 'border-l border-t sm:border-t-0'];

/** Hero: the score, what it means, and the four numbers behind it. */
export default function ScoreCard({ totals, summary, healthChip }: Props) {
  const status = statusFromScore(totals.score);

  const metrics: { label: string; value: number; icon: LucideIcon; tile: string }[] = [
    { label: totals.analyzedLabel, value: totals.analyzed, icon: FileSearch, tile: 'bg-surface-100 text-surface-600 ring-1 ring-inset ring-surface-900/10' },
    { label: totals.healthyLabel, value: totals.healthy, icon: CheckCircle2, tile: toneStyles.healthy.tile },
    { label: totals.issuesLabel, value: totals.issues, icon: ListChecks, tile: 'bg-surface-100 text-surface-600 ring-1 ring-inset ring-surface-900/10' },
    { label: totals.criticalLabel, value: totals.critical, icon: AlertOctagon, tile: toneStyles.critical.tile },
  ];

  return (
    <section className={`${card} overflow-hidden`} aria-labelledby="sp-score-title">
      <div className="flex flex-col gap-7 p-7 sm:flex-row sm:items-center">
        <ScoreDial score={totals.score} />

        <div className="min-w-0">
          <p className={eyebrow}>Health</p>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <h2 id="sp-score-title" className="text-[26px] font-semibold leading-none tracking-[-0.025em] text-surface-950">
              {status}
            </h2>
            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold ${toneStyles.healthy.badge}`}>
              <CheckCircle2 size={11} strokeWidth={2.4} aria-hidden="true" />
              {healthChip}
            </span>
          </div>
          <p className="mt-3 max-w-md text-[13px] leading-6 text-surface-600">{summary}</p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-md border border-surface-200 px-2.5 py-1 text-[11px] text-surface-500">
            {totals.contextLabel}
            <span className="font-semibold tabular-nums text-surface-800">{totals.contextValue}</span>
          </p>
        </div>
      </div>

      {/* Hairline metric strip — 2 columns on mobile, 4 from sm up. */}
      <div className="grid grid-cols-2 border-t border-surface-200 sm:grid-cols-4">
        {metrics.map((metric, index) => (
          <div key={metric.label} className={`border-surface-200 px-5 py-4 ${cellBorder[index]}`}>
            <div className="flex items-center gap-2">
              <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded ${metric.tile}`}>
                <metric.icon size={11} strokeWidth={2.4} aria-hidden="true" />
              </span>
              <p className="truncate text-[11px] font-medium uppercase tracking-wide text-surface-500">{metric.label}</p>
            </div>
            <p className="mt-2.5 text-[26px] font-semibold leading-none tracking-[-0.03em] text-surface-950 tabular-nums">
              {metric.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
