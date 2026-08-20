import { useState } from 'react';
import { ChevronLeft, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface HeaderStat {
  label: string;
  value: string | number;
}

interface Props {
  title: string;
  description: string;
  score: number;
  statusLabel: string;
  stats: HeaderStat[];
  lastAnalyzed: string;
  /** Route the "Back to Overview" link returns to, e.g. "/content". */
  backHref: string;
  /** Label shown next to the back arrow, e.g. "Back to Content Overview". */
  backLabel: string;
  actionLabel?: string;
  runningLabel?: string;
  onAction?: () => void;
}

function ScoreRing({ score }: { score: number }) {
  const size = 76;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - clampedScore / 100);

  return (
    <div className="relative h-[92px] w-[92px] flex-shrink-0" aria-label={`Score ${score} out of 100`} role="img">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-2 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#86efac"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold leading-none text-white tabular-nums">{score}</span>
        <span className="mt-1 text-[10px] font-medium text-slate-300">/ 100</span>
      </div>
    </div>
  );
}

/** Shared sub-pillar detail-page header used by every pillar's drill-down pages. */
export default function PillarSubHeader({
  title,
  description,
  score,
  statusLabel,
  stats,
  lastAnalyzed,
  backHref,
  backLabel,
  actionLabel = 'Re-analyze',
  runningLabel = 'Analyzing…',
  onAction,
}: Props) {
  const navigate = useNavigate();
  const [isRunning, setIsRunning] = useState(false);

  const handleAction = () => {
    setIsRunning(true);
    window.setTimeout(() => {
      setIsRunning(false);
      onAction?.();
    }, 1400);
  };

  return (
    <div className="px-4 pb-7 pt-5 sm:px-6 lg:px-8 lg:pt-7 max-w-[1440px] mx-auto">
      <button
        onClick={() => navigate(backHref)}
        className="mb-5 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-surface-500 transition-colors hover:bg-white hover:text-brand-700 group"
      >
        <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        {backLabel}
      </button>

      <div className="relative overflow-hidden rounded-2xl bg-slate-950 p-6 shadow-[0_18px_45px_-24px_rgba(15,23,42,0.8)] sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full border-[28px] border-slate-800/70" />
        <div className="pointer-events-none absolute bottom-0 right-1/3 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl" />
        <div className="relative flex flex-col gap-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_0_4px_rgba(110,231,183,0.12)]" />
                {statusLabel} audit
              </div>
              <h1 className="mb-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-300">{description}</p>
            </div>
            <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.06] p-3 pr-5 sm:shrink-0">
              <ScoreRing score={score} />
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Health score</div>
                <div className="mt-1 text-sm font-semibold text-emerald-300">{statusLabel}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-white/[0.04] px-4 py-4 sm:px-5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{stat.label}</div>
                <div className="mt-2 text-2xl font-bold text-white tabular-nums">
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs font-medium text-slate-400">Last analyzed <span className="text-slate-200">{lastAnalyzed}</span></div>
            <button
              onClick={handleAction}
              disabled={isRunning}
              className="inline-flex w-fit items-center gap-2 rounded-lg bg-emerald-300 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-200 disabled:opacity-70"
            >
              <RefreshCw size={14} className={isRunning ? 'animate-spin' : ''} />
              {isRunning ? runningLabel : actionLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
