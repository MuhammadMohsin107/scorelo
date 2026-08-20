import { useMemo, useState } from 'react';
import { metaDescriptionsData, priorityIssues } from '../../data/seo/seo-8pillars.mock';
import SeoSubPillarHeader from '../../components/seo/SeoSubPillarHeader';
import SeoMetricCard from '../../components/seo/SeoMetricCard';
import SeoHealthBreakdown from '../../components/seo/SeoHealthBreakdown';
import SeoTableCard from '../../components/seo/SeoTableCard';
import SeoOpportunityList, { type Opportunity } from '../../components/seo/SeoOpportunityList';

interface MetaRow {
  url: string;
  description: string;
  isDuplicate?: boolean;
}

const rows: MetaRow[] = [
  {
    url: '/wireless-earbuds-pro',
    description: 'Shop premium wireless earbuds with active noise cancellation, 30-hour battery life, and crystal-clear sound. Free shipping over $50.',
  },
  {
    url: '/noise-cancelling-headphones',
    description: 'Discover the best noise cancelling headphones of 2024. Compare top models, read expert reviews, and find your perfect fit at Acme Store.',
  },
  { url: '/best-bluetooth-speakers', description: '' },
  { url: '/gaming-headset-guide', description: 'Buy a gaming headset.' },
  {
    url: '/home-audio-setup',
    description:
      'Complete Home Audio System Setup Guide — everything you need to know about receivers, speakers, subwoofers, wiring, room acoustics, calibration, and troubleshooting common setup issues for the best possible sound in any room.',
  },
  {
    url: '/portable-speaker-mini',
    description: 'Discover the best noise cancelling headphones of 2024. Compare top models, read expert reviews, and find your perfect fit at Acme Store.',
    isDuplicate: true,
  },
  { url: '/wireless-earbuds-black', description: '' },
  { url: '/over-ear-headphones-2024', description: 'Great over-ear headphones for everyday listening and calls.' },
];

function classify(row: MetaRow): 'Missing' | 'Duplicate' | 'Too Long' | 'Too Short' | 'Good' {
  if (!row.description) return 'Missing';
  if (row.isDuplicate) return 'Duplicate';
  if (row.description.length > 160) return 'Too Long';
  if (row.description.length < 120) return 'Too Short';
  return 'Good';
}

const statusBadgeClass: Record<string, string> = {
  Missing: 'bg-critical-100 text-critical-700',
  Duplicate: 'bg-critical-100 text-critical-700',
  'Too Long': 'bg-warning-100 text-warning-700',
  'Too Short': 'bg-warning-100 text-warning-700',
  Good: 'bg-success-100 text-success-700',
};

const filters = ['All', 'Missing', 'Duplicate', 'Too Long', 'Too Short', 'Good'];

export default function MetaDescriptionsPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const metaIssues = priorityIssues.filter((i) => i.areaKey === 'meta-descriptions');
  const totalIssues =
    metaDescriptionsData.missing + metaDescriptionsData.tooShort + metaDescriptionsData.tooLong + metaDescriptionsData.duplicate;

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const status = classify(row);
      if (filter !== 'All' && status !== filter) return false;
      if (search && !row.url.toLowerCase().includes(search.toLowerCase()) && !row.description.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [search, filter]);

  const opportunityFilterTarget: Record<string, string> = {
    'meta-opp-1': 'Missing',
    'meta-opp-2': 'Too Short',
    'meta-opp-3': 'Duplicate',
  };

  const opportunities: Opportunity[] = [
    {
      id: 'meta-opp-1',
      title: `Write meta descriptions for ${metaDescriptionsData.missing} pages`,
      description: 'Google auto-generates poor snippets for pages with no meta description, reducing click-through rate.',
      impact: 'High',
      effort: 'Medium',
      ctaLabel: 'Review Pages',
    },
    {
      id: 'meta-opp-2',
      title: `Expand ${metaDescriptionsData.tooShort} descriptions under 120 characters`,
      description: 'Short descriptions leave search real estate unused — expand with a clear benefit and call to action.',
      impact: 'Medium',
      effort: 'Low',
      ctaLabel: 'Review Descriptions',
    },
    {
      id: 'meta-opp-3',
      title: `Resolve ${metaDescriptionsData.duplicate} duplicate meta descriptions`,
      description: 'Give each page unique copy so search engines don’t treat them as near-duplicate content.',
      impact: 'Medium',
      effort: 'Low',
      ctaLabel: 'View Duplicates',
    },
  ];

  return (
    <div className="min-h-screen bg-surface-50">
      <SeoSubPillarHeader
        title="Meta Descriptions"
        description="Craft compelling meta descriptions to improve click-through rate and search snippet quality."
        score={metaDescriptionsData.score}
        statusLabel="Good"
        stats={[
          { label: 'Analyzed', value: metaDescriptionsData.pagesAnalyzed },
          { label: 'Healthy', value: metaDescriptionsData.optimized },
          { label: 'Issues', value: totalIssues },
        ]}
        lastAnalyzed="Today, 10:42 AM"
      />

      <div className="px-8 pb-8 max-w-7xl mx-auto">
        <div className="grid items-start lg:grid-cols-[0.8fr_1.2fr] gap-6 mb-8">
          {/* Left Column */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SeoMetricCard
              label="Missing Descriptions"
              value={metaDescriptionsData.missing}
              description="pages have no meta description"
              footnote={`${((metaDescriptionsData.missing / metaDescriptionsData.pagesAnalyzed) * 100).toFixed(1)}% of analyzed pages`}
              ctaLabel="View Pages"
              onCta={() => setFilter('Missing')}
            />
            <SeoMetricCard
              label="Too Short"
              value={metaDescriptionsData.tooShort}
              description="descriptions are under 120 characters"
              footnote="Recommended: 120-160 characters"
              ctaLabel="Review Descriptions"
              onCta={() => setFilter('Too Short')}
            />
            <SeoMetricCard
              label="Too Long"
              value={metaDescriptionsData.tooLong}
              description="descriptions exceed 160 characters and truncate in search results"
              footnote="Recommended: 120-160 characters"
              ctaLabel="Review Descriptions"
              onCta={() => setFilter('Too Long')}
            />
            <SeoMetricCard
              label="Duplicate Descriptions"
              value={metaDescriptionsData.duplicate}
              description="pages share the same meta description"
              footnote={`${((metaDescriptionsData.duplicate / metaDescriptionsData.pagesAnalyzed) * 100).toFixed(1)}% of analyzed pages`}
              ctaLabel="View Duplicates"
              onCta={() => setFilter('Duplicate')}
            />
            <SeoMetricCard
              label="CTR Opportunity"
              value={metaDescriptionsData.ctrImpact}
              description="estimated click-through rate lift once fixes ship"
              ctaLabel="View Optimized"
              onCta={() => setFilter('Good')}
            />
          </div>

          {/* Right Column */}
          <SeoHealthBreakdown
            title="Description Health Breakdown"
            total={metaDescriptionsData.pagesAnalyzed}
            items={[
              { label: 'Optimized', value: metaDescriptionsData.optimized, barClass: 'bg-green-500', dotClass: 'bg-green-500' },
              { label: 'Too Short', value: metaDescriptionsData.tooShort, barClass: 'bg-amber-400', dotClass: 'bg-amber-400' },
              { label: 'Too Long', value: metaDescriptionsData.tooLong, barClass: 'bg-amber-500', dotClass: 'bg-amber-500' },
              { label: 'Missing', value: metaDescriptionsData.missing, barClass: 'bg-red-500', dotClass: 'bg-red-500' },
              { label: 'Duplicate', value: metaDescriptionsData.duplicate, barClass: 'bg-gray-400', dotClass: 'bg-gray-400' },
            ]}
            footerNote={`${metaDescriptionsData.pagesAnalyzed.toLocaleString()} pages analyzed • average length ${metaDescriptionsData.averageLength} characters`}
          />
        </div>

        {/* Detected Issues */}
        {metaIssues.length > 0 && (
          <div className="bg-white border border-surface-200 rounded-lg shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-5 border-b border-surface-200">
              <h2 className="text-lg font-bold text-surface-900">Detected Issues</h2>
              <p className="text-xs text-surface-500 mt-1">{metaIssues.length} issue types found</p>
            </div>
            <div className="divide-y divide-surface-100">
              {metaIssues.map((issue) => (
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
            title="Meta Description Analysis"
            subtitle="Search and filter pages by meta description status"
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by URL or description…"
            filters={filters}
            activeFilter={filter}
            onFilterChange={setFilter}
          >
            {filteredRows.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-surface-500">No pages match this filter.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-50 border-b border-surface-200">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-surface-700">Page URL</th>
                      <th className="px-6 py-3 text-left font-semibold text-surface-700">Meta Description</th>
                      <th className="px-6 py-3 text-center font-semibold text-surface-700">Length</th>
                      <th className="px-6 py-3 text-right font-semibold text-surface-700">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {filteredRows.map((row) => {
                      const status = classify(row);
                      return (
                        <tr key={row.url} className="hover:bg-surface-50 transition-colors">
                          <td className="px-6 py-3">
                            <p className="text-xs text-surface-500 font-mono">{row.url}</p>
                          </td>
                          <td className="px-6 py-3 max-w-md">
                            <p className={`text-xs line-clamp-1 ${row.description ? 'text-surface-700' : 'text-surface-400 italic'}`}>
                              {row.description || '— no meta description —'}
                            </p>
                          </td>
                          <td className="px-6 py-3 text-center">
                            <span className="text-xs font-medium text-surface-700">{row.description.length} chars</span>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span className={`text-xs px-2 py-1 rounded font-medium ${statusBadgeClass[status]}`}>{status}</span>
                          </td>
                        </tr>
                      );
                    })}
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
