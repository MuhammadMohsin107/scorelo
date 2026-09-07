import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Clock3, Radar, RefreshCw, Settings2 } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';
import { type EvidenceRow, type RowStatus, type SubPillarAnalysis, type SubPillarFinding } from '../data/seo/subpillar.model';
import { fetchSubPillarAnalysis, isNotAuditedYet } from '../data/seo/subpillar.repository';
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
import RunAuditButton from '../components/audit/RunAuditButton';
import { isSubPillarImplemented } from '../data/audits.capabilities';
import { getDefaultSubPillarSettings, getSubPillarSettingsDefinition, type PageSettingValue } from '../data/pageSettings.registry';
import { fetchSubPillarSettings, saveSubPillarSettings } from '../data/pageSettings.repository';

/** Where an unrecognised slug is sent. The pillar LABELS that used to sit beside this were only
 * needed by the in-page breadcrumb, which the header now owns on its own. */
const backRoutes: Record<string, string> = { content: '/content', speed: '/speed', cro: '/cro', 'ai-discovery': '/ai-discovery' };

export default function NonSeoSubPillarPage() {
  const location = useLocation();
  const routeKey = location.pathname.replace(/^\//, '').replace(/\/$/, '');
  const config = genericCatalog[routeKey];
  const details = detailCatalog[routeKey];
  const [data, setData] = useState<SubPillarAnalysis | null>(null);
  const [state, setState] = useState<'loading' | 'success' | 'empty' | 'error'>('loading');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [investigation, setInvestigation] = useState<{ finding: SubPillarFinding; rows: EvidenceRow[] } | null>(null);
  const [statusFilter, setStatusFilter] = useState<RowStatus | 'All'>('All');
  const [settingsOpen, setSettingsOpen] = useState(false);
  // null = unknown; treated as "assume measurable" so a capability outage never hides a working
  // Run Audit button. See data/audits.capabilities.ts.
  const [implemented, setImplemented] = useState<boolean | null>(null);
  const [pageSettings, setPageSettings] = useState<Record<string, PageSettingValue>>(() => getDefaultSubPillarSettings(routeKey));
  // Last values loaded from / saved to the API — what "close without saving" reverts to.
  const savedSettingsRef = useRef<Record<string, PageSettingValue>>(pageSettings);
  const evidenceRef = useRef<HTMLDivElement>(null);

  const analysis = useMemo(() => config ? buildAnalysis(routeKey, config, details) : null, [config, details, routeKey]);
  const load = useCallback(async (refresh = false) => { if (!analysis) return; try { if (refresh) setIsRefreshing(true); else setState('loading'); setData(await fetchSubPillarAnalysis(analysis)); setState('success'); } catch (error) { setState(isNotAuditedYet(error) ? 'empty' : 'error'); } finally { setIsRefreshing(false); } }, [analysis]);
  useEffect(() => { setInvestigation(null); setStatusFilter('All'); load(); }, [load]);
  useEffect(() => {
    let active = true;
    const defaults = getDefaultSubPillarSettings(routeKey);
    savedSettingsRef.current = defaults;
    setPageSettings(defaults);
    setSettingsOpen(false);
    const [pillarKey, subKey] = routeKey.split('/');
    isSubPillarImplemented(pillarKey ?? '', subKey ?? '')
      .then((value) => { if (active) setImplemented(value); })
      .catch(() => { if (active) setImplemented(null); });
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

  // An unrecognised slug is a bad URL, not a pending feature: the route wildcard accepts anything
  // after /content, /speed, /cro or /ai-discovery, so a typo or a stale link lands here. Redirect
  // to that pillar's dashboard, matching SeoSubPillarRoute — previously this rendered a
  // "not available yet" card that implied the page was coming, and the three non-CRO pillars
  // never even reached it because their routes were enumerated and simply did not match.
  if (!config || !analysis) {
    const pillarKey = routeKey.split('/')[0] ?? '';
    return <Navigate to={backRoutes[pillarKey] ?? '/'} replace />;
  }
  if (state === 'loading') return <SubPillarSkeleton />;
  // "Not audited yet" is a first-run state, not a failure — the page must not imply a fault,
  // and must not fill its layout with numbers to compensate.
  if (state === 'empty') return <div className="mx-auto max-w-2xl px-4 py-10"><div className={`${card} flex flex-col items-center p-6 text-center`}><Radar size={18} className="text-brand-600" /><h1 className="mt-2.5 text-[15px] font-semibold text-surface-900">No {config.title} audit available</h1>{implemented === false
    ? <p className="mt-1 max-w-md text-[12.5px] leading-[1.5] text-surface-500">Scorelo does not measure this check yet, so running an audit will not populate this page. Support for it is still being built.</p>
    : <><p className="mt-1 max-w-sm text-[12.5px] leading-[1.5] text-surface-500">Run an audit to generate real results for this check. Nothing on this page is estimated.</p><RunAuditButton onComplete={() => { void load(); }} /></>}</div></div>;

  if (state === 'error' || !data) return <div className="mx-auto max-w-2xl px-4 py-10"><div className={`${card} flex flex-col items-center p-6 text-center`}><AlertCircle size={18} className="text-critical-600" /><h1 className="mt-2.5 text-[15px] font-semibold text-surface-900">Unable to load {config.title} analysis</h1><button type="button" onClick={() => load()} className="btn-primary mt-3"><RefreshCw size={14} />Retry</button></div></div>;

  const focusEvidence = (status: RowStatus | 'All') => { setStatusFilter(status); evidenceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  // Same compact shell as the SEO master template: page-shell frame, one header row, a 12-column
  // grid on a 12px gutter. The two templates render the same components, so they must also agree
  // on the space around them — a Content sub-pillar and an SEO sub-pillar are the same screen.
  return (
    <div className="bg-surface-50">
      <div className="page-shell">
        {/* NO in-page breadcrumb. The header already renders one for every route, so this second
            trail printed the same path twice — "Content › Duplicate / Templated Copy" directly
            under "Dashboard › Content › Duplicate / Templated Copy". The SEO template never had
            one, which is why only these pages showed it. */}
        <header className="page-head">
          <div className="min-w-0">
            <h1 className="page-title">{data.title}</h1>
            <p className="page-subtitle">{data.description}</p>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
            <span className="meta-chip">
              <Clock3 size={12} className="text-surface-400" aria-hidden="true" />
              Last analyzed <span className="font-medium text-surface-800">{data.lastAnalyzed}</span>
            </span>
            <button type="button" onClick={() => setSettingsOpen(true)} className="btn-secondary btn-xs">
              <Settings2 size={12} aria-hidden="true" />
              Settings
            </button>
            <button type="button" onClick={() => load(true)} disabled={isRefreshing} className="btn-primary btn-xs">
              <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} aria-hidden="true" />
              {isRefreshing ? 'Re-analyzing' : 'Re-analyze'}
            </button>
          </div>
        </header>

        <div className="mt-3 grid grid-cols-12 gap-3">
          <div className="col-span-12 xl:col-span-7">
            <ScoreCard totals={data.totals} summary={data.summary} healthChip={data.healthChip} />
          </div>
          <div className="col-span-12 xl:col-span-5">
            <HealthCard totals={data.totals} findings={data.findings} onSelectIssue={focusEvidence} />
          </div>

          <div className="col-span-12">
            <FindingsList
              findings={data.findings}
              onInvestigate={(finding) => setInvestigation({ finding, rows: [] })}
              emptyTitle={`Excellent — no ${data.title} issues`}
              emptyBody="Nothing was flagged in the latest analysis."
            />
          </div>

          <div ref={evidenceRef} className="col-span-12 scroll-mt-3">
            <EvidenceTable
              evidence={data.evidence}
              totalIssues={data.totals.issues}
              supportsBulkFix={data.supportsBulkFix}
              bulkFixMode={data.bulkFixMode}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              findings={data.findings}
              onInvestigate={(finding, rows) => setInvestigation({ finding, rows })}
            />
          </div>

          <div className="col-span-12">
            <p className={eyebrow}>Recommendation</p>
            <div className="mt-1.5 flex flex-col gap-2 rounded-md border border-brand-100 bg-brand-50/60 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12.5px] leading-[1.5] text-surface-700">
                {config.metrics[0]?.description ?? `Review the ${data.title} findings and address the highest-impact items first.`}
              </p>
              <button
                type="button"
                onClick={() => focusEvidence(data.findings[0]?.issueType ?? 'All')}
                className="btn-primary btn-xs flex-shrink-0"
              >
                <ArrowRight size={12} />
                Review evidence
              </button>
            </div>
          </div>
        </div>
      </div>

      <InvestigationDrawer
        finding={investigation?.finding ?? null}
        evidence={data.evidence.rows}
        selectedRows={investigation?.rows ?? []}
        onClose={() => setInvestigation(null)}
        onReviewAffected={(finding) => { setInvestigation(null); focusEvidence(finding.issueType); }}
      />

      <PageSettingsPanel
        open={settingsOpen}
        definition={settingsDefinition}
        values={pageSettings}
        onClose={() => { setSettingsOpen(false); setPageSettings(savedSettingsRef.current); }}
        onChange={updatePageSetting}
        onReset={() => setPageSettings(getDefaultSubPillarSettings(routeKey))}
        onSave={savePageSettings}
      />
    </div>
  );
}
