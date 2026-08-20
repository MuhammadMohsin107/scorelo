import { useMemo, useState } from 'react';
import { internalLinksData, priorityIssues } from '../../data/seo/seo-8pillars.mock';
import SeoSubPillarHeader from '../../components/seo/SeoSubPillarHeader';
import SeoMetricCard from '../../components/seo/SeoMetricCard';
import SeoHealthBreakdown from '../../components/seo/SeoHealthBreakdown';
import SeoTableCard from '../../components/seo/SeoTableCard';
import SeoOpportunityList, { type Opportunity } from '../../components/seo/SeoOpportunityList';

type LinkStatus = 'Orphan' | '404' | 'Broken' | 'Opportunity' | 'Healthy';

interface LinkRow {
  url: string;
  inboundLinks: number;
  brokenLinks: number;
  impact: 'High' | 'Medium' | 'Low';
  status: LinkStatus;
}

const rows: LinkRow[] = [
  { url: '/wireless-earbuds-pro', inboundLinks: 24, brokenLinks: 0, impact: 'Low', status: 'Healthy' },
  { url: '/noise-cancelling-headphones', inboundLinks: 31, brokenLinks: 0, impact: 'Low', status: 'Healthy' },
  { url: '/best-bluetooth-speakers', inboundLinks: 18, brokenLinks: 0, impact: 'Low', status: 'Healthy' },
  { url: '/products/discontinued-earbuds-mini', inboundLinks: 0, brokenLinks: 0, impact: 'High', status: 'Orphan' },
  { url: '/products/limited-edition-charging-case', inboundLinks: 0, brokenLinks: 0, impact: 'Medium', status: 'Orphan' },
  { url: '/products/legacy-speaker-dock', inboundLinks: 6, brokenLinks: 6, impact: 'High', status: '404' },
  { url: '/blogs/audio-buying-guide', inboundLinks: 42, brokenLinks: 1, impact: 'Medium', status: 'Broken' },
  { url: '/collections/gaming-audio', inboundLinks: 3, brokenLinks: 0, impact: 'High', status: 'Opportunity' },
];

const statusBadgeClass: Record<LinkStatus, string> = {
  Orphan: 'bg-critical-100 text-critical-700',
  '404': 'bg-critical-100 text-critical-700',
  Broken: 'bg-critical-100 text-critical-700',
  Opportunity: 'bg-info-100 text-info-700',
  Healthy: 'bg-success-100 text-success-700',
};

const filters = ['All', 'Orphan', '404', 'Broken', 'Opportunity', 'Healthy'];

export default function InternalLinks404sPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const linkIssues = priorityIssues.filter((i) => i.areaKey === 'internal-links');
  const healthyPages = internalLinksData.pagesAnalyzed - internalLinksData.orphanPages - internalLinksData.notFoundPages;
  const totalIssues = internalLinksData.orphanPages + internalLinksData.notFoundPages + internalLinksData.brokenLinks;

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (filter !== 'All' && row.status !== filter) return false;
      if (search && !row.url.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [search, filter]);

  const opportunityFilterTarget: Record<string, string> = {
    'links-opp-1': 'Orphan',
    'links-opp-2': 'Broken',
    'links-opp-3': '404',
  };

  const opportunities: Opportunity[] = [
    {
      id: 'links-opp-1',
      title: `Add internal links to ${internalLinksData.orphanPages} orphan pages`,
      description: 'Orphan pages have no internal links pointing to them, making them nearly impossible for users and crawlers to discover.',
      impact: 'High',
      effort: 'Medium',
      ctaLabel: 'Review Orphans',
    },
    {
      id: 'links-opp-2',
      title: `Fix ${internalLinksData.brokenLinks} broken internal links`,
      description: 'Broken links waste crawl budget and create dead ends in the customer journey.',
      impact: 'High',
      effort: 'Low',
      ctaLabel: 'Review Broken Links',
    },
    {
      id: 'links-opp-3',
      title: `Resolve ${internalLinksData.notFoundPages} pages returning 404 errors`,
      description: 'Pages that return Not Found errors but are still linked to internally erode link equity and user trust.',
      impact: 'Medium',
      effort: 'Low',
      ctaLabel: 'Review 404s',
    },
  ];

  return (
    <div className="min-h-screen bg-surface-50">
      <SeoSubPillarHeader
        title="Internal Links & 404s"
        description="Optimize internal linking structure, surface orphan pages, and fix broken links for better crawlability."
        score={internalLinksData.score}
        statusLabel="Good"
        stats={[
          { label: 'Analyzed', value: internalLinksData.pagesAnalyzed },
          { label: 'Healthy', value: healthyPages },
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
              label="Orphan Pages"
              value={internalLinksData.orphanPages}
              description="pages have zero internal links pointing to them, making them hard to discover"
              ctaLabel="Review Orphans"
              onCta={() => setFilter('Orphan')}
            />
            <SeoMetricCard
              label="404 Pages"
              value={internalLinksData.notFoundPages}
              description="pages return Not Found errors but are still linked to internally"
              ctaLabel="Review 404s"
              onCta={() => setFilter('404')}
            />
            <SeoMetricCard
              label="Broken Internal Links"
              value={internalLinksData.brokenLinks}
              description="links point to a URL that no longer resolves"
              ctaLabel="Review Broken Links"
              onCta={() => setFilter('Broken')}
            />
            <SeoMetricCard
              label="Link Opportunities"
              value={internalLinksData.linkOpportunities}
              description="high-relevance pages that could benefit from additional internal links"
              footnote="Estimated impact: improved crawl depth and authority flow"
              ctaLabel="View Opportunities"
              onCta={() => setFilter('Opportunity')}
            />
            <SeoMetricCard
              label="Healthy Pages"
              value={healthyPages}
              description="pages have a healthy number of internal links and are easily discoverable"
              footnote={`average ${internalLinksData.averageLinksPerPage} links per page`}
              ctaLabel="View Healthy Pages"
              onCta={() => setFilter('Healthy')}
            />
          </div>

          {/* Right Column - Health Breakdown */}
          <SeoHealthBreakdown
            title="Internal Link Health Breakdown"
            total={internalLinksData.pagesAnalyzed}
            items={[
              { label: 'Healthy Pages', value: healthyPages, barClass: 'bg-green-500', dotClass: 'bg-green-500' },
              { label: 'Orphan Pages', value: internalLinksData.orphanPages, barClass: 'bg-amber-500', dotClass: 'bg-amber-500' },
              { label: '404 Pages', value: internalLinksData.notFoundPages, barClass: 'bg-red-500', dotClass: 'bg-red-500' },
            ]}
            footerNote={`${internalLinksData.pagesAnalyzed.toLocaleString()} pages analyzed • average ${internalLinksData.averageLinksPerPage} internal links per page`}
          />
        </div>

        {/* Detected Issues */}
        {linkIssues.length > 0 && (
          <div className="bg-white border border-surface-200 rounded-lg shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-5 border-b border-surface-200">
              <h2 className="text-lg font-bold text-surface-900">Detected Issues</h2>
              <p className="text-xs text-surface-500 mt-1">{linkIssues.length} issue types found</p>
            </div>
            <div className="divide-y divide-surface-100">
              {linkIssues.map((issue) => (
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
            title="Internal Linking Analysis"
            subtitle="Search and filter pages by link health"
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
                      <th className="px-6 py-3 text-center font-semibold text-surface-700">Inbound Links</th>
                      <th className="px-6 py-3 text-center font-semibold text-surface-700">Broken Links</th>
                      <th className="px-6 py-3 text-center font-semibold text-surface-700">Impact</th>
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
                          <span className="text-xs font-medium text-surface-700">{row.inboundLinks}</span>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span className={`text-xs font-medium ${row.brokenLinks > 0 ? 'text-critical-600' : 'text-surface-700'}`}>
                            {row.brokenLinks}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span className="text-xs text-surface-600">{row.impact}</span>
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
