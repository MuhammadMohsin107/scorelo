import { useCallback, useEffect, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Clock3,
  FileSearch,
  Flag,
  Globe,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PillarKpiCard, { type KpiAccent } from './PillarKpiCard';
import PillarScoreRing from './PillarScoreRing';
import { PillarDashboardEmpty, PillarDashboardError, PillarDashboardSkeleton, SeedDataNotice } from './PillarDashboardState';
import { fetchPillarDashboard, isNoAuditError, type PillarDashboardData } from '../../data/pillars/pillarDashboard.repository';
import type { PillarKey } from '../../data/dashboard/dashboard.types';
import { useAuditRun } from '../../data/useAuditRun';
import { formatLastUpdated } from '../../data/dashboard/dashboard.repository';

/**
 * ─── The pillar dashboard ────────────────────────────────────────────
 * ONE screen, rendered by all five pillars.
 *
 * /seo, /content, /speed, /cro and /ai-discovery were five separate 400-line files describing the
 * same page: the same header band, the same four KPIs, the same area grid, the same priority list.
 * They had drifted apart in every detail that was not load-bearing — 3 columns here and 4 there,
 * `rounded-xl` here and `rounded-2xl` there, a 104px score ring beside a 96px one — because a
 * change made on one page had no way to reach the other four.
 *
 * A pillar now supplies only what genuinely differs: its key, its name, its icon and its copy.
 * Everything structural lives here, so the five pages cannot disagree again.
 *
 * DATA IS UNCHANGED. This calls the same fetchPillarDashboard(pillar) each page already called,
 * renders only what the API returns, and keeps the three real states — a store with no audit gets
 * the empty state, never a fabricated score.
 */

export interface PillarDashboardProps {
  /** Which pillar to load. The only argument the data layer needs. */
  pillar: PillarKey;
  /** Display name, used in the title, the states and the health card. */
  title: string;
  /** Pillar mark shown beside the title. */
  icon: LucideIcon;
  /** One line under the title. Page copy — never a measurement. */
  description: string;
  /** Sub-pillar id → one-line description. Page copy, keyed by the route slug. */
  areaDescriptions: Record<string, string>;
  /** Closing line in the Health card, in the pillar's own language. */
  healthNote: string;
  /** Shown when the store has no audit for this pillar yet. */
  emptyDescription: string;
  /** Optional per-pillar KPI icons. The labels are fixed; only the glyphs vary. */
  kpiIcons?: Record<string, { icon: LucideIcon; accent: KpiAccent }>;
}

type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';
type LoadState = 'loading' | 'ready' | 'empty' | 'error';

/** Shared thresholds: ≥85 Excellent · 70-84 Good · 50-69 Needs Work · <50 Critical. */
const statusLabel = (score: number) =>
  score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Needs Work' : 'Critical';

// Full class strings so Tailwind sees them at build time.
const statusPill: Record<string, string> = {
  Excellent: 'border-success-100 bg-success-50 text-success-700',
  Good: 'border-info-100 bg-info-50 text-info-700',
  'Needs Work': 'border-warning-100 bg-warning-50 text-warning-700',
  Critical: 'border-critical-100 bg-critical-50 text-critical-700',
};

const statusBadge: Record<string, string> = {
  Excellent: 'bg-success-50 text-success-700 ring-1 ring-success-100',
  Good: 'bg-info-50 text-info-700 ring-1 ring-info-100',
  'Needs Work': 'bg-warning-50 text-warning-700 ring-1 ring-warning-100',
  Critical: 'bg-critical-50 text-critical-700 ring-1 ring-critical-100',
};

const statusBar: Record<string, string> = {
  Excellent: 'bg-success-500',
  Good: 'bg-info-500',
  'Needs Work': 'bg-warning-500',
  Critical: 'bg-critical-500',
};

const severityRank: Record<IssueSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const severityBadge: Record<IssueSeverity, string> = {
  critical: 'bg-critical-50 text-critical-700 border border-critical-100',
  high: 'bg-warning-50 text-warning-700 border border-warning-100',
  medium: 'bg-surface-100 text-surface-600 border border-surface-200',
  low: 'bg-surface-100 text-surface-500 border border-surface-200',
};

const defaultKpiIcons: Record<string, { icon: LucideIcon; accent: KpiAccent }> = {
  'Open Issues': { icon: AlertTriangle, accent: 'warning' },
  'Critical Issues': { icon: AlertOctagon, accent: 'critical' },
  'High Priority': { icon: Flag, accent: 'warning' },
  'Areas Measured': { icon: FileSearch, accent: 'info' },
};

/** One issue row. Used by Priority Issues and Quick Wins, which differ only in their leading mark. */
function IssueRow({ lead, title, detail, onReview }: { lead: React.ReactNode; title: string; detail: string; onReview: () => void }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-1.5 transition-colors hover:bg-surface-50">
      {lead}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium text-surface-900">{title}</p>
        <p className="text-[10.5px] text-surface-500">{detail}</p>
      </div>
      <button onClick={onReview} className="btn-secondary btn-xs flex-shrink-0">
        Review
      </button>
    </div>
  );
}

/** Card shell for the four list panels, so their headers cannot drift apart. */
function ListCard({ title, hint, children, className = '' }: { title: string; hint: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-lg border border-surface-200 bg-surface-0 shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-surface-200 px-3 py-2">
        <h2 className="section-title">{title}</h2>
        <p className="meta-text">{hint}</p>
      </div>
      <div className="divide-y divide-surface-100">{children}</div>
    </div>
  );
}

export default function PillarDashboard({
  pillar,
  title,
  icon: Icon,
  description,
  areaDescriptions,
  healthNote,
  emptyDescription,
  kpiIcons = defaultKpiIcons,
}: PillarDashboardProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<PillarDashboardData | null>(null);
  const [state, setState] = useState<LoadState>('loading');

  const load = useCallback(async () => {
    setState('loading');
    try {
      setData(await fetchPillarDashboard(pillar));
      setState('ready');
    } catch (error) {
      // A store that has never been audited is a first-run state, not a failure — and it is the
      // reason this page must not render numbers of its own.
      setState(isNoAuditError(error) ? 'empty' : 'error');
    }
  }, [pillar]);

  // "Refresh" must re-ANALYSE the store, not just re-read the audit already stored. reload()
  // refreshes this page's data once the new audit has actually finished.
  const auditRun = useAuditRun();
  const refresh = () => void auditRun.run(load);

  useEffect(() => { load(); }, [load]);

  if (state === 'loading') return <PillarDashboardSkeleton title={title} />;
  if (state === 'empty') return <PillarDashboardEmpty title={title} description={emptyDescription} />;
  if (state === 'error' || !data) return <PillarDashboardError title={title} onRetry={load} />;

  const overallScore = data.overallScore;
  const overallStatus = overallScore === null ? 'Not measured' : statusLabel(overallScore);
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
    // No `min-h-screen`: the AppShell's <main> is the scroll container, so a second full-height
    // element here only guaranteed dead space under short content.
    <div className="bg-surface-50">
      <div className="page-shell section-stack">
        {/* ── Header ────────────────────────────────────────────────
            One band. The store, the audit time, the score and the action are the facts; the
            blurred accent glows that used to sit behind them were decoration measured in inches. */}
        <div className="flex flex-col gap-2.5 rounded-lg border border-surface-200 bg-surface-0 p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-brand-600 text-white">
                <Icon size={14} strokeWidth={2.2} />
              </span>
              <h1 className="page-title">{title}</h1>
              <span className="inline-flex items-center rounded border border-brand-100 bg-brand-50 px-1.5 py-px text-[10.5px] font-medium text-brand-700">
                {data.areas.length} areas monitored
              </span>
            </div>

            <p className="page-subtitle">{description}</p>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="meta-chip">
                <Globe size={12} className="text-surface-400" />
                <span className="font-medium text-surface-800">{data.storeName}</span>
                <span className="text-surface-300">·</span>
                <span className="truncate font-mono text-[10.5px] text-surface-500">{data.storeUrl}</span>
              </span>
              <span className="meta-chip">
                <Clock3 size={12} className="text-surface-400" />
                Last analyzed
                <span className="font-medium text-surface-800">{formatLastUpdated(data.lastAnalyzed)}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-3 lg:border-l lg:border-surface-100 lg:pl-3">
            {overallScore === null ? (
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-[3px] border-dashed border-surface-200 text-center text-[10.5px] font-medium text-surface-400">
                Not<br />measured
              </div>
            ) : (
              <PillarScoreRing score={overallScore} gradientId={`${pillar}-score-ring-gradient`} />
            )}
            <div>
              <p className="eyebrow">{title} Health</p>
              <span className={`mt-1 inline-flex items-center rounded border px-1.5 py-px text-[11px] font-semibold ${statusPill[overallStatus] ?? 'border-surface-200 bg-surface-50 text-surface-500'}`}>
                {overallStatus}
              </span>
              <button onClick={refresh} disabled={auditRun.running} className="btn-primary btn-xs mt-2 w-full">
                <RefreshCw size={12} className={auditRun.running ? 'animate-spin motion-reduce:animate-none' : undefined} />
                {auditRun.running ? `Analyzing… ${auditRun.progress}%` : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        {data.source === 'seed' && <SeedDataNotice />}

        {/* ── Summary metrics ───────────────────────────────────────
            Four KPIs in four columns. The old 5-column grid held four cards and one empty cell. */}
        <div className="grid-cards grid-cols-2 sm:grid-cols-4">
          {kpis.map((kpi) => {
            const meta = kpiIcons[kpi.label];
            return <PillarKpiCard key={kpi.label} label={kpi.label} value={kpi.value} icon={meta?.icon} accent={meta?.accent} />;
          })}
        </div>

        {/* ── Areas ─────────────────────────────────────────────────
            Four across on a laptop, so even an 11-area pillar is three rows rather than six. */}
        <div>
          <div className="section-head">
            <div>
              <h2 className="section-title">{title} Areas</h2>
              <p className="section-subtitle">Health and optimization opportunities across each area.</p>
            </div>
            <span className="meta-text tabular-nums">{data.areas.length} sub-pillars</span>
          </div>

          <div className="grid-cards grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.areas.map((area) => {
              const measured = area.score !== null;
              const label = measured ? statusLabel(area.score as number) : 'Not measured';
              return (
                <button
                  key={area.id}
                  onClick={() => navigate(area.route)}
                  className="group relative flex flex-col overflow-hidden rounded-lg border border-surface-200 bg-surface-0 p-2.5 text-left shadow-sm transition-all duration-200 hover:border-brand-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <h3 className="min-w-0 text-[12.5px] font-semibold leading-snug text-surface-900 transition-colors group-hover:text-brand-700">
                      {area.label}
                    </h3>
                    <span className={`inline-flex flex-shrink-0 items-center rounded px-1.5 py-px text-[10px] font-semibold ${statusBadge[label] ?? 'bg-surface-50 text-surface-500 ring-1 ring-surface-200'}`}>
                      {label}
                    </span>
                  </div>

                  {measured ? (
                    <>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-[20px] font-semibold leading-none tracking-tight text-surface-900 tabular-nums">{area.score}</span>
                        <span className="text-[10.5px] font-medium text-surface-400">/100</span>
                      </div>
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-100">
                        <div className={`h-full rounded-full ${statusBar[label]}`} style={{ width: `${area.score}%` }} />
                      </div>
                    </>
                  ) : (
                    <p className="mt-1.5 text-[12px] text-surface-400">No audit data yet</p>
                  )}

                  {/* line-clamp rather than a min-height: cards align on their own because the copy
                      is capped at two lines, without reserving space when it is one. */}
                  <p className="mt-1.5 line-clamp-2 text-[11px] leading-[1.4] text-surface-500">{areaDescriptions[area.id] ?? ''}</p>

                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-surface-100 pt-1.5 text-[10.5px]">
                    <span className="truncate text-surface-500">
                      {area.analyzedCount === null ? 'Not analyzed' : `${area.analyzedCount.toLocaleString()} analyzed`}
                    </span>
                    <span className="flex flex-shrink-0 items-center gap-1 font-semibold text-surface-800">
                      {area.issueCount === null ? '—' : `${area.issueCount.toLocaleString()} issues`}
                      <ArrowRight size={11} className="text-surface-300 transition-all group-hover:translate-x-0.5 group-hover:text-brand-600" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Priority issues + health summary ──────────────────────── */}
        <div className="grid gap-3 lg:grid-cols-3">
          <ListCard title="Priority Issues" hint="Ordered by severity — start at the top." className="lg:col-span-2">
            {sortedIssues.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12.5px] text-surface-500">
                No open {title.toLowerCase()} issues in the latest audit.
              </p>
            ) : (
              sortedIssues.map((issue) => (
                <IssueRow
                  key={issue.id}
                  lead={
                    <span className={`w-[60px] flex-shrink-0 rounded px-1.5 py-px text-center text-[9.5px] font-bold uppercase tracking-wide ${severityBadge[issue.severity]}`}>
                      {issue.severity}
                    </span>
                  }
                  title={issue.title}
                  detail={`${issue.affectedCount.toLocaleString()} ${issue.affectedLabel} • ${issue.subPillarLabel}`}
                  onReview={() => navigate(issue.route)}
                />
              ))
            )}
          </ListCard>

          <div className="h-fit rounded-lg border border-surface-200 bg-surface-0 p-3 shadow-sm">
            <h2 className="section-title">{title} Health</h2>
            <p className="section-subtitle">Issue counts from the latest audit of your store.</p>
            <div className="mt-2 space-y-1.5">
              {([
                ['Critical Issues', data.counts.critical, 'bg-critical-500'],
                ['High Priority', data.counts.high, 'bg-warning-500'],
                ['Medium Priority', data.counts.medium, 'bg-surface-400'],
              ] as const).map(([label, count, dot]) => (
                <div key={label} className="flex items-center justify-between rounded-md bg-surface-50 px-2.5 py-1.5">
                  <span className="flex items-center gap-2 text-[12px] font-medium text-surface-900">
                    <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${dot}`} />
                    {label}
                  </span>
                  <span className="text-[14px] font-semibold text-surface-900 tabular-nums">{count}</span>
                </div>
              ))}
            </div>
            <p className="mt-2.5 border-t border-surface-100 pt-2 text-[11px] leading-[1.45] text-surface-500">{healthNote}</p>
          </div>
        </div>

        {/* "Quick wins" are the highest-severity real findings — there is no separate
            recommendation engine, so this ranks what the audit actually found rather than
            inventing a second list beside it. */}
        <div className="grid gap-3 lg:grid-cols-2">
          <ListCard title="Quick Wins" hint="Highest-severity findings first.">
            {sortedIssues.slice(0, 4).map((issue, index) => (
              <IssueRow
                key={issue.id}
                lead={
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-surface-100 text-[10.5px] font-bold text-surface-700">
                    {index + 1}
                  </span>
                }
                title={issue.title}
                detail={`${issue.affectedCount.toLocaleString()} ${issue.affectedLabel} · ${issue.subPillarLabel}`}
                onReview={() => navigate(issue.route)}
              />
            ))}
          </ListCard>

          <ListCard title="Areas Needing Attention" hint="Lowest scoring measured areas.">
            {attentionAreas.map((area) => (
              <div key={area.id} className="flex items-center gap-2 px-3 py-1.5">
                <ChevronRight size={13} className="flex-shrink-0 text-surface-300" />
                <p className="min-w-0 flex-1 truncate text-[12.5px] text-surface-800">{area.label}</p>
                <span className="flex-shrink-0 text-[11px] tabular-nums text-surface-400">{area.score}/100</span>
                <button onClick={() => navigate(area.route)} className="btn-secondary btn-xs flex-shrink-0">
                  Review
                </button>
              </div>
            ))}
          </ListCard>
        </div>
      </div>
    </div>
  );
}
