import { useMemo, useState } from 'react';
import { handlesRedirectsData, priorityIssues } from '../../data/seo/seo-8pillars.mock';
import SeoSubPillarHeader from '../../components/seo/SeoSubPillarHeader';
import SeoMetricCard from '../../components/seo/SeoMetricCard';
import SeoHealthBreakdown from '../../components/seo/SeoHealthBreakdown';
import SeoTableCard from '../../components/seo/SeoTableCard';
import SeoOpportunityList, { type Opportunity } from '../../components/seo/SeoOpportunityList';

type RedirectStatus = 'Broken' | 'Chain' | 'Invalid Handle' | '301/302' | 'Clean';

interface RedirectRow {
  source: string;
  destination: string | null;
  statusCode: '301' | '302' | 'broken' | 'n/a';
  type: string;
  status: RedirectStatus;
  note?: string;
}

const rows: RedirectRow[] = [
  {
    source: '/old-wireless-earbuds',
    destination: '/wireless-earbuds-pro',
    statusCode: '301',
    type: 'Permanent',
    status: '301/302',
  },
  {
    source: '/products/headphones-2023',
    destination: '/noise-cancelling-headphones',
    statusCode: '301',
    type: 'Permanent',
    status: '301/302',
  },
  {
    source: '/speakers-flash-sale',
    destination: '/best-bluetooth-speakers',
    statusCode: '302',
    type: 'Temporary',
    status: '301/302',
  },
  {
    source: '/wireless-earbuds-black',
    destination: null,
    statusCode: 'n/a',
    type: 'Direct',
    status: 'Clean',
  },
  {
    source: '/portable-speaker-mini',
    destination: null,
    statusCode: 'n/a',
    type: 'Direct',
    status: 'Clean',
  },
  {
    source: '/old-gaming-headset-guide',
    destination: '/gaming-headset-guide',
    statusCode: 'n/a',
    type: 'Chain',
    status: 'Chain',
    note: '2 hops via /gaming-headset-guide-2023',
  },
  {
    source: '/discontinued-earbuds-mini',
    destination: null,
    statusCode: 'broken',
    type: 'Broken',
    status: 'Broken',
    note: 'destination page no longer exists (404)',
  },
  {
    source: '/product_ID_4821_final_v2',
    destination: null,
    statusCode: 'n/a',
    type: 'Invalid Handle',
    status: 'Invalid Handle',
    note: 'unclean slug — trailing version suffix and mixed casing',
  },
];

function destinationLabel(row: RedirectRow): string {
  if (row.destination) return row.destination;
  if (row.status === 'Broken') return '— 404, destination removed —';
  if (row.status === 'Invalid Handle') return '— unclean slug, no redirect —';
  return '— resolves directly, no redirect —';
}

const statusBadgeClass: Record<RedirectStatus, string> = {
  Broken: 'bg-critical-100 text-critical-700',
  'Invalid Handle': 'bg-critical-100 text-critical-700',
  Chain: 'bg-warning-100 text-warning-700',
  '301/302': 'bg-success-100 text-success-700',
  Clean: 'bg-success-100 text-success-700',
};

const filters = ['All', 'Broken', 'Chain', 'Invalid Handle', '301/302', 'Clean'];

export default function HandlesRedirectsPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const redirectIssues = priorityIssues.filter((i) => i.areaKey === 'handles-redirects');
  const totalRedirects = handlesRedirectsData.redirects301 + handlesRedirectsData.redirects302;
  const totalIssues = handlesRedirectsData.redirectChains + handlesRedirectsData.brokenRedirects + handlesRedirectsData.invalidHandles;

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (filter !== 'All' && row.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchesSource = row.source.toLowerCase().includes(q);
        const matchesDestination = row.destination ? row.destination.toLowerCase().includes(q) : false;
        if (!matchesSource && !matchesDestination) return false;
      }
      return true;
    });
  }, [search, filter]);

  const opportunityFilterTarget: Record<string, string> = {
    'redirect-opp-1': 'Broken',
    'redirect-opp-2': 'Chain',
    'redirect-opp-3': 'Invalid Handle',
  };

  const opportunities: Opportunity[] = [
    {
      id: 'redirect-opp-1',
      title: `Fix ${handlesRedirectsData.brokenRedirects} broken redirects`,
      description: 'Broken redirects send visitors and crawlers to dead ends, wasting link equity and hurting user experience.',
      impact: 'High',
      effort: 'Low',
      ctaLabel: 'Review Broken',
    },
    {
      id: 'redirect-opp-2',
      title: `Flatten ${handlesRedirectsData.redirectChains} redirect chains`,
      description: 'Chained redirects add extra hops that slow page loads and dilute link equity — point each source directly to its final destination.',
      impact: 'Medium',
      effort: 'Medium',
      ctaLabel: 'Review Chains',
    },
    {
      id: 'redirect-opp-3',
      title: `Clean up ${handlesRedirectsData.invalidHandles} invalid URL handles`,
      description: 'Messy or inconsistent URL slugs undermine keyword relevance and look unprofessional in search results and links.',
      impact: 'Low',
      effort: 'Low',
      ctaLabel: 'Review Handles',
    },
  ];

  return (
    <div className="min-h-screen bg-surface-50">
      <SeoSubPillarHeader
        title="Handles & Redirects"
        description="Maintain clean URLs and proper redirect chains for SEO health."
        score={handlesRedirectsData.score}
        statusLabel="Excellent"
        stats={[
          { label: 'Analyzed', value: handlesRedirectsData.urlsAnalyzed },
          { label: 'Healthy', value: handlesRedirectsData.cleanUrls },
          { label: 'Issues', value: totalIssues },
        ]}
        lastAnalyzed="Today, 10:42 AM"
      />

      <div className="px-8 pb-8 max-w-7xl mx-auto">
        {/* Two Column */}
        <div className="grid items-start lg:grid-cols-[0.8fr_1.2fr] gap-6 mb-8">
          {/* Left Column - Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SeoMetricCard
              label="Broken Redirects"
              value={handlesRedirectsData.brokenRedirects}
              description="redirects point to a URL that no longer exists (dead end)"
              ctaLabel="Review Broken"
              onCta={() => setFilter('Broken')}
            />
            <SeoMetricCard
              label="Redirect Chains"
              value={handlesRedirectsData.redirectChains}
              description="URLs hop through 2+ redirects before reaching their final destination, wasting crawl budget"
              ctaLabel="Review Chains"
              onCta={() => setFilter('Chain')}
            />
            <SeoMetricCard
              label="Invalid Handles"
              value={handlesRedirectsData.invalidHandles}
              description="product/collection URL slugs contain unclean characters or formatting"
              footnote="Examples: trailing underscores, numeric-only slugs, mixed casing"
              ctaLabel="Review Handles"
              onCta={() => setFilter('Invalid Handle')}
            />
            <SeoMetricCard
              label="301/302 Redirects"
              value={totalRedirects}
              description="permanent and temporary redirects functioning as expected"
              ctaLabel="View Redirects"
              onCta={() => setFilter('301/302')}
            />
            <SeoMetricCard
              label="Clean URLs"
              value={handlesRedirectsData.cleanUrls}
              description="URLs resolve directly with no redirect involved"
              footnote={`${((handlesRedirectsData.cleanUrls / handlesRedirectsData.urlsAnalyzed) * 100).toFixed(1)}% of analyzed URLs`}
              ctaLabel="View Clean URLs"
              onCta={() => setFilter('Clean')}
            />
          </div>

          {/* Right Column - Health Breakdown */}
          <SeoHealthBreakdown
            title="Redirect Health Breakdown"
            total={handlesRedirectsData.urlsAnalyzed}
            items={[
              { label: 'Clean', value: handlesRedirectsData.cleanUrls, barClass: 'bg-green-500', dotClass: 'bg-green-500' },
              { label: 'Redirects', value: totalRedirects, barClass: 'bg-blue-500', dotClass: 'bg-blue-500' },
              { label: 'Chains', value: handlesRedirectsData.redirectChains, barClass: 'bg-amber-500', dotClass: 'bg-amber-500' },
              { label: 'Broken', value: handlesRedirectsData.brokenRedirects, barClass: 'bg-red-500', dotClass: 'bg-red-500' },
            ]}
            footerNote={`${handlesRedirectsData.urlsAnalyzed.toLocaleString()} URLs analyzed • ${handlesRedirectsData.invalidHandles} invalid handles tracked separately`}
          />
        </div>

        {/* Detected Issues */}
        {redirectIssues.length > 0 && (
          <div className="bg-white border border-surface-200 rounded-lg shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-5 border-b border-surface-200">
              <h2 className="text-lg font-bold text-surface-900">Detected Issues</h2>
              <p className="text-xs text-surface-500 mt-1">{redirectIssues.length} issue types found</p>
            </div>
            <div className="divide-y divide-surface-100">
              {redirectIssues.map((issue) => (
                <div key={issue.id} className="px-6 py-4 hover:bg-surface-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`px-2 py-1 rounded text-xs font-bold flex-shrink-0 ${
                      issue.severity === 'critical' ? 'bg-critical-100 text-critical-700' :
                      issue.severity === 'high' ? 'bg-warning-100 text-warning-700' :
                      'bg-surface-100 text-surface-700'
                    }`}>
                      {issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-surface-900">{issue.title}</h3>
                      <p className="text-sm text-surface-600 mt-1">{issue.affectedPages} URLs affected</p>
                      <p className="text-xs text-info-600 font-medium mt-2">→ {issue.recommendation}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed Analysis */}
        <div className="mb-8">
          <SeoTableCard
            title="Redirect Configuration"
            subtitle="Search and filter by redirect status"
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by source or destination URL…"
            filters={filters}
            activeFilter={filter}
            onFilterChange={setFilter}
          >
            {filteredRows.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-surface-500">
                No URLs match this filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-50 border-b border-surface-200">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-surface-700">Source URL</th>
                      <th className="px-6 py-3 text-left font-semibold text-surface-700">Destination</th>
                      <th className="px-6 py-3 text-center font-semibold text-surface-700">Status Code</th>
                      <th className="px-6 py-3 text-left font-semibold text-surface-700">Type</th>
                      <th className="px-6 py-3 text-right font-semibold text-surface-700">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {filteredRows.map((row) => (
                      <tr key={row.source} className="hover:bg-surface-50 transition-colors">
                        <td className="px-6 py-3">
                          <p className="text-xs text-surface-500 font-mono">{row.source}</p>
                        </td>
                        <td className="px-6 py-3">
                          <p className={`text-xs font-mono ${row.destination ? 'text-surface-900' : 'text-surface-400 italic'}`}>
                            {destinationLabel(row)}
                          </p>
                          {row.note && <p className="text-xs text-surface-500 mt-0.5">{row.note}</p>}
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span className="text-xs font-mono text-surface-700">{row.statusCode}</span>
                        </td>
                        <td className="px-6 py-3">
                          <span className="text-xs text-surface-600">{row.type}</span>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <span className={`text-xs px-2 py-1 rounded font-medium ${statusBadgeClass[row.status]}`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SeoTableCard>
        </div>

        {/* Optimization Opportunities */}
        <SeoOpportunityList
          opportunities={opportunities}
          onSelect={(opp) => setFilter(opportunityFilterTarget[opp.id] ?? 'All')}
        />
      </div>
    </div>
  );
}
