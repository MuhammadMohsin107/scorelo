import { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileSearch,
  Flag,
  Globe,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  seoKpis,
  priorityIssues,
  recommendedActions,
  recentActivity,
  titleTagsData,
  metaDescriptionsData,
  schemaJsonLdData,
  imageAltTextData,
  canonicalsDuplicatesData,
  handlesRedirectsData,
  sitemapIndexabilityData,
  internalLinksData,
  type SeoSubPillarKey,
  type IssueSeverity,
} from '../../data/seo/seo-8pillars.mock';
import SeoKpiCard from '../../components/seo/SeoKpiCard';

const areaRoute: Record<SeoSubPillarKey, string> = {
  'title-tags': '/seo/title-tags',
  'meta-descriptions': '/seo/meta-descriptions',
  schema: '/seo/schema',
  'image-alt-text': '/seo/image-alt-text',
  canonicals: '/seo/canonicals',
  'handles-redirects': '/seo/handles-redirects',
  sitemap: '/seo/sitemap',
  'internal-links': '/seo/internal-links',
};

const areaTitleRoute: Record<string, string> = {
  'Title Tags': '/seo/title-tags',
  'Meta Descriptions': '/seo/meta-descriptions',
  'Schema / JSON-LD': '/seo/schema',
  'Image Alt Text': '/seo/image-alt-text',
  'Canonicals & Duplicates': '/seo/canonicals',
  'Handles & Redirects': '/seo/handles-redirects',
  'Sitemap & Indexability': '/seo/sitemap',
  'Internal Links & 404s': '/seo/internal-links',
};

// Area cards derive every number from the same data objects the
// sub-pillar pages read, so dashboard and detail pages always match.
interface AreaCard {
  key: SeoSubPillarKey;
  title: string;
  score: number;
  statusLabel: 'Excellent' | 'Good';
  description: string;
  analyzed: string;
  keyStat: string;
}

const areaCards: AreaCard[] = [
  {
    key: 'title-tags',
    title: 'Title Tags',
    score: titleTagsData.score,
    statusLabel: 'Excellent',
    description: 'Optimize title tags for relevance, uniqueness, and click-through performance.',
    analyzed: `${titleTagsData.pagesAnalyzed.toLocaleString()} pages analyzed`,
    keyStat: `${titleTagsData.missing + titleTagsData.tooLong + titleTagsData.tooShort + titleTagsData.duplicate} issues`,
  },
  {
    key: 'meta-descriptions',
    title: 'Meta Descriptions',
    score: metaDescriptionsData.score,
    statusLabel: 'Good',
    description: 'Improve search-result descriptions and reduce missing or duplicate metadata.',
    analyzed: `${metaDescriptionsData.pagesAnalyzed.toLocaleString()} pages analyzed`,
    keyStat: `${metaDescriptionsData.missing + metaDescriptionsData.tooShort + metaDescriptionsData.tooLong + metaDescriptionsData.duplicate} issues`,
  },
  {
    key: 'schema',
    title: 'Schema / JSON-LD',
    score: schemaJsonLdData.score,
    statusLabel: 'Excellent',
    description: 'Monitor structured data coverage, validation, and rich-result eligibility.',
    analyzed: `${schemaJsonLdData.pagesAnalyzed.toLocaleString()} pages analyzed`,
    keyStat: `${schemaJsonLdData.pagesAnalyzed - schemaJsonLdData.pagesWithSchema} missing schema`,
  },
  {
    key: 'image-alt-text',
    title: 'Image Alt Text',
    score: imageAltTextData.score,
    statusLabel: 'Good',
    description: 'Improve image accessibility and search context with descriptive alt text.',
    analyzed: `${imageAltTextData.imagesAnalyzed.toLocaleString()} images analyzed`,
    keyStat: `${imageAltTextData.missing} missing`,
  },
  {
    key: 'canonicals',
    title: 'Canonicals & Duplicates',
    score: canonicalsDuplicatesData.score,
    statusLabel: 'Excellent',
    description: 'Detect duplicate URLs and canonicalization problems affecting indexing.',
    analyzed: `${canonicalsDuplicatesData.urlsAnalyzed.toLocaleString()} URLs analyzed`,
    keyStat: `${canonicalsDuplicatesData.canonicalConflicts} conflicts`,
  },
  {
    key: 'handles-redirects',
    title: 'Handles & Redirects',
    score: handlesRedirectsData.score,
    statusLabel: 'Excellent',
    description: 'Monitor URL handles, redirect chains, and broken destinations.',
    analyzed: `${handlesRedirectsData.urlsAnalyzed.toLocaleString()} URLs analyzed`,
    keyStat: `${handlesRedirectsData.brokenRedirects} broken redirects`,
  },
  {
    key: 'sitemap',
    title: 'Sitemap & Indexability',
    score: sitemapIndexabilityData.score,
    statusLabel: 'Excellent',
    description: 'Monitor sitemap coverage, index status, robots rules, and exclusions.',
    analyzed: `${sitemapIndexabilityData.sitemapUrls.toLocaleString()} URLs analyzed`,
    keyStat: `${sitemapIndexabilityData.notIndexed + sitemapIndexabilityData.blocked + sitemapIndexabilityData.errors} issues`,
  },
  {
    key: 'internal-links',
    title: 'Internal Links & 404s',
    score: internalLinksData.score,
    statusLabel: 'Good',
    description: 'Identify broken links, orphan pages, 404s, and linking opportunities.',
    analyzed: `${internalLinksData.internalLinks.toLocaleString()} internal links`,
    keyStat: `${internalLinksData.brokenLinks} broken links`,
  },
];

// Icon + tint for each summary KPI, keyed by the label in seoKpis so the
// mock data stays the single source of truth for values/trends.
const kpiMeta: Record<string, { icon: LucideIcon; accent: 'brand' | 'success' | 'warning' | 'critical' | 'info' | 'neutral' }> = {
  'Pages Analyzed': { icon: FileSearch, accent: 'brand' },
  'SEO Issues': { icon: AlertTriangle, accent: 'warning' },
  'Critical Issues': { icon: AlertOctagon, accent: 'critical' },
  'Optimized Pages': { icon: ShieldCheck, accent: 'success' },
  'Pages Needing Attention': { icon: Flag, accent: 'info' },
};

const overallKpi = seoKpis[0];
const overallScore = Number.parseInt(overallKpi.value, 10) || 0;

/** Compact circular score gauge used in the page header. */
function ScoreRing({ score, size = 96, stroke = 7 }: { score: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - clamped / 100);
  const gradientId = 'seo-score-ring-gradient';

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f4f4f5" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-semibold leading-none tracking-tight text-surface-900 tabular-nums">{score}</span>
        <span className="mt-0.5 text-[10px] font-medium text-surface-400">/ 100</span>
      </div>
    </div>
  );
}

const severityRank: Record<IssueSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const severityBadge: Record<IssueSeverity, string> = {
  critical: 'bg-critical-50 text-critical-700 border border-critical-100',
  high: 'bg-warning-50 text-warning-700 border border-warning-100',
  medium: 'bg-surface-100 text-surface-600 border border-surface-200',
  low: 'bg-surface-100 text-surface-500 border border-surface-200',
};

export default function SeoDashboard() {
  const navigate = useNavigate();
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  const sortedIssues = [...priorityIssues].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  const criticalCount = priorityIssues.filter((i) => i.severity === 'critical').length;
  const highCount = priorityIssues.filter((i) => i.severity === 'high').length;
  const mediumCount = priorityIssues.filter((i) => i.severity === 'medium').length;

  const handleReanalyze = () => {
    setIsReanalyzing(true);
    window.setTimeout(() => setIsReanalyzing(false), 1600);
  };

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="px-6 md:px-8 py-8 max-w-7xl mx-auto">
        {/* ── SEO Header Card ─────────────────────────────────────── */}
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
                  <Search size={16} strokeWidth={2.2} />
                </span>
                <h1 className="text-xl font-semibold tracking-tight text-surface-900">SEO</h1>
                <span className="inline-flex items-center rounded-full border border-brand-100 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                  8 areas monitored
                </span>
              </div>

              <p className="mt-3 max-w-xl text-sm leading-relaxed text-surface-600">
                Improve your store's search visibility and technical SEO health across every important SEO area.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-surface-50 px-2.5 py-1.5 text-surface-600">
                  <Globe size={13} className="text-surface-400" />
                  <span className="font-medium text-surface-800">Acme Store</span>
                  <span className="text-surface-300">·</span>
                  <span className="font-mono text-[11px] text-surface-500">acme-store.com</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-surface-50 px-2.5 py-1.5 text-surface-600">
                  <Clock3 size={13} className="text-surface-400" />
                  Last analyzed
                  <span className="font-medium text-surface-800">Today, 10:42 AM</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-success-100 bg-success-50 px-2.5 py-1.5 text-success-700">
                  <CheckCircle2 size={13} />
                  Crawl healthy
                </span>
              </div>
            </div>

            {/* Right: score + action */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center lg:border-l lg:border-surface-100 lg:pl-6">
              <div className="flex items-center gap-4">
                <ScoreRing score={overallScore} />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-surface-400">SEO Health</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-md border border-success-100 bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
                      Excellent
                    </span>
                  </div>
                  <p className="mt-2 inline-flex items-center gap-1 text-xs text-surface-500">
                    <TrendingUp size={12} className="text-success-600" />
                    <span className="font-medium text-success-700">{overallKpi.trend}</span>
                    vs last analysis
                  </p>
                </div>
              </div>

              <button
                onClick={handleReanalyze}
                disabled={isReanalyzing}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-70 sm:ml-2"
              >
                <RefreshCw size={14} className={isReanalyzing ? 'animate-spin' : ''} />
                {isReanalyzing ? 'Re-analyzing…' : 'Re-analyze'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Summary Metrics ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          {seoKpis.slice(1).map((kpi, idx) => {
            const meta = kpiMeta[kpi.label];
            return (
              <SeoKpiCard
                key={idx}
                label={kpi.label}
                value={kpi.value}
                trend={kpi.trend}
                trendGood={kpi.status === 'excellent' || kpi.status === 'improvement' ? true : undefined}
                icon={meta?.icon}
                accent={meta?.accent}
              />
            );
          })}
        </div>

        {/* ── SEO Areas ───────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-surface-900">SEO Areas</h2>
              <p className="mt-0.5 text-sm text-surface-500">
                Review the health and optimization opportunities across each SEO area.
              </p>
            </div>
            <div className="hidden sm:inline-flex items-center rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700">
              8 sub-pillars
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {areaCards.map((area) => (
              <button
                key={area.key}
                onClick={() => navigate(areaRoute[area.key])}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-surface-200 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
              >
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand-500 via-brand-400 to-success-500 opacity-0 transition-opacity group-hover:opacity-100" />

                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                      <span className="text-[11px] font-semibold">{area.title.charAt(0)}</span>
                    </span>
                    <h3 className="text-sm font-semibold leading-snug text-surface-900 transition-colors group-hover:text-brand-700">
                      {area.title}
                    </h3>
                  </div>

                  <span
                    className={`inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      area.statusLabel === 'Excellent'
                        ? 'bg-success-50 text-success-700 ring-1 ring-success-100'
                        : 'bg-info-50 text-info-700 ring-1 ring-info-100'
                    }`}
                  >
                    {area.statusLabel}
                  </span>
                </div>

                <div className="mb-2 flex items-baseline gap-1">
                  <span className="text-2xl font-semibold tracking-tight text-surface-900 tabular-nums">{area.score}</span>
                  <span className="text-xs font-medium text-surface-400">/100</span>
                </div>

                <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-100">
                  <div
                    className={`h-full rounded-full ${area.statusLabel === 'Excellent' ? 'bg-success-500' : 'bg-info-500'}`}
                    style={{ width: `${area.score}%` }}
                  />
                </div>

                <p className="mb-3 min-h-[36px] text-xs leading-relaxed text-surface-500">{area.description}</p>

                <div className="mt-auto flex items-center justify-between gap-2 rounded-lg border border-surface-100 bg-surface-50 px-2.5 py-2 text-[11px]">
                  <span className="truncate text-surface-500">{area.analyzed}</span>
                  <span className="flex-shrink-0 font-semibold text-surface-800">{area.keyStat}</span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-brand-700">View analysis</span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-brand-700 transition-all group-hover:bg-brand-600 group-hover:text-white">
                    <ArrowRight size={12} />

                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Priority Issues + Health Summary ────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-6 mb-10">
          <div className="lg:col-span-2 bg-white rounded-lg border border-surface-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-surface-200">
              <h2 className="text-lg font-bold text-surface-900">Priority Issues</h2>
              <p className="text-xs text-surface-500 mt-1">Ordered by severity — start at the top.</p>
            </div>
            <div className="divide-y divide-surface-100">
              {sortedIssues.map((issue) => (
                <div key={issue.id} className="px-6 py-4 flex items-center gap-4 hover:bg-surface-50 transition-colors">
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded flex-shrink-0 w-[72px] text-center ${severityBadge[issue.severity]}`}>
                    {issue.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-surface-900 truncate">{issue.title}</p>
                    <p className="text-xs text-surface-500 mt-0.5">
                      {issue.affectedPages.toLocaleString()} affected • {issue.area}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(areaRoute[issue.areaKey])}
                    className="px-3 py-1.5 border border-surface-200 text-surface-700 hover:bg-surface-50 hover:border-surface-300 rounded-lg font-medium text-xs flex-shrink-0 transition-colors"
                  >
                    Review
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-surface-200 shadow-sm p-6 h-fit">
            <h2 className="text-lg font-bold text-surface-900 mb-1">SEO Health</h2>
            <p className="text-sm text-surface-600 mb-6">
              Strong — most of your SEO foundation is healthy.
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 bg-surface-50 rounded-lg">
                <span className="flex items-center gap-2.5 text-sm font-medium text-surface-900">
                  <span className="w-2 h-2 rounded-full bg-critical-500 flex-shrink-0" />
                  Critical Issues
                </span>
                <span className="text-lg font-bold text-surface-900 tabular-nums">{criticalCount}</span>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-surface-50 rounded-lg">
                <span className="flex items-center gap-2.5 text-sm font-medium text-surface-900">
                  <span className="w-2 h-2 rounded-full bg-warning-500 flex-shrink-0" />
                  High Priority
                </span>
                <span className="text-lg font-bold text-surface-900 tabular-nums">{highCount}</span>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-surface-50 rounded-lg">
                <span className="flex items-center gap-2.5 text-sm font-medium text-surface-900">
                  <span className="w-2 h-2 rounded-full bg-surface-400 flex-shrink-0" />
                  Medium Priority
                </span>
                <span className="text-lg font-bold text-surface-900 tabular-nums">{mediumCount}</span>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-surface-100">
              <p className="text-xs text-surface-500 leading-relaxed">
                Resolving the {criticalCount} critical issues first will have the largest impact on indexing and rankings.
              </p>
            </div>
          </div>
        </div>

        {/* ── Quick Wins + Recent Findings ────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-surface-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-surface-200">
              <h2 className="text-lg font-bold text-surface-900">Quick Wins</h2>
              <p className="text-xs text-surface-500 mt-1">Highest-value actions to take next.</p>
            </div>
            <div className="divide-y divide-surface-100">
              {recommendedActions.slice(0, 4).map((action, index) => (
                <div key={action.id} className="px-6 py-4 flex items-center gap-4 hover:bg-surface-50 transition-colors">
                  <span className="w-6 h-6 rounded-full bg-surface-100 text-surface-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-surface-900">{action.title}</p>
                    <p className="text-xs text-surface-500 mt-0.5">
                      {action.pages.toLocaleString()} affected •{' '}
                      {action.severity === 'medium' ? 'Medium' : 'High'} impact · {action.effort} effort
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(areaTitleRoute[action.area] ?? '/seo')}
                    className="px-3 py-1.5 border border-surface-200 text-surface-700 hover:bg-surface-50 hover:border-surface-300 rounded-lg font-medium text-xs flex-shrink-0 transition-colors"
                  >
                    Review
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-surface-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-surface-200">
              <h2 className="text-lg font-bold text-surface-900">Recent Findings</h2>
              <p className="text-xs text-surface-500 mt-1">Latest changes detected on your store.</p>
            </div>
            <div className="divide-y divide-surface-100">
              {recentActivity.map((item) => (
                <div key={item.id} className="px-6 py-3.5 flex items-center gap-3">
                  <ChevronRight size={14} className="text-surface-300 flex-shrink-0" />
                  <p className="text-sm text-surface-800 flex-1 min-w-0 truncate">{item.action}</p>
                  <span className="text-xs text-surface-400 flex-shrink-0">{item.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
