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
  actionLabel?: string;
  runningLabel?: string;
  onAction?: () => void;
}

function statusTone(status: string) {
  const s = status.toLowerCase();
  if (s === 'excellent' || s === 'good') return 'text-success-700';
  if (s === 'needs work' || s === 'needs-work') return 'text-warning-700';
  return 'text-critical-700';
}

function ScoreRing({ score }: { score: number }) {
  const size = 76;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - clampedScore / 100);

  return (
    <div className="relative h-[76px] w-[76px] flex-shrink-0">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#22c55e"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold leading-none text-surface-900 tabular-nums">{score}</span>
        <span className="mt-0.5 text-[9px] font-medium text-surface-500">/ 100</span>
      </div>
    </div>
  );
}

export default function SeoSubPillarHeader({
  title,
  description,
  score,
  statusLabel,
  stats,
  lastAnalyzed,
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
    <div className="px-8 pt-4 pb-8 max-w-7xl mx-auto">
      <button
        onClick={() => navigate('/seo')}
        className="flex items-center gap-2 text-brand-600 hover:text-brand-700 font-medium text-sm mb-4 group"
      >
        <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        Back to SEO Overview
      </button>

      <div className="bg-white border border-surface-200 rounded-lg shadow-sm p-8">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-surface-900 mb-1.5">{title}</h1>
            <p className="text-sm text-surface-600 max-w-2xl">{description}</p>
          </div>
        </div>

        <div className="border-t border-surface-200 pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-6">
            <div>
              <div className="text-xs text-surface-500 font-semibold uppercase mb-1">Score</div>
              <ScoreRing score={score} />
              <div className={`text-xs font-semibold mt-0.5 ${statusTone(statusLabel)}`}>{statusLabel}</div>
            </div>
            {stats.map((stat) => (
              <div key={stat.label}>
                <div className="text-xs text-surface-500 font-semibold uppercase mb-1">{stat.label}</div>
                <div className="text-3xl font-bold text-surface-900 tabular-nums">
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-sm text-surface-600">Last analyzed: {lastAnalyzed}</div>
            <button
              onClick={handleAction}
              disabled={isRunning}
              className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium w-fit disabled:opacity-70"
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
