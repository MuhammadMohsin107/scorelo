import { useMemo, useState } from 'react';
import { sitemapIndexabilityData, priorityIssues } from '../../data/seo/seo-8pillars.mock';
import SeoSubPillarHeader from '../../components/seo/SeoSubPillarHeader';
import SeoMetricCard from '../../components/seo/SeoMetricCard';
import SeoHealthBreakdown from '../../components/seo/SeoHealthBreakdown';
import SeoTableCard from '../../components/seo/SeoTableCard';
import SeoOpportunityList, { type Opportunity } from '../../components/seo/SeoOpportunityList';

type IndexStatus = 'Indexed' | 'Not Indexed' | 'Blocked' | 'Noindex' | 'Error';

interface SitemapRow {
  url: string;
  indexStatus: IndexStatus;
  inSitemap: boolean;
  robotsAllowed: boolean;
}

const rows: SitemapRow[] = [
  { url: '/wireless-earbuds-pro', indexStatus: 'Indexed', inSitemap: true, robotsAllowed: true },
  { url: '/noise-cancelling-headphones', indexStatus: 'Indexed', inSitemap: true, robotsAllowed: true },
  { url: '/best-bluetooth-speakers', indexStatus: 'Indexed', inSitemap: true, robotsAllowed: true },
  { url: '/gaming-headset-guide', indexStatus: 'Indexed', inSitemap: true, robotsAllowed: true },
  { url: '/home-audio-setup', indexStatus: 'Indexed', inSitemap: true, robotsAllowed: true },
  { url: '/products/discontinued-earbuds', indexStatus: 'Not Indexed', inSitemap: true, robotsAllowed: true },
  { url: '/collections/clearance-2023', indexStatus: 'Blocked', inSitemap: true, robotsAllowed: false },
  { url: '/products/wireless-earbuds-v2-legacy', indexStatus: 'Error', inSitemap: true, robotsAllowed: true },
  { url: '/checkout/step-2', indexStatus: 'Noindex', inSitemap: false, robotsAllowed: true },
];

const statusBadgeClass: Record<IndexStatus, string> = {
  'Not Indexed': 'bg-critical-100 text-critical-700',
  Blocked: 'bg-critical-100 text-critical-700',
  Error: 'bg-critical-100 text-critical-700',
  Indexed: 'bg-success-100 text-success-700',
  Noindex: 'bg-surface-100 text-surface-700',
};

const indexStatusTextClass: Record<IndexStatus, string> = {
  'Not Indexed': 'text-critical-600',
  Blocked: 'text-critical-600',
  Error: 'text-critical-600',
  Indexed: 'text-success-600',
  Noindex: 'text-surface-600',
};

const filters = ['All', 'Not Indexed', 'Blocked', 'Error', 'Noindex', 'Indexed'];

export default function SitemapIndexabilityPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const sitemapIssues = priorityIssues.filter((i) => i.areaKey === 'sitemap');
  const totalIssues = sitemapIndexabilityData.notIndexed + sitemapIndexabilityData.blocked + sitemapIndexabilityData.errors;

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (filter !== 'All' && row.indexStatus !== filter) return false;
      if (search && !row.url.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [search, filter]);

  const opportunityFilterTarget: Record<string, string> = {
    'sitemap-opp-1': 'Not Indexed',
    'sitemap-opp-2': 'Blocked',
    'sitemap-opp-3': 'Error',
  };

  const opportunities: Opportunity[] = [
    {
      id: 'sitemap-opp-1',
      title: `Fix ${sitemapIndexabilityData.notIndexed} pages that should be indexed but aren't`,
      description: 'These pages are crawlable and in the sitemap, yet Google has not indexed them — check content quality and internal linking.',
      impact: 'High',
      effort: 'Medium',
      ctaLabel: 'Review Pages',
    },
    {
      id: 'sitemap-opp-2',
      title: `Unblock ${sitemapIndexabilityData.blocked} pages disallowed in robots.txt`,
      description: 'These pages are listed in the sitemap but blocked from crawling, preventing indexing entirely.',
      impact: 'High',
      effort: 'Low',
      ctaLabel: 'Review Blocked',
    },
    {
      id: 'sitemap-opp-3',
      title: `Resolve ${sitemapIndexabilityData.errors} crawl and index errors`,
      description: 'These pages returned errors during the last crawl attempt, blocking them from being indexed.',
      impact: 'Medium',
      effort: 'Medium',
      ctaLabel: 'Review Errors',
    },
  ];

  return (
    <div className="min-h-screen bg-surface-50">
      <SeoSubPillarHeader
        title="Sitemap & Indexability"
        description="Ensure all important pages are indexed by search engines."
        score={sitemapIndexabilityData.score}
        statusLabel="Excellent"
        stats={[
          { label: 'Analyzed', value: sitemapIndexabilityData.sitemapUrls },
          { label: 'Healthy', value: sitemapIndexabilityData.indexed },
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
              label="Not Indexed"
              value={sitemapIndexabilityData.notIndexed}
              description="pages should be indexed but are not appearing in search results"
              ctaLabel="Review Pages"
              onCta={() => setFilter('Not Indexed')}
            />
            <SeoMetricCard
              label="Blocked by Robots.txt"
              value={sitemapIndexabilityData.blocked}
              description="pages are disallowed from crawling, preventing indexing entirely"
              ctaLabel="Review Blocked"
              onCta={() => setFilter('Blocked')}
            />
            <SeoMetricCard
              label="Crawl & Index Errors"
              value={sitemapIndexabilityData.errors}
              description="pages returned errors during the last crawl attempt"
              ctaLabel="Review Errors"
              onCta={() => setFilter('Error')}
            />
            <SeoMetricCard
              label="Noindex Pages"
              value={sitemapIndexabilityData.noindex}
              description="pages are deliberately excluded from search results"
              footnote="Often intentional — filtered/paginated or internal pages"
              ctaLabel="Review Noindex"
              onCta={() => setFilter('Noindex')}
            />
            <SeoMetricCard
              label="Indexed Pages"
              value={sitemapIndexabilityData.indexed}
              description="pages are successfully indexed and eligible to rank"
              footnote={`${((sitemapIndexabilityData.indexed / sitemapIndexabilityData.sitemapUrls) * 100).toFixed(1)}% of sitemap URLs`}
              ctaLabel="View Indexed"
              onCta={() => setFilter('Indexed')}
            />
          </div>

          {/* Right Column - Health Breakdown */}
          <SeoHealthBreakdown
            title="Index Coverage Breakdown"
            total={sitemapIndexabilityData.sitemapUrls}
            items={[
              { label: 'Indexed', value: sitemapIndexabilityData.indexed, barClass: 'bg-green-500', dotClass: 'bg-green-500' },
              { label: 'Not Indexed', value: sitemapIndexabilityData.notIndexed, barClass: 'bg-red-500', dotClass: 'bg-red-500' },
              { label: 'Blocked', value: sitemapIndexabilityData.blocked, barClass: 'bg-red-400', dotClass: 'bg-red-400' },
              { label: 'Noindex', value: sitemapIndexabilityData.noindex, barClass: 'bg-gray-400', dotClass: 'bg-gray-400' },
            ]}
            footerNote={`${sitemapIndexabilityData.sitemapUrls.toLocaleString()} URLs in sitemap • ${sitemapIndexabilityData.errors} crawl errors • ${sitemapIndexabilityData.excludedPages} pages excluded via robots meta`}
          />
        </div>

        {/* Detected Issues */}
        {sitemapIssues.length > 0 && (
          <div className="bg-white border border-surface-200 rounded-lg shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-5 border-b border-surface-200">
              <h2 className="text-lg font-bold text-surface-900">Detected Issues</h2>
              <p className="text-xs text-surface-500 mt-1">{sitemapIssues.length} issue types found</p>
            </div>
            <div className="divide-y divide-surface-100">
              {sitemapIssues.map((issue) => (
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
                      <p className="text-sm text-surface-600 mt-1">{issue.affectedPages} pages affected</p>
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
            title="Page Indexability Status"
            subtitle="Search and filter pages by index status"
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by URL…"
            filters={filters}
            activeFilter={filter}
            onFilterChange={setFilter}
          >
            {filteredRows.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-surface-500">
                No pages match this filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-50 border-b border-surface-200">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-surface-700">Page URL</th>
                      <th className="px-6 py-3 text-center font-semibold text-surface-700">Index Status</th>
                      <th className="px-6 py-3 text-center font-semibold text-surface-700">In Sitemap</th>
                      <th className="px-6 py-3 text-center font-semibold text-surface-700">Robots.txt</th>
                      <th className="px-6 py-3 text-right font-semibold text-surface-700">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {filteredRows.map((row) => (
                      <tr key={row.url} className="hover:bg-surface-50 transition-colors">
                        <td className="px-6 py-3">
                          <p className="text-xs text-surface-500 font-mono">{row.url}</p>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span className={`text-xs font-medium ${indexStatusTextClass[row.indexStatus]}`}>
                            {row.indexStatus}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span className={`text-xs font-medium ${row.inSitemap ? 'text-success-700' : 'text-surface-500'}`}>
                            {row.inSitemap ? '✓ Yes' : '✗ No'}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span className={`text-xs font-medium ${row.robotsAllowed ? 'text-success-700' : 'text-critical-600'}`}>
                            {row.robotsAllowed ? '✓ Allow' : '✗ Disallow'}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <span className={`text-xs px-2 py-1 rounded font-medium ${statusBadgeClass[row.indexStatus]}`}>
                            {row.indexStatus}
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
