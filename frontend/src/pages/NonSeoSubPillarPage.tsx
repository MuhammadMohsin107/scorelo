import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, ChevronRight, Clock3, RefreshCw } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { fetchAnalysis, type CellValue, type EvidenceConfig, type EvidenceRow, type RowStatus, type SubPillarAnalysis, type SubPillarFinding } from '../data/seo/subpillar.model';
import ScoreCard from '../components/seo/subpillar/ScoreCard';
import HealthCard from '../components/seo/subpillar/HealthCard';
import FindingsList from '../components/seo/subpillar/FindingsList';
import EvidenceTable from '../components/seo/subpillar/EvidenceTable';
import InvestigationDrawer from '../components/seo/subpillar/InvestigationDrawer';
import SubPillarSkeleton from '../components/seo/subpillar/SubPillarSkeleton';
import { card, eyebrow } from '../components/seo/subpillar/tone';
import type { GenericSubPillarConfig, GenericSubPillarDetails, GenericTableColumn, GenericTableRow, TableCellValue } from './PillarSubPillarPage';
import { genericCatalog } from './PillarSubPillarPage';
import { findings as contentFindings } from '../data/content/content.mock';
import { findings as speedFindings } from '../data/speed/speed.mock';
import { findings as croFindings } from '../data/cro/cro.mock';
import { findings as aiFindings } from '../data/ai-discovery/ai-discovery.mock';
import { detailCatalog } from './pillarCatalogs/detailCatalog';

const findingsByPillar = { content: contentFindings, speed: speedFindings, cro: croFindings, 'ai-discovery': aiFindings };
const backRoutes: Record<string, string> = { content: '/content', speed: '/speed', cro: '/cro', 'ai-discovery': '/ai-discovery' };
const pillarLabels: Record<string, string> = { content: 'Content', speed: 'Speed', cro: 'CRO', 'ai-discovery': 'AI Discovery' };
const severityFor: Record<string, SubPillarFinding['severity']> = { critical: 'critical', high: 'high', medium: 'medium', low: 'low' };

function genericColumnToEvidence(column: GenericTableColumn): EvidenceConfig['columns'][number] {
  const variant = column.variant === 'mono' ? 'mono' : column.variant === 'muted' ? 'muted' : column.variant === 'number' ? 'number' : column.variant === 'status' ? 'status' : 'text';
  return { key: column.key, header: column.header, align: column.align, variant };
}

// Evidence cells don't render a bool icon variant (see genericColumnToEvidence's 'text' fallback for 'bool' columns),
// so booleans are normalized to the same Yes/No wording used by the generic table's check/dash icon labels.
function normalizeCellValue(value: TableCellValue): CellValue {
  return typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value;
}

function normalizeCells(cells: Record<string, TableCellValue>): Record<string, CellValue> {
  return Object.fromEntries(
    Object.entries(cells).map(([key, value]): [string, CellValue] => [key, normalizeCellValue(value)]),
  );
}

function buildFallbackEvidence(config: GenericSubPillarConfig, findings: SubPillarFinding[]): EvidenceConfig {
  const rows: EvidenceRow[] = findings.map((finding, index) => ({ id: finding.id, status: finding.issueType, cells: { item: `${config.key}-sample-${index + 1}`, issue: finding.title, affected: finding.affected }, current: { label: 'Detected', value: finding.title, meta: `${finding.affected.toLocaleString()} affected` }, suggested: { label: 'Recommendation', value: finding.recommendation } }));
  return { title: `${config.title} Evidence`, caption: `Evidence sampled from the latest ${config.title} analysis`, searchPlaceholder: 'Search evidence…', searchKeys: ['item', 'issue'], columns: [{ key: 'item', header: 'Resource', variant: 'mono' }, { key: 'issue', header: 'Finding', variant: 'text' }, { key: 'affected', header: 'Affected', variant: 'number', align: 'right' }, { key: 'status', header: 'Issue', variant: 'status' }, { key: 'action', header: 'Action', variant: 'action', align: 'right' }], rows, sorts: [], sampleNoun: config.analyzedLabel.toLowerCase() };
}

function buildAnalysis(routeKey: string, config: GenericSubPillarConfig, details?: GenericSubPillarDetails): SubPillarAnalysis {
  const sourceFindings = findingsByPillar[config.pillar as keyof typeof findingsByPillar] ?? [];
  const findings: SubPillarFinding[] = sourceFindings.filter((finding) => finding.areaKey === config.key).map((finding) => ({ id: finding.id, issueType: finding.title, title: finding.title, severity: severityFor[finding.severity], affected: finding.affected, impact: finding.scoreLift >= 3 ? 'High' : finding.scoreLift >= 2 ? 'Medium' : 'Low', effort: finding.resolution === 'Automated' ? 'Low' : 'Medium', whatIsWrong: finding.problem, whyItMatters: finding.impact, recommendation: finding.ctaLabel }));
  const table = details?.table;
  const evidence: EvidenceConfig = table ? { title: table.title, caption: table.subtitle, searchPlaceholder: table.searchPlaceholder, searchKeys: table.searchKeys ?? table.columns.map((column) => column.key), columns: [...table.columns.map(genericColumnToEvidence), { key: 'action', header: 'Action', variant: 'action', align: 'right' }], rows: table.rows.map((row: GenericTableRow) => ({ id: row.id, status: row.status, facet: row.status, cells: normalizeCells(row.cells), current: { label: 'Detected', value: String(row.cells[table.columns[0]?.key] ?? row.id), meta: String(row.cells[table.columns[1]?.key] ?? '') }, suggested: { label: 'Recommendation', value: String(row.cells.recommendation ?? row.cells[table.columns[table.columns.length - 1]?.key] ?? 'Review this item') } })), sorts: [], sampleNoun: config.analyzedLabel.toLowerCase() } : buildFallbackEvidence(config, findings);
  const issues = findings.reduce((sum, finding) => sum + finding.affected, 0);
  const critical = findings.filter((finding) => finding.severity === 'critical').reduce((sum, finding) => sum + finding.affected, 0);
  return { slug: routeKey, title: config.title, description: config.description, summary: `${config.healthy.toLocaleString()} of ${config.analyzed.toLocaleString()} ${config.analyzedLabel.toLowerCase()} meet the current ${config.title.toLowerCase()} standard.`, healthChip: `${config.analyzed > 0 ? ((config.healthy / config.analyzed) * 100).toFixed(1) : '0.0'}% healthy`, totals: { score: config.score, analyzed: config.analyzed, healthy: config.healthy, issues: Math.max(issues, config.analyzed - config.healthy), critical, analyzedLabel: config.analyzedLabel, healthyLabel: 'Healthy', issuesLabel: 'Issues', criticalLabel: 'Critical', contextLabel: config.metrics[0]?.label ?? 'Current standard', contextValue: String(config.metrics[0]?.value ?? 'Available') }, findings, evidence, relatedAreas: [], lastAnalyzed: 'Today, 10:42 AM' };
}

export default function NonSeoSubPillarPage() {
  const location = useLocation();
  const routeKey = location.pathname.replace(/^\//, '').replace(/\/$/, '');
  const config = genericCatalog[routeKey];
  const details = detailCatalog[routeKey];
  const [data, setData] = useState<SubPillarAnalysis | null>(null);
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFinding, setActiveFinding] = useState<SubPillarFinding | null>(null);
  const [statusFilter, setStatusFilter] = useState<RowStatus | 'All'>('All');
  const evidenceRef = useRef<HTMLDivElement>(null);

  const analysis = useMemo(() => config ? buildAnalysis(routeKey, config, details) : null, [config, details, routeKey]);
  const load = useCallback(async (refresh = false) => { if (!analysis) return; try { if (refresh) setIsRefreshing(true); else setState('loading'); setData(await fetchAnalysis(analysis)); setState('success'); } catch { setState('error'); } finally { setIsRefreshing(false); } }, [analysis]);
  useEffect(() => { setActiveFinding(null); setStatusFilter('All'); load(); }, [load]);

  if (!config || !analysis) return <div className="mx-auto max-w-3xl px-5 py-16"><div className={`${card} p-10 text-center`}><h1 className="text-lg font-semibold text-surface-900">This analysis is not available yet.</h1><p className="mt-1 text-sm text-surface-500">Check back after the next audit run.</p></div></div>;
  if (state === 'loading') return <SubPillarSkeleton />;
  if (state === 'error' || !data) return <div className="mx-auto max-w-3xl px-5 py-16"><div className={`${card} flex flex-col items-center p-10 text-center`}><AlertCircle size={24} className="text-critical-600" /><h1 className="mt-4 text-lg font-semibold text-surface-900">Unable to load {config.title} analysis</h1><button type="button" onClick={() => load()} className="btn-primary mt-6"><RefreshCw size={15} />Retry</button></div></div>;

  const focusEvidence = (status: RowStatus | 'All') => { setStatusFilter(status); evidenceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const backHref = backRoutes[config.pillar] ?? '/';
  const pillarLabel = pillarLabels[config.pillar] ?? config.pillarLabel;

  return <div className="bg-surface-50"><div className="mx-auto max-w-7xl px-5 pb-12 pt-6 md:px-8"><nav aria-label="Breadcrumb"><ol className="flex items-center gap-1 text-xs text-surface-500"><li><Link to={backHref} className="rounded hover:text-surface-800 focus-visible:ring-2 focus-visible:ring-brand-500">{pillarLabel}</Link></li><li aria-hidden="true"><ChevronRight size={13} className="text-surface-300" /></li><li className="font-medium text-surface-800" aria-current="page">{data.title}</li></ol></nav><header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight text-surface-950 md:text-3xl">{data.title}</h1><p className="mt-1.5 max-w-2xl text-sm leading-6 text-surface-600">{data.description}</p></div><div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-2.5 py-1.5 text-xs text-surface-600 shadow-sm"><Clock3 size={13} className="text-surface-400" />Last analyzed <span className="font-medium text-surface-800">{data.lastAnalyzed}</span></span><button type="button" onClick={() => load(true)} disabled={isRefreshing} className="btn-secondary h-[34px] px-3 text-xs"><RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />{isRefreshing ? 'Re-analyzing' : 'Re-analyze'}</button></div></header><div className="mt-6 grid grid-cols-12 gap-5"><div className="col-span-12 xl:col-span-7"><ScoreCard totals={data.totals} summary={data.summary} healthChip={data.healthChip} /></div><div className="col-span-12 xl:col-span-5"><HealthCard totals={data.totals} findings={data.findings} onSelectIssue={focusEvidence} /></div><div className="col-span-12"><FindingsList findings={data.findings} onInvestigate={setActiveFinding} emptyTitle={`Excellent — no ${data.title.toLowerCase()} issues`} emptyBody="Nothing was flagged in the latest analysis." /></div><div ref={evidenceRef} className="col-span-12 scroll-mt-6"><EvidenceTable evidence={data.evidence} totalIssues={data.totals.issues} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} findings={data.findings} onInvestigate={setActiveFinding} /></div><div className="col-span-12"><p className={eyebrow}>Recommendation</p><div className="mt-3 rounded-xl border border-brand-100 bg-brand-50/60 p-5"><p className="text-sm leading-6 text-surface-700">{config.metrics[0]?.description ?? `Review the ${data.title.toLowerCase()} findings and address the highest-impact items first.`}</p><button type="button" onClick={() => focusEvidence(data.findings[0]?.issueType ?? 'All')} className="btn-primary mt-4"><ArrowRight size={15} />Review evidence</button></div></div></div></div><InvestigationDrawer finding={activeFinding} evidence={data.evidence.rows} onClose={() => setActiveFinding(null)} onReviewAffected={(finding) => { setActiveFinding(null); focusEvidence(finding.issueType); }} /></div>;
}
