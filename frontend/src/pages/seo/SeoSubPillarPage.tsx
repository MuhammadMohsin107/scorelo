import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Clock3, Radar, RefreshCw, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  type EvidenceRow,
  type RowStatus,
  type SubPillarAnalysis,
  type SubPillarFinding,
} from '../../data/seo/subpillar.model';
import { fetchSubPillarAnalysis, isNotAuditedYet } from '../../data/seo/subpillar.repository';
import ScoreCard from '../../components/seo/subpillar/ScoreCard';
import HealthCard from '../../components/seo/subpillar/HealthCard';
import FindingsList from '../../components/seo/subpillar/FindingsList';
import EvidenceTable from '../../components/seo/subpillar/EvidenceTable';
import InvestigationDrawer from '../../components/seo/subpillar/InvestigationDrawer';
import SubPillarSkeleton from '../../components/seo/subpillar/SubPillarSkeleton';
import { card, eyebrow } from '../../components/seo/subpillar/tone';
import PageSettingsPanel from '../../components/settings/PageSettingsPanel';
import RunAuditButton from '../../components/audit/RunAuditButton';
import { isSubPillarImplemented } from '../../data/audits.capabilities';
import {
  getDefaultSubPillarSettings,
  getSubPillarSettingsDefinition,
  type PageSettingValue,
} from '../../data/pageSettings.registry';
import { fetchSubPillarSettings, saveSubPillarSettings } from '../../data/pageSettings.repository';

type LoadState = 'loading' | 'success' | 'empty' | 'error';

interface Props {
  /** The sub-pillar's own analysis. Layout is shared; data is not. */
  analysis: SubPillarAnalysis;
  /**
   * A configuration surface belonging to this sub-pillar alone, rendered under the header and
   * above the score.
   *
   * A slot rather than a branch: Image Alt Text has a template builder and the other seven
   * sub-pillars do not, and putting `slug === 'image-alt-text'` inside this shared template would
   * make every future exception another condition in a file that is supposed to be identical for
   * all of them. The route decides; the template just renders what it is given.
   */
  configurator?: React.ReactNode;
}

/**
 * The approved SEO sub-pillar template (established on Title Tags).
 * Every SEO sub-pillar renders through this shell and supplies its own
 * score, findings, evidence columns and terminology.
 */
export default function SeoSubPillarPage({ analysis, configurator }: Props) {
  const [data, setData] = useState<SubPillarAnalysis | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [isRefreshing, setIsRefreshing] = useState(false);
  // The finding under investigation, plus the row it was opened from. `row` is null when the user
  // came from the findings list, where they picked an issue rather than a specific item.
  const [investigation, setInvestigation] = useState<{ finding: SubPillarFinding; rows: EvidenceRow[] } | null>(null);
  const [statusFilter, setStatusFilter] = useState<RowStatus | 'All'>('All');
  const [settingsOpen, setSettingsOpen] = useState(false);
  // null = not yet known / lookup failed. Treated as "assume measurable" so a capability outage
  // never hides a Run Audit button that would actually have worked.
  const [implemented, setImplemented] = useState<boolean | null>(null);
  const [pageSettings, setPageSettings] = useState<Record<string, PageSettingValue>>(() => getDefaultSubPillarSettings(analysis.slug));
  const evidenceRef = useRef<HTMLDivElement>(null);
  const settingsDefinition = getSubPillarSettingsDefinition(analysis.slug);

  useEffect(() => {
    let active = true;
    setPageSettings(getDefaultSubPillarSettings(analysis.slug));
    setSettingsOpen(false);
    isSubPillarImplemented('seo', analysis.slug)
      .then((value) => { if (active) setImplemented(value); })
      .catch(() => { if (active) setImplemented(null); });
    fetchSubPillarSettings(analysis.slug)
      .then((values) => { if (active) setPageSettings(values); })
      .catch((error) => console.error('Failed to load page settings', error));
    return () => { active = false; };
  }, [analysis.slug]);

  const load = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setIsRefreshing(true);
        else setState('loading');
        const result = await fetchSubPillarAnalysis(analysis);
        setData(result);
        setState('success');
      } catch (error) {
        // A store with no audit yet is a first-run state, not a failure. Without this the page
        // shows "Unable to load", implying something broke when nothing has been measured.
        setState(isNotAuditedYet(error) ? 'empty' : 'error');
      } finally {
        setIsRefreshing(false);
      }
    },
    [analysis],
  );

  // Reset view state when navigating between sub-pillars.
  useEffect(() => {
    setInvestigation(null);
    setStatusFilter('All');
    load();
  }, [load]);

  const focusEvidence = (status: RowStatus | 'All') => {
    setStatusFilter(status);
    evidenceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const updatePageSetting = (key: string, value: PageSettingValue) => {
    setPageSettings((current) => ({ ...current, [key]: value }));
  };

  const savePageSettings = () => {
    saveSubPillarSettings(analysis.slug, pageSettings)
      .catch((error) => console.error('Failed to save page settings', error));
    setSettingsOpen(false);
  };

  if (state === 'loading') return <SubPillarSkeleton />;

  // The check ran but could not measure anything (e.g. a store with no blog articles). The score
  // it carries is a placeholder zero, so this renders the reason instead of a fabricated result.
  // Distinct from 'empty', which means no audit has been run at all.
  if (data && data.status === 'unavailable') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 md:px-6">
        <div className={`${card} flex flex-col items-center p-6 text-center`}>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-100 text-surface-500">
            <Radar size={18} />
          </span>
          <h1 className="mt-2.5 text-[15px] font-semibold text-surface-900">{data.title} — not measured</h1>
          <p className="mt-1 max-w-md text-[12.5px] leading-[1.5] text-surface-500">
            {data.unavailableReason ?? 'Scorelo could not measure this check for your store.'}
          </p>
          <p className="mt-2 text-[11px] text-surface-400">Last audit {data.lastAnalyzed}</p>
        </div>
      </div>
    );
  }

  if (state === 'empty') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 md:px-6">
        <div className={`${card} flex flex-col items-center p-6 text-center`}>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Radar size={18} />
          </span>
          <h1 className="mt-2.5 text-[15px] font-semibold text-surface-900">
            No {analysis.title} audit available
          </h1>
          {implemented === false ? (
            /* Scorelo has no check registered for this sub-pillar, so an audit run provably
               cannot populate it. Offering the button here would be a dead end. */
            <p className="mt-1 max-w-md text-[12.5px] leading-[1.5] text-surface-500">
              Scorelo does not measure this check yet, so running an audit will not populate this
              page. Support for it is still being built.
            </p>
          ) : (
            <>
              <p className="mt-1 max-w-sm text-[12.5px] leading-[1.5] text-surface-500">
                Run an audit to generate real results for this check. Nothing on this page is estimated.
              </p>
              {/* Runs a real audit job and reloads this page's data when it finishes — it no
                  longer just navigates to the dashboard while claiming to run one. */}
              <RunAuditButton onComplete={() => { void load(); }} />
            </>
          )}
        </div>
      </div>
    );
  }

  if (state === 'error' || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 md:px-6">
        <div className={`${card} flex flex-col items-center p-6 text-center`}>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-critical-50 text-critical-600">
            <AlertCircle size={18} />
          </span>
          <h1 className="mt-2.5 text-[15px] font-semibold text-surface-900">
            Unable to load {analysis.title} analysis
          </h1>
          <p className="mt-1 max-w-sm text-[12.5px] leading-[1.5] text-surface-500">
            The latest crawl data could not be retrieved. Your previous results are unaffected.
          </p>
          <button type="button" onClick={() => load()} className="btn-primary mt-3">
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    // The AppShell <main> is the scroll container, so this page must not
    // declare its own viewport height — that would add dead space below.
    <div className="bg-surface-50">
      <div className="page-shell">
        {/* Header. Title, one line of context and the page's two actions on a single row — the
            breadcrumb above it already says where the user is, so there is no second title. */}
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
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="btn-secondary btn-xs"
            >
              <Settings2 size={12} aria-hidden="true" />
              Settings
            </button>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={isRefreshing}
              className="btn-primary btn-xs"
            >
              <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} aria-hidden="true" />
              {isRefreshing ? 'Re-analyzing' : 'Re-analyze'}
            </button>
          </div>
        </header>

        {/* Sub-pillar configuration, when this sub-pillar has any. */}
        {configurator && <div className="mt-3">{configurator}</div>}

        {/* Score + breakdown */}
        <div className="mt-3 grid grid-cols-12 gap-3">
          <div className="col-span-12 xl:col-span-7">
            <ScoreCard totals={data.totals} summary={data.summary} healthChip={data.healthChip} />
          </div>
          <div className="col-span-12 xl:col-span-5">
            <HealthCard totals={data.totals} findings={data.findings} onSelectIssue={focusEvidence} />
          </div>

          {/* Findings */}
          <div className="col-span-12">
            <FindingsList
              findings={data.findings}
              onInvestigate={(finding) => setInvestigation({ finding, rows: [] })}
              emptyTitle={`Excellent — no ${data.title} issues`}
              emptyBody="Nothing was flagged in the latest analysis."
            />
          </div>

          {/* Evidence */}
          <div ref={evidenceRef} className="col-span-12 scroll-mt-3">
            <EvidenceTable
              evidence={data.evidence}
              totalIssues={data.totals.issues}
                supportsBulkFix={data.supportsBulkFix !== false}
                bulkFixMode={data.bulkFixMode}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              findings={data.findings}
              onInvestigate={(finding, rows) => setInvestigation({ finding, rows })}
            />
          </div>

          {/* Related areas */}
          <div className="col-span-12">
            <p className={eyebrow}>Related areas</p>
            <ul className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {data.relatedAreas.map((area) => (
                <li key={area.href}>
                  <Link
                    to={area.href}
                    className="group flex items-center justify-between gap-2 rounded-md border border-surface-200/80 bg-surface-0 px-2.5 py-1.5 transition-colors hover:border-brand-200 hover:bg-surface-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-medium text-surface-800 group-hover:text-brand-700">
                        {area.label}
                      </span>
                      <span className="block truncate text-[10.5px] text-surface-500">{area.hint}</span>
                    </span>
                    <ArrowRight
                      size={13}
                      className="flex-shrink-0 text-surface-300 transition-all group-hover:translate-x-0.5 group-hover:text-brand-600 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <InvestigationDrawer
        finding={investigation?.finding ?? null}
        evidence={data.evidence.rows}
        selectedRows={investigation?.rows ?? []}
        onClose={() => setInvestigation(null)}
        onReviewAffected={(finding) => {
          setInvestigation(null);
          focusEvidence(finding.issueType);
        }}
      />

      <PageSettingsPanel
        open={settingsOpen}
        definition={settingsDefinition}
        values={pageSettings}
        onClose={() => setSettingsOpen(false)}
        onChange={updatePageSetting}
        onReset={() => setPageSettings(getDefaultSubPillarSettings(analysis.slug))}
        onSave={savePageSettings}
      />
    </div>
  );
}
