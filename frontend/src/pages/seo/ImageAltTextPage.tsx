import { useMemo, useState } from 'react';
import { imageAltTextData, priorityIssues } from '../../data/seo/seo-8pillars.mock';
import SeoSubPillarHeader from '../../components/seo/SeoSubPillarHeader';
import SeoMetricCard from '../../components/seo/SeoMetricCard';
import SeoHealthBreakdown from '../../components/seo/SeoHealthBreakdown';
import SeoTableCard from '../../components/seo/SeoTableCard';
import SeoOpportunityList, { type Opportunity } from '../../components/seo/SeoOpportunityList';

type AltStatus = 'Missing' | 'Weak' | 'Duplicate' | 'Good';

interface ImageRow {
  image: string;
  page: string;
  altText: string;
  status: AltStatus;
  issue: string;
  actionLabel: string;
}

const rows: ImageRow[] = [
  { image: 'product-earbuds-black.webp', page: '/wireless-earbuds-pro', altText: 'wireless earbuds', status: 'Good', issue: '—', actionLabel: 'Keep' },
  { image: 'product-earbuds-side.webp', page: '/wireless-earbuds-pro', altText: '', status: 'Missing', issue: 'No alt text', actionLabel: 'Add' },
  { image: 'IMG_4821.webp', page: '/noise-cancelling-headphones', altText: 'image', status: 'Weak', issue: 'Generic alt', actionLabel: 'Rewrite' },
  { image: 'product-red.webp', page: '/noise-cancelling-headphones', altText: 'headphones', status: 'Duplicate', issue: 'Repeated text', actionLabel: 'Update' },
  { image: 'banner-summer.webp', page: '/collections/new', altText: '', status: 'Missing', issue: 'No alt text', actionLabel: 'Add' },
  { image: 'product-speaker-front.webp', page: '/best-bluetooth-speakers', altText: 'Top Bluetooth speaker with 20-hour battery and IPX7 waterproof rating', status: 'Good', issue: '—', actionLabel: 'Keep' },
  { image: 'IMG_5190.webp', page: '/gaming-headset-guide', altText: 'photo', status: 'Weak', issue: 'Generic alt', actionLabel: 'Rewrite' },
];

const statusBadgeClass: Record<AltStatus, string> = {
  Missing: 'bg-critical-100 text-critical-700',
  Weak: 'bg-warning-100 text-warning-700',
  Duplicate: 'bg-warning-100 text-warning-700',
  Good: 'bg-success-100 text-success-700',
};

const filters = ['All', 'Missing', 'Weak', 'Duplicate', 'Good'];

export default function ImageAltTextPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const altIssues = priorityIssues.filter((i) => i.areaKey === 'image-alt-text');
  const needsImprovement = 200;
  const totalIssues = imageAltTextData.missing + imageAltTextData.empty + imageAltTextData.duplicate;

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (filter !== 'All' && row.status !== filter) return false;
      const haystack = `${row.image} ${row.page} ${row.altText}`.toLowerCase();
      if (search && !haystack.includes(search.toLowerCase())) return false;
      return true;
    });
  }, [search, filter]);

  const opportunityFilterTarget: Record<string, string> = {
    'alt-opp-1': 'Missing',
    'alt-opp-2': 'Weak',
    'alt-opp-3': 'Duplicate',
  };

  const opportunities: Opportunity[] = [
    {
      id: 'alt-opp-1',
      title: `Add descriptive alt text to ${imageAltTextData.missing} images`,
      description: 'Better image accessibility and improved image-search context.',
      impact: 'Medium',
      effort: 'Medium',
      ctaLabel: 'Review Images',
    },
    {
      id: 'alt-opp-2',
      title: `Replace generic alt text on ${needsImprovement} images`,
      description: 'Examples: "image", "photo", "product", "IMG_4821" — none of these help search or accessibility.',
      impact: 'High',
      effort: 'High',
      ctaLabel: 'Review',
    },
    {
      id: 'alt-opp-3',
      title: `Resolve ${imageAltTextData.duplicate} duplicate alt descriptions`,
      description: 'Make alt text unique and context-specific for each image.',
      impact: 'Medium',
      effort: 'Low',
      ctaLabel: 'View Duplicates',
    },
  ];

  return (
    <div className="min-h-screen bg-surface-50">
      <SeoSubPillarHeader
        title="Image Alt Text"
        description="Analyze image accessibility and SEO coverage across your store's product and content images."
        score={imageAltTextData.score}
        statusLabel="Good"
        stats={[
          { label: 'Images Analyzed', value: imageAltTextData.imagesAnalyzed },
          { label: 'Healthy', value: imageAltTextData.optimized },
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
              label="Missing Alt Text"
              value={imageAltTextData.missing}
              description="images have no alt text"
              footnote={`${((imageAltTextData.missing / imageAltTextData.imagesAnalyzed) * 100).toFixed(1)}% of analyzed images`}
              ctaLabel="View Images"
              onCta={() => setFilter('Missing')}
            />
            <SeoMetricCard
              label="Empty Alt Attribute"
              value={imageAltTextData.empty}
              description="images contain empty alt attributes"
              footnote={`${((imageAltTextData.empty / imageAltTextData.imagesAnalyzed) * 100).toFixed(1)}% of analyzed images`}
              ctaLabel="View Images"
              onCta={() => setFilter('Missing')}
            />
            <SeoMetricCard
              label="Duplicate Alt Text"
              value={imageAltTextData.duplicate}
              description="images use repeated descriptions"
              footnote={`${((imageAltTextData.duplicate / imageAltTextData.imagesAnalyzed) * 100).toFixed(1)}% of analyzed images`}
              ctaLabel="Review Duplicates"
              onCta={() => setFilter('Duplicate')}
            />
            <SeoMetricCard
              label="Needs Improvement"
              value={needsImprovement}
              description="images have weak or generic descriptions"
              footnote='Examples: "image", "product", "photo", "IMG_4821"'
              ctaLabel="Review Images"
              onCta={() => setFilter('Weak')}
            />
            <SeoMetricCard
              label="Optimized Images"
              value={imageAltTextData.optimized}
              description="images have descriptive alt text"
              footnote={`${((imageAltTextData.optimized / imageAltTextData.imagesAnalyzed) * 100).toFixed(1)}% coverage`}
              ctaLabel="View Optimized"
              onCta={() => setFilter('Good')}
            />
          </div>

          {/* Right Column - Health Breakdown */}
          <SeoHealthBreakdown
            title="Alt Text Health Breakdown"
            total={imageAltTextData.imagesAnalyzed}
            items={[
              { label: 'Optimized', value: imageAltTextData.optimized, barClass: 'bg-green-500', dotClass: 'bg-green-500' },
              { label: 'Missing', value: imageAltTextData.missing, barClass: 'bg-red-500', dotClass: 'bg-red-500' },
              { label: 'Empty', value: imageAltTextData.empty, barClass: 'bg-amber-500', dotClass: 'bg-amber-500' },
              { label: 'Duplicate', value: imageAltTextData.duplicate, barClass: 'bg-gray-400', dotClass: 'bg-gray-400' },
            ]}
            footerNote={`${imageAltTextData.imagesAnalyzed.toLocaleString()} images analyzed`}
          />
        </div>

        {/* Detected Issues */}
        {altIssues.length > 0 && (
          <div className="bg-white border border-surface-200 rounded-lg shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-5 border-b border-surface-200">
              <h2 className="text-lg font-bold text-surface-900">Detected Issues</h2>
              <p className="text-xs text-surface-500 mt-1">{altIssues.length} issue types found</p>
            </div>
            <div className="divide-y divide-surface-100">
              {altIssues.map((issue) => (
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
                      <p className="text-sm text-surface-600 mt-1">{issue.affectedPages} images affected</p>
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
            title="Image Analysis"
            subtitle="Search and filter images by alt text status"
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search images…"
            filters={filters}
            activeFilter={filter}
            onFilterChange={setFilter}
          >
            {filteredRows.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-surface-500">No images match this filter.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-50 border-b border-surface-200">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-surface-700">Image</th>
                      <th className="px-6 py-3 text-left font-semibold text-surface-700">Page</th>
                      <th className="px-6 py-3 text-left font-semibold text-surface-700">Current Alt Text</th>
                      <th className="px-6 py-3 text-center font-semibold text-surface-700">Status</th>
                      <th className="px-6 py-3 text-left font-semibold text-surface-700">Issue</th>
                      <th className="px-6 py-3 text-right font-semibold text-surface-700">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {filteredRows.map((row) => (
                      <tr key={row.image} className="hover:bg-surface-50 transition-colors">
                        <td className="px-6 py-4"><span className="text-xs text-surface-600 font-mono">{row.image}</span></td>
                        <td className="px-6 py-4"><span className="text-sm text-surface-900">{row.page}</span></td>
                        <td className="px-6 py-4">
                          <span className={row.altText ? 'text-sm text-surface-700' : 'text-sm text-surface-500 italic'}>
                            {row.altText ? `"${row.altText}"` : '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-xs px-2 py-1 rounded font-medium ${statusBadgeClass[row.status]}`}>{row.status}</span>
                        </td>
                        <td className="px-6 py-4"><span className="text-sm text-surface-600">{row.issue}</span></td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-sm font-medium text-brand-600 hover:text-brand-700">{row.actionLabel}</button>
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
