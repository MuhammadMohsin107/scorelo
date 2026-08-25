import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, ChevronRight, Clock3, RefreshCw, Settings2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { type RowStatus, type SubPillarAnalysis, type SubPillarFinding } from '../data/seo/subpillar.model';
import { fetchSubPillarAnalysis } from '../data/seo/subpillar.repository';
import { buildAnalysis } from '../data/genericAnalysis';
import ScoreCard from '../components/seo/subpillar/ScoreCard';
import HealthCard from '../components/seo/subpillar/HealthCard';
import FindingsList from '../components/seo/subpillar/FindingsList';
import EvidenceTable from '../components/seo/subpillar/EvidenceTable';
import InvestigationDrawer from '../components/seo/subpillar/InvestigationDrawer';
import SubPillarSkeleton from '../components/seo/subpillar/SubPillarSkeleton';
import { card, eyebrow } from '../components/seo/subpillar/tone';
import { genericCatalog } from './pillarCatalogs/genericCatalog';
import { detailCatalog } from './pillarCatalogs/detailCatalog';
import PageSettingsPanel from '../components/settings/PageSettingsPanel';
import { getDefaultSubPillarSettings, getSubPillarSettingsDefinition, type PageSettingValue } from '../data/pageSettings.registry';
import { fetchSubPillarSettings, saveSubPillarSettings } from '../data/pageSettings.repository';

const backRoutes: Record<string, string> = { content: '/content', speed: '/speed', cro: '/cro', 'ai-discovery': '/ai-discovery' };
const pillarLabels: Record<string, string> = { content: 'Content', speed: 'Speed', cro: 'CRO', 'ai-discovery': 'AI Discovery' };

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pageSettings, setPageSettings] = useState<Record<string, PageSettingValue>>(() => getDefaultSubPillarSettings(routeKey));
  // Last values loaded from / saved to the API — what "close without saving" reverts to.
  const savedSettingsRef = useRef<Record<string, PageSettingValue>>(pageSettings);
  const evidenceRef = useRef<HTMLDivElement>(null);

  const analysis = useMemo(() => config ? buildAnalysis(routeKey, config, details) : null, [config, details, routeKey]);
  const load = useCallback(async (refresh = false) => { if (!analysis) return; try { if (refresh) setIsRefreshing(true); else setState('loading'); setData(await fetchSubPillarAnalysis(analysis)); setState('success'); } catch { setState('error'); } finally { setIsRefreshing(false); } }, [analysis]);
  useEffect(() => { setActiveFinding(null); setStatusFilter('All'); load(); }, [load]);
  useEffect(() => {
    let active = true;
    const defaults = getDefaultSubPillarSettings(routeKey);
    savedSettingsRef.current = defaults;
    setPageSettings(defaults);
    setSettingsOpen(false);
    fetchSubPillarSettings(routeKey)
      .then((values) => { if (active) { savedSettingsRef.current = values; setPageSettings(values); } })
      .catch((error) => console.error('Failed to load page settings', error));
    return () => { active = false; };
  }, [routeKey]);

  const settingsDefinition = getSubPillarSettingsDefinition(routeKey);
  const updatePageSetting = (key: string, value: PageSettingValue) => setPageSettings((current) => ({ ...current, [key]: value }));
  const savePageSettings = () => {
    savedSettingsRef.current = pageSettings;
    saveSubPillarSettings(routeKey, pageSettings)
      .catch((error) => console.error('Failed to save page settings', error));
    setSettingsOpen(false);
  };

  if (!config || !analysis) return <div className="mx-auto max-w-3xl px-5 py-16"><div className={`${card} p-10 text-center`}><h1 className="text-lg font-semibold text-surface-900">This analysis is not available yet.</h1><p className="mt-1 text-sm text-surface-500">Check back after the next audit run.</p></div></div>;
  if (state === 'loading') return <SubPillarSkeleton />;
  if (state === 'error' || !data) return <div className="mx-auto max-w-3xl px-5 py-16"><div className={`${card} flex flex-col items-center p-10 text-center`}><AlertCircle size={24} className="text-critical-600" /><h1 className="mt-4 text-lg font-semibold text-surface-900">Unable to load {config.title} analysis</h1><button type="button" onClick={() => load()} className="btn-primary mt-6"><RefreshCw size={15} />Retry</button></div></div>;

  const focusEvidence = (status: RowStatus | 'All') => { setStatusFilter(status); evidenceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const backHref = backRoutes[config.pillar] ?? '/';
  const pillarLabel = pillarLabels[config.pillar] ?? config.pillarLabel;

  return <div className="bg-surface-50"><div className="mx-auto max-w-7xl px-5 pb-12 pt-6 md:px-8"><nav aria-label="Breadcrumb"><ol className="flex items-center gap-1 text-xs text-surface-500"><li><Link to={backHref} className="rounded hover:text-surface-800 focus-visible:ring-2 focus-visible:ring-brand-500">{pillarLabel}</Link></li><li aria-hidden="true"><ChevronRight size={13} className="text-surface-300" /></li><li className="font-medium text-surface-800" aria-current="page">{data.title}</li></ol></nav><header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight text-surface-950 md:text-3xl">{data.title}</h1><p className="mt-1.5 max-w-2xl text-sm leading-6 text-surface-600">{data.description}</p></div><div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-2.5 py-1.5 text-xs text-surface-600 shadow-sm"><Clock3 size={13} className="text-surface-400" />Last analyzed <span className="font-medium text-surface-800">{data.lastAnalyzed}</span></span><button type="button" onClick={() => setSettingsOpen(true)} className="inline-flex h-[34px] items-center gap-2 rounded-lg border border-surface-200 bg-white px-3 text-xs font-semibold text-surface-700 shadow-sm transition-colors hover:border-brand-200 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"><Settings2 size={13} />Client settings</button><button type="button" onClick={() => load(true)} disabled={isRefreshing} className="inline-flex h-[34px] items-center gap-2 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 disabled:opacity-60"><RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />{isRefreshing ? 'Re-analyzing' : 'Re-analyze'}</button></div></header><div className="mt-6 grid grid-cols-12 gap-5"><div className="col-span-12 xl:col-span-7"><ScoreCard totals={data.totals} summary={data.summary} healthChip={data.healthChip} /></div><div className="col-span-12 xl:col-span-5"><HealthCard totals={data.totals} findings={data.findings} onSelectIssue={focusEvidence} /></div><div className="col-span-12"><FindingsList findings={data.findings} onInvestigate={setActiveFinding} emptyTitle={`Excellent — no ${data.title.toLowerCase()} issues`} emptyBody="Nothing was flagged in the latest analysis." /></div><div ref={evidenceRef} className="col-span-12 scroll-mt-6"><EvidenceTable evidence={data.evidence} totalIssues={data.totals.issues} supportsBulkFix={data.supportsBulkFix} bulkFixMode={data.bulkFixMode} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} findings={data.findings} onInvestigate={setActiveFinding} /></div><div className="col-span-12"><p className={eyebrow}>Recommendation</p><div className="mt-3 rounded-xl border border-brand-100 bg-brand-50/60 p-5"><p className="text-sm leading-6 text-surface-700">{config.metrics[0]?.description ?? `Review the ${data.title.toLowerCase()} findings and address the highest-impact items first.`}</p><button type="button" onClick={() => focusEvidence(data.findings[0]?.issueType ?? 'All')} className="btn-primary mt-4"><ArrowRight size={15} />Review evidence</button></div></div></div></div><InvestigationDrawer finding={activeFinding} evidence={data.evidence.rows} onClose={() => setActiveFinding(null)} onReviewAffected={(finding) => { setActiveFinding(null); focusEvidence(finding.issueType); }} /><PageSettingsPanel open={settingsOpen} definition={settingsDefinition} values={pageSettings} onClose={() => { setSettingsOpen(false); setPageSettings(savedSettingsRef.current); }} onChange={updatePageSetting} onReset={() => setPageSettings(getDefaultSubPillarSettings(routeKey))} onSave={savePageSettings} /></div>;
}
