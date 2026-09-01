import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, ChevronRight, Clock3, Globe, RefreshCw, Target, type LucideIcon } from 'lucide-react';
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

const statusLabel = (score: number) => score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Needs Work' : 'Critical';
const statusPill: Record<string, string> = { Excellent: 'bg-success-50 text-success-700 border-success-100', Good: 'bg-info-50 text-info-700 border-info-100', 'Needs Work': 'bg-warning-50 text-warning-700 border-warning-100', Critical: 'bg-critical-50 text-critical-700 border-critical-100' };
const statusBar: Record<string, string> = { Excellent: 'bg-success-500', Good: 'bg-info-500', 'Needs Work': 'bg-warning-500', Critical: 'bg-critical-500' };
const severityRank: Record<IssueSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const severityBadge: Record<IssueSeverity, string> = { critical: 'bg-critical-50 text-critical-700 border border-critical-100', high: 'bg-warning-50 text-warning-700 border border-warning-100', medium: 'bg-surface-100 text-surface-600 border border-surface-200', low: 'bg-surface-100 text-surface-500 border border-surface-200' };

const kpiMeta: Record<string, { icon?: LucideIcon; accent?: 'brand' | 'success' | 'warning' | 'critical' | 'info' }> = {
  'Open Issues': { icon: Target, accent: 'warning' },
  'Critical Issues': { icon: AlertTriangle, accent: 'critical' },
  'High Priority': { icon: Target, accent: 'warning' },
  'Areas Measured': { icon: Target, accent: 'info' },
};

type LoadState = 'loading' | 'ready' | 'empty' | 'error';

export default function CroDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<PillarDashboardData | null>(null);
  const [state, setState] = useState<LoadState>('loading');

  const load = useCallback(async () => {
    setState('loading');
    try {
      setData(await fetchPillarDashboard('cro'));
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

  if (state === 'loading') return <PillarDashboardSkeleton title="CRO" />;
  if (state === 'empty') {
    return (
      <PillarDashboardEmpty
        title="CRO"
        description="Once an audit has measured your store, conversion scores and prioritised issues for all 11 CRO areas appear here."
      />
    );
  }
  if (state === 'error' || !data) return <PillarDashboardError title="CRO" onRetry={load} />;

  const overallScore = data.overallScore;
  const overallStatus = overallScore === null ? 'Not measured' : statusLabel(overallScore);
  const sortedIssues = [...data.issues].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  const measuredAreas = data.areas.filter((area) => area.score !== null);
  const kpis = [
    { label: 'Open Issues', value: String(data.issues.length) },
    { label: 'Critical Issues', value: String(data.counts.critical) },
    { label: 'High Priority', value: String(data.counts.high) },
    { label: 'Areas Measured', value: `${measuredAreas.length}/${data.areas.length}` },
  ];

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <div className="relative mb-6 overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-100/70 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 right-1/3 h-56 w-56 rounded-full bg-warning-50 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-300/70 to-transparent" />
          <div className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-[0_6px_14px_rgba(79,70,229,0.28)]"><Target size={16} strokeWidth={2.2} /></span><h1 className="text-xl font-semibold tracking-tight text-surface-900">CRO</h1><span className="inline-flex items-center rounded-full border border-brand-100 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">11 areas monitored</span></div>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-surface-600">Find and prioritize the moments that help more shoppers understand, trust, and complete their purchase.</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs"><span className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-surface-50 px-2.5 py-1.5 text-surface-600"><Globe size={13} className="text-surface-400" /><span className="font-medium text-surface-800">{data.storeName}</span><span className="text-surface-300">·</span><span className="font-mono text-[11px] text-surface-500">{data.storeUrl}</span></span><span className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-surface-50 px-2.5 py-1.5 text-surface-600"><Clock3 size={13} className="text-surface-400" />Last analyzed <span className="font-medium text-surface-800">{formatLastUpdated(data.lastAnalyzed)}</span></span></div>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center lg:border-l lg:border-surface-100 lg:pl-6"><div className="flex items-center gap-4">{overallScore === null ? <div className="flex h-[104px] w-[104px] items-center justify-center rounded-full border-4 border-dashed border-surface-200 text-center text-[11px] font-medium text-surface-400">Not<br />measured</div> : <PillarScoreRing score={overallScore} gradientId="cro-score-ring-gradient" />}<div><p className="text-[11px] font-semibold uppercase tracking-wider text-surface-400">CRO Health</p><span className={`mt-1 inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusPill[overallStatus] ?? 'border-surface-200 bg-surface-50 text-surface-500'}`}>{overallStatus}</span></div></div><button
                onClick={refresh}
                disabled={auditRun.running} className="btn-secondary sm:ml-2"><RefreshCw size={14} className={auditRun.running ? 'animate-spin motion-reduce:animate-none' : undefined} />{auditRun.running ? `Analyzing… ${auditRun.progress}%` : 'Refresh'}</button></div>
          </div>
        </div>

        {data.source === 'seed' && <SeedDataNotice />}

        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">{kpis.map((kpi) => { const meta = kpiMeta[kpi.label]; return <PillarKpiCard key={kpi.label} label={kpi.label} value={kpi.value} icon={meta?.icon} accent={meta?.accent} />; })}</div>

        <section className="mb-8" aria-labelledby="cro-areas-title"><div className="mb-4 flex items-end justify-between gap-4"><div><h2 id="cro-areas-title" className="text-lg font-semibold tracking-tight text-surface-900">CRO Areas</h2><p className="mt-0.5 text-sm text-surface-500">Review health and optimization opportunities across each conversion area.</p></div><span className="hidden rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700 sm:inline-flex">11 sub-pillars</span></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{data.areas.map((area) => { const measured = area.score !== null; const label = measured ? statusLabel(area.score as number) : 'Not measured'; return <button key={area.id} onClick={() => navigate(area.route)} className="group relative flex flex-col overflow-hidden rounded-xl border border-surface-200 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"><div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand-500 via-brand-400 to-success-500 opacity-0 transition-opacity group-hover:opacity-100" /><div className="mb-3 flex items-start justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100"><span className="text-[11px] font-semibold">{area.label.charAt(0)}</span></span><h3 className="text-sm font-semibold leading-snug text-surface-900 group-hover:text-brand-700">{area.label}</h3></div><span className={`inline-flex flex-shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusPill[label] ?? 'border-surface-200 bg-surface-50 text-surface-500'}`}>{label}</span></div>{measured ? <><div className="mb-2 flex items-baseline gap-1"><span className="text-2xl font-semibold tracking-tight text-surface-900 tabular-nums">{area.score}</span><span className="text-xs font-medium text-surface-400">/100</span></div><div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-100"><div className={`h-full rounded-full ${statusBar[label]}`} style={{ width: `${area.score}%` }} /></div></> : <div className="mb-3 flex h-[46px] items-center"><span className="text-sm text-surface-400">No audit data yet</span></div>}<div className="mt-auto flex items-center justify-between gap-2 rounded-lg border border-surface-100 bg-surface-50 px-2.5 py-2 text-[11px]"><span className="truncate text-surface-500">{area.analyzedCount === null ? 'Not analyzed' : `${area.analyzedCount.toLocaleString()} analyzed`}</span><span className="flex-shrink-0 font-semibold text-surface-800">{area.issueCount === null ? '—' : `${area.issueCount.toLocaleString()} issues`}</span></div><div className="mt-3 flex items-center justify-between gap-2"><span className="text-xs font-medium text-brand-700">View analysis</span><span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-brand-700 transition-all group-hover:bg-brand-600 group-hover:text-white"><ArrowRight size={12} /></span></div></button>; })}</div></section>

        <div className="mb-10 grid gap-6 lg:grid-cols-3"><div className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-sm lg:col-span-2"><div className="border-b border-surface-200 px-6 py-5"><h2 className="text-base font-semibold tracking-tight text-surface-900">Priority Issues</h2><p className="mt-1 text-xs text-surface-500">Ordered by severity — start at the top.</p></div><div className="divide-y divide-surface-100">{sortedIssues.length === 0 ? <p className="px-6 py-8 text-center text-sm text-surface-500">No open CRO issues in the latest audit.</p> : sortedIssues.map((issue) => <div key={issue.id} className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-surface-50"><span className={`w-[72px] flex-shrink-0 rounded px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide ${severityBadge[issue.severity]}`}>{issue.severity}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-surface-900">{issue.title}</p><p className="mt-0.5 text-xs text-surface-500">{issue.affectedCount.toLocaleString()} {issue.affectedLabel} · {issue.subPillarLabel}</p></div><button onClick={() => navigate(issue.route)} className="btn-secondary min-h-9 px-3 py-1.5 text-xs">Review</button></div>)}</div></div><div className="h-fit rounded-xl border border-surface-200 bg-white p-6 shadow-sm"><h2 className="mb-1 text-base font-semibold tracking-tight text-surface-900">CRO Health</h2><p className="mb-6 text-sm text-surface-600">Issue counts from the latest audit of your store.</p><div className="space-y-3"><HealthRow label="Critical Issues" value={data.counts.critical} tone="bg-critical-500" /><HealthRow label="High Priority" value={data.counts.high} tone="bg-warning-500" /><HealthRow label="Medium Priority" value={data.counts.medium} tone="bg-surface-400" /></div><div className="mt-6 border-t border-surface-100 pt-4"><p className="text-xs leading-relaxed text-surface-500">Resolving critical checkout and recovery issues first will have the largest conversion impact.</p></div></div></div>

        {/* "Quick wins" are the highest-severity real findings — there is no separate
            recommendation engine, so this ranks what the audit actually found rather than
            inventing a second list beside it. */}
        <div className="grid gap-6 lg:grid-cols-2"><ListPanel title="Quick Wins" eyebrow="Highest-severity findings first" items={sortedIssues.slice(0, 4).map((issue) => ({ id: issue.id, title: issue.title, detail: `${issue.affectedCount.toLocaleString()} ${issue.affectedLabel}`, route: issue.route }))} navigate={navigate} /><ListPanel title="Areas Needing Attention" eyebrow="Lowest scoring measured areas" items={measuredAreas.slice().sort((a, b) => (a.score as number) - (b.score as number)).slice(0, 4).map((area) => ({ id: area.id, title: area.label, detail: `${area.score}/100`, route: area.route }))} navigate={navigate} /></div>
      </div>
    </div>
  );
}

function HealthRow({ label, value, tone }: { label: string; value: number; tone: string }) { return <div className="flex items-center justify-between rounded-lg bg-surface-50 p-3.5"><span className="flex items-center gap-2.5 text-sm font-medium text-surface-900"><span className={`h-2 w-2 flex-shrink-0 rounded-full ${tone}`} />{label}</span><span className="text-base font-semibold tabular-nums text-surface-900">{value}</span></div>; }

function ListPanel({ title, eyebrow, items, navigate }: { title: string; eyebrow: string; items: Array<{ id: string; title: string; detail: string; route?: string }>; navigate: (path: string) => void }) { return <div className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-sm"><div className="border-b border-surface-200 px-6 py-5"><h2 className="text-base font-semibold tracking-tight text-surface-900">{title}</h2><p className="mt-1 text-xs text-surface-500">{eyebrow}</p></div><div className="divide-y divide-surface-100">{items.map((item) => <div key={item.id} className="flex items-center gap-3 px-6 py-3.5"><ChevronRight size={14} className="flex-shrink-0 text-surface-300" /><p className="min-w-0 flex-1 truncate text-sm text-surface-800">{item.title}</p><span className="flex-shrink-0 text-xs text-surface-400">{item.detail}</span>{item.route && <button onClick={() => navigate(item.route!)} className="btn-secondary min-h-9 px-3 py-1.5 text-xs">Review</button>}</div>)}</div></div>; }
