import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Clock3,
  Globe,
  Image as ImageIcon,
  Layers,
  MousePointerClick,
  RefreshCw,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PillarKpiCard from '../../components/pillars/PillarKpiCard';
import PillarScoreRing from '../../components/pillars/PillarScoreRing';
import {
  PillarDashboardEmpty,
  PillarDashboardError,
  PillarDashboardSkeleton,
  SeedDataNotice,
} from '../../components/pillars/PillarDashboardState';
import { fetchPillarDashboard, isNoAuditError, type PillarDashboardData } from '../../data/pillars/pillarDashboard.repository';
import { useAuditRun } from '../../data/useAuditRun';
import { formatLastUpdated } from '../../data/dashboard/dashboard.repository';

type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';
type StatusLabel = 'Excellent' | 'Good' | 'Needs Work' | 'Critical';

/** Static copy per sub-pillar — descriptions are page text, never a measurement. */
const areaDescription: Record<string, string> = {
  cwv: 'Track LCP, INP, and CLS across every page against field-data thresholds.',
  'image-weight': 'Find oversized, unoptimized, and legacy-format images slowing your storefront.',
  'app-bloat': 'Audit third-party apps and scripts for blocking, heavy, or unused code.',
  'theme-weight': 'Trim theme payload, redundant fonts, and missing lazy-load coverage.',
};

function statusLabelForScore(score: number): StatusLabel {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs Work';
  return 'Critical';
}

const statusPillClass: Record<string, string> = {
  Excellent: 'bg-success-50 text-success-700 ring-1 ring-success-100',
  Good: 'bg-info-50 text-info-700 ring-1 ring-info-100',
  'Needs Work': 'bg-warning-50 text-warning-700 ring-1 ring-warning-100',
  Critical: 'bg-critical-50 text-critical-700 ring-1 ring-critical-100',
};

const statusBarClass: Record<string, string> = {
  Excellent: 'bg-success-500',
  Good: 'bg-info-500',
  'Needs Work': 'bg-warning-500',
  Critical: 'bg-critical-500',
};

const statusHeaderPillClass: Record<string, string> = {
  Excellent: 'border-success-100 bg-success-50 text-success-700',
  Good: 'border-info-100 bg-info-50 text-info-700',
  'Needs Work': 'border-warning-100 bg-warning-50 text-warning-700',
  Critical: 'border-critical-100 bg-critical-50 text-critical-700',
};

// Icon + tint for each summary KPI, keyed by the label of the derived KPI.
const kpiMeta: Record<string, { icon: LucideIcon; accent: 'brand' | 'success' | 'warning' | 'critical' | 'info' | 'neutral' }> = {
  'Open Issues': { icon: AlertTriangle, accent: 'warning' },
  'Critical Issues': { icon: ImageIcon, accent: 'critical' },
  'High Priority': { icon: MousePointerClick, accent: 'warning' },
  'Areas Measured': { icon: Layers, accent: 'info' },
};

const severityRank: Record<IssueSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const severityBadge: Record<IssueSeverity, string> = {
  critical: 'bg-critical-50 text-critical-700 border border-critical-100',
  high: 'bg-warning-50 text-warning-700 border border-warning-100',
  medium: 'bg-surface-100 text-surface-600 border border-surface-200',
  low: 'bg-surface-100 text-surface-500 border border-surface-200',
};

type LoadState = 'loading' | 'ready' | 'empty' | 'error';

export default function SpeedDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<PillarDashboardData | null>(null);
  const [state, setState] = useState<LoadState>('loading');

  const load = useCallback(async () => {
    setState('loading');
    try {
      setData(await fetchPillarDashboard('speed'));
      setState('ready');
    } catch (error) {
      // A store that has never been audited is a first-run state, not a failure — and it is the
      // reason this page must not render numbers of its own.
      setState(isNoAuditError(error) ? 'empty' : 'error');
    }
  }, []);

  // "Refresh" must re-ANALYSE the store, not just re-read the audit already stored — that is
  // why clicking it appeared to change nothing. reload() refreshes this page's data once the
  // new audit has actually finished.
  const auditRun = useAuditRun();
  const refresh = () => void auditRun.run(load);

  useEffect(() => { load(); }, [load]);

  if (state === 'loading') return <PillarDashboardSkeleton title="Speed" />;
  if (state === 'empty') {
    return (
      <PillarDashboardEmpty
        title="Speed"
        description="Once an audit has measured your store, performance scores and prioritised issues for all 4 speed areas appear here."
      />
    );
  }
  if (state === 'error' || !data) return <PillarDashboardError title="Speed" onRetry={load} />;

  const overallScore = data.overallScore;
  const overallStatus = overallScore === null ? 'Not measured' : statusLabelForScore(overallScore);
  const sortedIssues = [...data.issues].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  const measuredAreas = data.areas.filter((area) => area.score !== null);
  const attentionAreas = measuredAreas.slice().sort((a, b) => (a.score as number) - (b.score as number)).slice(0, 4);
  const kpis = [
    { label: 'Open Issues', value: String(data.issues.length) },
    { label: 'Critical Issues', value: String(data.counts.critical) },
    { label: 'High Priority', value: String(data.counts.high) },
    { label: 'Areas Measured', value: `${measuredAreas.length}/${data.areas.length}` },
  ];

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="px-6 md:px-8 py-8 max-w-7xl mx-auto">
        {/* ── Speed Header Card ───────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm mb-6">
          {/* soft accent glows */}
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-100/70 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 right-1/3 h-56 w-56 rounded-full bg-success-50 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-300/70 to-transparent" />

          <div className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-center">
            {/* Left: title + description + meta */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-[0_6px_14px_rgba(79,70,229,0.28)]">
                  <Zap size={16} strokeWidth={2.2} />
                </span>
                <h1 className="text-xl font-semibold tracking-tight text-surface-900">Speed</h1>
                <span className="inline-flex items-center rounded-full border border-brand-100 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                  4 areas monitored
                </span>
              </div>

              <p className="mt-3 max-w-xl text-sm leading-relaxed text-surface-600">
                Improve your store's load times, Core Web Vitals, and page weight across every performance area.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-surface-50 px-2.5 py-1.5 text-surface-600">
                  <Globe size={13} className="text-surface-400" />
                  <span className="font-medium text-surface-800">{data.storeName}</span>
                  <span className="text-surface-300">·</span>
                  <span className="font-mono text-[11px] text-surface-500">{data.storeUrl}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-surface-50 px-2.5 py-1.5 text-surface-600">
                  <Clock3 size={13} className="text-surface-400" />
                  Last analyzed
                  <span className="font-medium text-surface-800">{formatLastUpdated(data.lastAnalyzed)}</span>
                </span>
              </div>
            </div>

            {/* Right: score + action */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center lg:border-l lg:border-surface-100 lg:pl-6">
              <div className="flex items-center gap-4">
                {overallScore === null ? (
                  <div className="flex h-[104px] w-[104px] items-center justify-center rounded-full border-4 border-dashed border-surface-200 text-center text-[11px] font-medium text-surface-400">
                    Not<br />measured
                  </div>
                ) : (
                  <PillarScoreRing score={overallScore} gradientId="speed-score-ring-gradient" />
                )}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-surface-400">Speed Health</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusHeaderPillClass[overallStatus] ?? 'border-surface-200 bg-surface-50 text-surface-500'}`}>
                      {overallStatus}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={refresh}
                disabled={auditRun.running}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-70 sm:ml-2"
              >
                <RefreshCw size={14} className={auditRun.running ? 'animate-spin motion-reduce:animate-none' : undefined} />
                {auditRun.running ? `Analyzing… ${auditRun.progress}%` : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        {data.source === 'seed' && <SeedDataNotice />}

        {/* ── Summary Metrics ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          {kpis.map((kpi) => {
            const meta = kpiMeta[kpi.label];
            return <PillarKpiCard key={kpi.label} label={kpi.label} value={kpi.value} icon={meta?.icon} accent={meta?.accent} />;
          })}
        </div>

        {/* ── Speed Areas ─────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-surface-900">Speed Areas</h2>
              <p className="mt-0.5 text-sm text-surface-500">
                Review the health and optimization opportunities across each performance area.
              </p>
            </div>
            <div className="hidden sm:inline-flex items-center rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700">
              4 sub-pillars
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.areas.map((area) => {
              const measured = area.score !== null;
              const label = measured ? statusLabelForScore(area.score as number) : 'Not measured';
              return (
                <button
                  key={area.id}
                  onClick={() => navigate(area.route)}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-surface-200 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
                >
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand-500 via-brand-400 to-success-500 opacity-0 transition-opacity group-hover:opacity-100" />

                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                        <span className="text-[11px] font-semibold">{area.label.charAt(0)}</span>
                      </span>
                      <h3 className="text-sm font-semibold leading-snug text-surface-900 transition-colors group-hover:text-brand-700">
                        {area.label}
                      </h3>
                    </div>

                    <span
                      className={`inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusPillClass[label] ?? 'bg-surface-50 text-surface-500 ring-1 ring-surface-200'}`}
                    >
                      {label}
                    </span>
                  </div>

                  {measured ? (
                    <>
                      <div className="mb-2 flex items-baseline gap-1">
                        <span className="text-2xl font-semibold tracking-tight text-surface-900 tabular-nums">{area.score}</span>
                        <span className="text-xs font-medium text-surface-400">/100</span>
                      </div>

                      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-100">
                        <div
                          className={`h-full rounded-full ${statusBarClass[label]}`}
                          style={{ width: `${area.score}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="mb-3 flex h-[46px] items-center">
                      <span className="text-sm text-surface-400">No audit data yet</span>
                    </div>
                  )}

                  <p className="mb-3 min-h-[36px] text-xs leading-relaxed text-surface-500">{areaDescription[area.id] ?? ''}</p>

                  <div className="mt-auto flex items-center justify-between gap-2 rounded-lg border border-surface-100 bg-surface-50 px-2.5 py-2 text-[11px]">
                    <span className="truncate text-surface-500">
                      {area.analyzedCount === null ? 'Not analyzed' : `${area.analyzedCount.toLocaleString()} analyzed`}
                    </span>
                    <span className="flex-shrink-0 font-semibold text-surface-800">
                      {area.issueCount === null ? '—' : `${area.issueCount.toLocaleString()} issues`}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-brand-700">View analysis</span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-brand-700 transition-all group-hover:bg-brand-600 group-hover:text-white">
                      <ArrowRight size={12} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Priority Issues + Health Summary ────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-6 mb-10">
          <div className="lg:col-span-2 bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-surface-200">
              <h2 className="text-base font-semibold tracking-tight text-surface-900">Priority Issues</h2>
              <p className="text-xs text-surface-500 mt-1">Ordered by severity — start at the top.</p>
            </div>
            <div className="divide-y divide-surface-100">
              {sortedIssues.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-surface-500">No open speed issues in the latest audit.</p>
              ) : (
                sortedIssues.map((issue) => (
                  <div key={issue.id} className="px-6 py-4 flex items-center gap-4 hover:bg-surface-50 transition-colors">
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded flex-shrink-0 w-[72px] text-center ${severityBadge[issue.severity]}`}>
                      {issue.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-surface-900 truncate">{issue.title}</p>
                      <p className="text-xs text-surface-500 mt-0.5">
                        {issue.affectedCount.toLocaleString()} {issue.affectedLabel} • {issue.subPillarLabel}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(issue.route)}
                      className="px-3 py-1.5 border border-surface-200 text-surface-700 hover:bg-surface-50 hover:border-surface-300 rounded-lg font-medium text-xs flex-shrink-0 transition-colors"
                    >
                      Review
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-6 h-fit">
            <h2 className="text-base font-semibold tracking-tight text-surface-900 mb-1">Speed Health</h2>
            <p className="text-sm text-surface-600 mb-6">
              Issue counts from the latest audit of your store.
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 bg-surface-50 rounded-lg">
                <span className="flex items-center gap-2.5 text-sm font-medium text-surface-900">
                  <span className="w-2 h-2 rounded-full bg-critical-500 flex-shrink-0" />
                  Critical Issues
                </span>
                <span className="text-base font-semibold text-surface-900 tabular-nums">{data.counts.critical}</span>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-surface-50 rounded-lg">
                <span className="flex items-center gap-2.5 text-sm font-medium text-surface-900">
                  <span className="w-2 h-2 rounded-full bg-warning-500 flex-shrink-0" />
                  High Priority
                </span>
                <span className="text-base font-semibold text-surface-900 tabular-nums">{data.counts.high}</span>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-surface-50 rounded-lg">
                <span className="flex items-center gap-2.5 text-sm font-medium text-surface-900">
                  <span className="w-2 h-2 rounded-full bg-surface-400 flex-shrink-0" />
                  Medium Priority
                </span>
                <span className="text-base font-semibold text-surface-900 tabular-nums">{data.counts.medium}</span>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-surface-100">
              <p className="text-xs text-surface-500 leading-relaxed">
                Resolving critical issues first will have the largest impact on page experience and rankings.
              </p>
            </div>
          </div>
        </div>

        {/* "Quick wins" are the highest-severity real findings — there is no separate
            recommendation engine, so this ranks what the audit actually found rather than
            inventing a second list beside it. */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-surface-200">
              <h2 className="text-base font-semibold tracking-tight text-surface-900">Quick Wins</h2>
              <p className="text-xs text-surface-500 mt-1">Highest-severity findings first.</p>
            </div>
            <div className="divide-y divide-surface-100">
              {sortedIssues.slice(0, 4).map((issue, index) => (
                <div key={issue.id} className="px-6 py-4 flex items-center gap-4 hover:bg-surface-50 transition-colors">
                  <span className="w-6 h-6 rounded-full bg-surface-100 text-surface-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-surface-900">{issue.title}</p>
                    <p className="text-xs text-surface-500 mt-0.5">
                      {issue.affectedCount.toLocaleString()} {issue.affectedLabel} · {issue.subPillarLabel}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(issue.route)}
                    className="px-3 py-1.5 border border-surface-200 text-surface-700 hover:bg-surface-50 hover:border-surface-300 rounded-lg font-medium text-xs flex-shrink-0 transition-colors"
                  >
                    Review
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-surface-200">
              <h2 className="text-base font-semibold tracking-tight text-surface-900">Areas Needing Attention</h2>
              <p className="text-xs text-surface-500 mt-1">Lowest scoring measured areas.</p>
            </div>
            <div className="divide-y divide-surface-100">
              {attentionAreas.map((area) => (
                <div key={area.id} className="px-6 py-3.5 flex items-center gap-3">
                  <ChevronRight size={14} className="text-surface-300 flex-shrink-0" />
                  <p className="text-sm text-surface-800 flex-1 min-w-0 truncate">{area.label}</p>
                  <span className="text-xs text-surface-400 flex-shrink-0">{area.score}/100</span>
                  <button
                    onClick={() => navigate(area.route)}
                    className="px-3 py-1.5 border border-surface-200 text-surface-700 hover:bg-surface-50 hover:border-surface-300 rounded-lg font-medium text-xs flex-shrink-0 transition-colors"
                  >
                    Review
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
