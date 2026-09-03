import { useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { ScoreTrendPoint } from '../../data/dashboard/dashboard.types';
import { SCORE_TARGET, cardClass } from './scoreTone';

interface Props {
  data: ScoreTrendPoint[];
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/**
 * Overall score over time. Area chart with a hover tooltip, an
 * "Excellent" target line, and a keyboard-focusable point per snapshot.
 */
export default function ScoreTrend({ data }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (data.length < 2) {
    return (
      <section className={`${cardClass} h-full p-6`} aria-labelledby="score-trend-title">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-surface-500">Trend</p>
        <h2 id="score-trend-title" className="mt-1 text-lg font-semibold tracking-tight text-surface-950">Score over time</h2>
        <p className="mt-3 text-sm text-surface-500">No score history yet. Run an analysis to start tracking performance.</p>
      </section>
    );
  }

  const scores = data.map((p) => p.score);
  const minScore = Math.min(...scores, SCORE_TARGET);
  const maxScore = Math.max(...scores, SCORE_TARGET);
  const yMin = Math.max(0, Math.floor((minScore - 6) / 5) * 5);
  const yMax = Math.min(100, Math.ceil((maxScore + 4) / 5) * 5);
  const yRange = Math.max(yMax - yMin, 1);

  const current = scores[scores.length - 1];
  const first = scores[0];
  const delta = current - scores[scores.length - 2];
  const periodDelta = current - first;
  const DeltaIcon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;
  const deltaChip = delta > 0 ? 'bg-success-50 text-success-700' : delta < 0 ? 'bg-critical-50 text-critical-700' : 'bg-surface-100 text-surface-600';

  const width = 520;
  const height = 232;
  const pad = { top: 18, right: 16, bottom: 30, left: 34 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;
  const xFor = (i: number) => pad.left + (i / (data.length - 1)) * cw;
  const yFor = (s: number) => pad.top + ch - ((s - yMin) / yRange) * ch;

  const points = data.map((p, i) => ({ ...p, x: xFor(i), y: yFor(p.score) }));
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = `${line} L ${points[points.length - 1].x} ${pad.top + ch} L ${points[0].x} ${pad.top + ch} Z`;
  const gridValues = [yMin, yMin + yRange / 2, yMax];
  const targetY = yFor(SCORE_TARGET);

  const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((event.clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let best = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - px);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setActive(nearest);
  };

  const activePoint = active !== null ? points[active] : null;

  return (
    <section className={`${cardClass} flex h-full flex-col`} aria-labelledby="score-trend-title">
      <div className="flex items-start justify-between gap-4 border-b border-surface-100 px-5 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-surface-500">Trend</p>
          <h2 id="score-trend-title" className="mt-1 text-lg font-semibold tracking-tight text-surface-950">Score over time</h2>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tracking-tight text-surface-950 tabular-nums">{current}</p>
          <span className={`mt-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${deltaChip}`}>
            <DeltaIcon size={12} strokeWidth={2.5} />
            {delta > 0 ? '+' : ''}
            {delta} vs last
          </span>
        </div>
      </div>

      <div className="relative flex-1 px-3 pb-3 pt-4">
        {activePoint && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-surface-200 bg-surface-0 px-2.5 py-1.5 shadow-md"
            style={{ left: `${(activePoint.x / width) * 100}%`, top: `${Math.max((activePoint.y / height) * 100 - 14, 2)}%` }}
            role="status"
          >
            <p className="text-[10px] font-medium text-surface-500">{formatDate(activePoint.date)}</p>
            <p className="text-sm font-semibold tabular-nums text-surface-950">{activePoint.score}</p>
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full cursor-crosshair"
          role="img"
          aria-label={`Overall score over the last ${data.length} analyses, from ${first} to ${current}`}
          onMouseMove={handleMove}
          onMouseLeave={() => setActive(null)}
        >
          <defs>
            <linearGradient id="dashboard-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopOpacity="0.18" className="[stop-color:var(--color-chart-line)]" />
              <stop offset="1" stopOpacity="0" className="[stop-color:var(--color-chart-line)]" />
            </linearGradient>
          </defs>

          {gridValues.map((v) => (
            <g key={v}>
              <line x1={pad.left} x2={width - pad.right} y1={yFor(v)} y2={yFor(v)} className="stroke-chart-grid" />
              <text x={pad.left - 8} y={yFor(v) + 3.5} textAnchor="end" fontSize="10" className="fill-chart-axis tabular-nums">
                {Math.round(v)}
              </text>
            </g>
          ))}

          {/* Target line */}
          <line x1={pad.left} x2={width - pad.right} y1={targetY} y2={targetY} strokeDasharray="3 4" strokeOpacity="0.6" className="stroke-success-600" />
          <text x={width - pad.right} y={targetY - 5} textAnchor="end" fontSize="10" fontWeight="600" className="fill-success-700">
            Excellent {SCORE_TARGET}
          </text>

          <path d={area} fill="url(#dashboard-trend-fill)" />
          <path d={line} fill="none" strokeWidth="2.25" className="stroke-chart-line" strokeLinecap="round" strokeLinejoin="round" />

          {activePoint && (
            <line x1={activePoint.x} x2={activePoint.x} y1={pad.top} y2={pad.top + ch} strokeDasharray="2 3" className="stroke-brand-200" />
          )}

          {points.map((p, i) => {
            const isActive = i === active;
            const isLast = i === points.length - 1;
            return (
              <g key={p.date}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isActive ? 5.5 : isLast ? 4.5 : 3.5}
                  className={`outline-none transition-[r] duration-150 stroke-chart-line focus-visible:stroke-brand-300 focus-visible:stroke-[4px] ${isActive || isLast ? 'fill-chart-line' : 'fill-surface-0'}`}
                  strokeWidth="2"
                  tabIndex={0}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  
                >
                  <title>{`${formatDate(p.date)}: ${p.score}`}</title>
                </circle>
                <text x={p.x} y={height - 8} textAnchor="middle" fontSize="10" className="fill-chart-axis">
                  {formatDate(p.date)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-surface-100 px-5 py-3 text-xs text-surface-500">
        <span>
          Last {data.length} analyses · {formatDate(data[0].date)} – {formatDate(data[data.length - 1].date)}
        </span>
        <span className="font-medium tabular-nums text-surface-700">
          {periodDelta > 0 ? '+' : ''}
          {periodDelta} pts over period
        </span>
      </div>
    </section>
  );
}
