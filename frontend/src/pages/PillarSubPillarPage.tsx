import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, Minus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import PillarSubHeader from '../components/pillars/PillarSubHeader';
import PillarMetricCard from '../components/pillars/PillarMetricCard';
import PillarHealthBreakdown from '../components/pillars/PillarHealthBreakdown';
import PillarTableCard from '../components/pillars/PillarTableCard';
import PillarOpportunityList from '../components/pillars/PillarOpportunityList';
import PillarFindingList from '../components/pillars/PillarFindingList';
import type { Finding } from '../data/pillars/finding.types';
import { findings as contentFindings } from '../data/content/content.mock';
import { findings as speedFindings } from '../data/speed/speed.mock';
import { findings as croFindings } from '../data/cro/cro.mock';
import { findings as aiFindings } from '../data/ai-discovery/ai-discovery.mock';
import { contentPillarCatalog } from './pillarCatalogs/contentCatalog';
import { speedPillarCatalog } from './pillarCatalogs/speedCatalog';
import { aiPillarCatalog } from './pillarCatalogs/aiCatalog';
import { croPillarCatalog } from './pillarCatalogs/croCatalog';
import { contentTables } from './pillarCatalogs/contentTables';
import { speedTables } from './pillarCatalogs/speedTables';
import { croTables } from './pillarCatalogs/croTables';
import { aiTables } from './pillarCatalogs/aiTables';

// ─── Config types ────────────────────────────────────────────────────

export interface GenericIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  affected: number;
  recommendation: string;
}

export interface GenericSubPillarConfig {
  pillar: string;
  pillarLabel: string;
  key: string;
  title: string;
  description: string;
  score: number;
  statusLabel: string;
  analyzedLabel: string;
  analyzed: number;
  healthy: number;
  metrics: Array<{ label: string; value: number | string; description: string; footnote?: string; filter?: string }>;
  breakdown: Array<{ label: string; value: number; color: string }>;
  issues: GenericIssue[];
}

export type TableCellValue = string | number | boolean | null;

export interface GenericTableColumn {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  /**
   * text   → regular cell
   * mono   → monospace, muted (URLs, handles, filenames)
   * muted  → small muted text (long descriptions / recommendations)
   * number → tabular numerals
   * bool   → check / dash icon
   * status → badge driven by row.status (column key is ignored)
   */
  variant?: 'text' | 'mono' | 'muted' | 'number' | 'bool' | 'status';
}

export interface GenericTableRow {
  id: string;
  /** Must be one of table.filters (other than "All"). */
  status: string;
  cells: Record<string, TableCellValue>;
}

export interface GenericTable {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  filters: string[];
  statusClass: Record<string, string>;
  columns: GenericTableColumn[];
  rows: GenericTableRow[];
  /** Column keys searched by the search box. Defaults to all string cells. */
  searchKeys?: string[];
}

export interface GenericOpportunity {
  id: string;
  title: string;
  description: string;
  impact: 'High' | 'Medium' | 'Low';
  effort: 'High' | 'Medium' | 'Low';
  ctaLabel: string;
  /** Table filter to apply when selected. */
  filter?: string;
}

export interface GenericSubPillarDetails {
  table: GenericTable;
  opportunities: GenericOpportunity[];
}

// ─── Catalog assembly ────────────────────────────────────────────────

export const genericCatalog: Record<string, GenericSubPillarConfig> = {
  ...contentPillarCatalog,
  ...speedPillarCatalog,
  ...aiPillarCatalog,
  ...croPillarCatalog,
  // SEO sub-pillars render through their own master template
  // (pages/seo/SeoSubPillarPage) and are intentionally not listed here.
};

const detailCatalog: Record<string, GenericSubPillarDetails> = {
  ...contentTables,
  ...speedTables,
  ...croTables,
  ...aiTables,
};

const findingsByPillar: Record<string, Finding[]> = {
  content: contentFindings,
  speed: speedFindings,
  cro: croFindings,
  'ai-discovery': aiFindings,
};

const severityClass: Record<GenericIssue['severity'], string> = {
  critical: 'bg-critical-100 text-critical-700',
  high: 'bg-warning-100 text-warning-700',
  medium: 'bg-surface-100 text-surface-700',
  low: 'bg-surface-100 text-surface-600',
};

const alignClass = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

function NotFound() {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="rounded-xl border border-surface-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-surface-900">This analysis is not available yet.</p>
        <p className="mt-1 text-xs text-surface-500">Check back after the next audit run.</p>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────

export default function PillarSubPillarPage() {
  const location = useLocation();
  const routeKey = location.pathname.replace(/^\//, '').replace(/\/$/, '');
  const config = genericCatalog[routeKey];
  const details = detailCatalog[routeKey];

  if (!config) return <NotFound />;
  return <SubPillarContent key={routeKey} config={config} details={details} />;
}

function SubPillarContent({ config, details }: { config: GenericSubPillarConfig; details?: GenericSubPillarDetails }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const findings = useMemo(
    () => (findingsByPillar[config.pillar] ?? []).filter((f) => f.areaKey === config.key),
    [config.pillar, config.key],
  );

  const table = details?.table;
  const filteredRows = useMemo(() => {
    if (!table) return [];
    const q = search.trim().toLowerCase();
    const keys = table.searchKeys ?? table.columns.filter((c) => c.variant !== 'status' && c.variant !== 'bool').map((c) => c.key);
    return table.rows.filter((row) => {
      if (filter !== 'All' && row.status !== filter) return false;
      if (!q) return true;
      return keys.some((k) => String(row.cells[k] ?? '').toLowerCase().includes(q));
    });
  }, [table, search, filter]);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const applyFilter = (next?: string) => {
    setFilter(next && table?.filters.includes(next) ? next : 'All');
    scrollTo(table ? 'detailed-analysis' : 'detected-issues');
  };

  const renderCell = (row: GenericTableRow, column: GenericTableColumn) => {
    const value = row.cells[column.key];
    switch (column.variant) {
      case 'status':
        return (
          <span className={`text-xs px-2 py-1 rounded font-medium ${table?.statusClass[row.status] ?? 'bg-surface-100 text-surface-700'}`}>
            {row.status}
          </span>
        );
      case 'bool':
        return value ? (
          <Check size={15} className="inline text-success-600" aria-label="Yes" />
        ) : (
          <Minus size={15} className="inline text-surface-300" aria-label="No" />
        );
      case 'mono':
        return <span className="text-xs text-surface-500 font-mono">{String(value ?? '—')}</span>;
      case 'muted':
        return <span className="text-xs text-surface-500">{String(value ?? '—')}</span>;
      case 'number':
        return <span className="text-xs font-medium text-surface-700 tabular-nums">{typeof value === 'number' ? value.toLocaleString() : String(value ?? '—')}</span>;
      default:
        return value === '' || value === null || value === undefined ? (
          <span className="text-xs text-surface-400 italic">—</span>
        ) : (
          <span className="text-xs text-surface-900">{String(value)}</span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(224,231,255,0.55),_transparent_34%),_#fafafa]">
      <PillarSubHeader
        title={config.title}
        description={config.description}
        score={config.score}
        statusLabel={config.statusLabel}
        stats={[
          { label: config.analyzedLabel, value: config.analyzed },
          { label: 'Healthy', value: config.healthy },
          { label: 'Issues', value: Math.max(config.analyzed - config.healthy, 0) },
        ]}
        lastAnalyzed="Today, 10:42 AM"
        backHref={`/${config.pillar}`}
        backLabel={`Back to ${config.pillarLabel} Overview`}
      />

      <div className="mx-auto max-w-[1440px] px-4 pb-12 sm:px-6 lg:px-8">
        {/* Two column: metric cards + health breakdown */}
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-600">Audit snapshot</div>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-surface-900">What needs attention</h2>
          </div>
          <span className="hidden text-xs font-medium text-surface-500 sm:block">Updated today at 10:42 AM</span>
        </div>
        <div className="mb-8 grid items-start gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {config.metrics.map((metric) => (
              <PillarMetricCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                description={metric.description}
                footnote={metric.footnote}
                ctaLabel={metric.filter ? `View ${metric.filter}` : 'Review'}
                onCta={() => applyFilter(metric.filter)}
              />
            ))}
          </div>

          <PillarHealthBreakdown
            title={`${config.title} Health Breakdown`}
            total={config.analyzed}
            items={config.breakdown.map((item) => ({ label: item.label, value: item.value, barClass: item.color, dotClass: item.color }))}
            footerNote={`${config.analyzed.toLocaleString()} ${config.analyzedLabel.toLowerCase()} analyzed`}
          />
        </div>

        {/* Findings (audit engine model) */}
        {findings.length > 0 && (
          <div className="mb-8">
            <PillarFindingList findings={findings} />
          </div>
        )}

        {/* Detected issues */}
        {config.issues.length > 0 && (
          <section id="detected-issues" className="mb-8 overflow-hidden rounded-xl border border-surface-200 bg-white shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)]" aria-labelledby="issues-title">
            <div className="border-b border-surface-200 px-5 py-5 sm:px-6">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-critical-600">Attention required</div>
              <h2 id="issues-title" className="mt-1 text-lg font-bold tracking-tight text-surface-900">Detected Issues</h2>
              <p className="text-xs text-surface-500 mt-1">{config.issues.length} issue {config.issues.length === 1 ? 'type' : 'types'} found</p>
            </div>
            <div className="divide-y divide-surface-100">
              {config.issues.map((issue) => (
                <div key={issue.id} className="px-6 py-4 hover:bg-surface-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`px-2 py-1 rounded text-xs font-bold flex-shrink-0 inline-flex items-center gap-1 ${severityClass[issue.severity]}`}>
                      <AlertTriangle size={12} />
                      {issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-surface-900">{issue.title}</h3>
                      <p className="text-sm text-surface-600 mt-1">{issue.affected.toLocaleString()} affected</p>
                      <p className="text-xs text-info-600 font-medium mt-2">→ {issue.recommendation}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/${config.pillar}`)}
                      className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800 flex-shrink-0"
                    >
                      Pillar overview <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Detailed analysis table */}
        {table && (
          <div id="detailed-analysis" className="mb-8 scroll-mt-6">
            <PillarTableCard
              title={table.title}
              subtitle={table.subtitle}
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder={table.searchPlaceholder}
              filters={table.filters}
              activeFilter={filter}
              onFilterChange={setFilter}
            >
              {filteredRows.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-surface-500">No rows match this filter.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-50 border-b border-surface-200">
                      <tr>
                        {table.columns.map((column) => (
                          <th
                            key={column.key}
                            className={`whitespace-nowrap border-b border-surface-200 bg-surface-50 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-surface-500 ${alignClass[column.align ?? 'left']}`}
                          >
                            {column.header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {filteredRows.map((row) => (
                        <tr key={row.id} className="transition-colors hover:bg-slate-50">
                          {table.columns.map((column) => (
                            <td key={column.key} className={`border-b border-surface-100 px-6 py-3.5 align-top ${alignClass[column.align ?? 'left']} ${column.variant === 'muted' ? 'max-w-xs' : ''}`}>
                              {renderCell(row, column)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </PillarTableCard>
          </div>
        )}

        {/* Opportunities */}
        {details && details.opportunities.length > 0 && (
          <PillarOpportunityList
            opportunities={details.opportunities}
            onSelect={(opp) => applyFilter((opp as GenericOpportunity).filter)}
          />
        )}
      </div>
    </div>
  );
}
