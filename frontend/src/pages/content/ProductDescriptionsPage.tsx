import { useMemo, useState } from 'react';
import { productDescriptionsData, priorityIssues, statusLabelForScore } from '../../data/content/content.mock';
import PillarSubHeader from '../../components/pillars/PillarSubHeader';
import PillarMetricCard from '../../components/pillars/PillarMetricCard';
import PillarHealthBreakdown from '../../components/pillars/PillarHealthBreakdown';
import PillarTableCard from '../../components/pillars/PillarTableCard';
import PillarOpportunityList, { type Opportunity } from '../../components/pillars/PillarOpportunityList';

interface ProductRow {
  product: string;
  description: string;
  wordCount: number;
  isDuplicate?: boolean;
  needsImprovement?: boolean;
}

const rows: ProductRow[] = [
  {
    product: 'Wireless Earbuds Pro',
    description:
      'Experience studio-quality sound with the Wireless Earbuds Pro. Featuring active noise cancellation, a 30-hour battery with the charging case, and a sweat-resistant IPX5 rating built for daily workouts and commutes.',
    wordCount: 38,
  },
  { product: 'Wireless Earbuds - Black', description: '', wordCount: 0 },
  { product: 'Wireless Earbuds - White', description: '', wordCount: 0 },
  { product: 'Bluetooth Speaker Mini', description: 'Compact speaker.', wordCount: 2 },
  { product: 'Portable Speaker XL', description: 'Great sound.', wordCount: 2 },
  {
    product: 'Noise Cancelling Headphones Studio',
    description:
      'Immerse yourself in premium audio with adaptive noise cancellation, plush memory-foam ear cushions, and up to 40 hours of battery life for all-day listening.',
    wordCount: 24,
  },
  {
    product: 'Noise Cancelling Headphones X2',
    description:
      'Immerse yourself in premium audio with adaptive noise cancellation, plush memory-foam ear cushions, and up to 40 hours of battery life for all-day listening.',
    wordCount: 24,
    isDuplicate: true,
  },
  {
    product: 'Gaming Headset Pro Max Wireless RGB',
    description: 'This product is a great gaming headset. It has good sound and is comfortable to wear for long gaming sessions.',
    wordCount: 20,
    needsImprovement: true,
  },
  {
    product: 'Gaming Headset Surround 7.1',
    description: 'This product is a great gaming headset for competitive players. It has good sound quality.',
    wordCount: 16,
    needsImprovement: true,
  },
  {
    product: 'Home Theater Soundbar 5.1',
    description:
      'Transform movie nights with deep, room-filling bass and crystal-clear dialogue clarity, powered by dual subwoofers and wireless rear surround speakers for true theater immersion at home.',
    wordCount: 27,
  },
];

function classify(row: ProductRow): 'Missing' | 'Duplicate' | 'Needs Improvement' | 'Too Short' | 'Good' {
  if (!row.description) return 'Missing';
  if (row.isDuplicate) return 'Duplicate';
  if (row.needsImprovement) return 'Needs Improvement';
  if (row.wordCount < 20) return 'Too Short';
  return 'Good';
}

const statusBadgeClass: Record<string, string> = {
  Missing: 'bg-critical-100 text-critical-700',
  Duplicate: 'bg-critical-100 text-critical-700',
  'Needs Improvement': 'bg-warning-100 text-warning-700',
  'Too Short': 'bg-warning-100 text-warning-700',
  Good: 'bg-success-100 text-success-700',
};

const filters = ['All', 'Missing', 'Duplicate', 'Needs Improvement', 'Too Short', 'Good'];

export default function ProductDescriptionsPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const areaIssues = priorityIssues.filter((i) => i.areaKey === 'product-descriptions');
  const totalIssues =
    productDescriptionsData.missing +
    productDescriptionsData.tooShort +
    productDescriptionsData.duplicate +
    productDescriptionsData.needsImprovement;

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const status = classify(row);
      if (filter !== 'All' && status !== filter) return false;
      if (search && !row.product.toLowerCase().includes(search.toLowerCase()) && !row.description.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [search, filter]);

  const opportunityFilterTarget: Record<string, string> = {
    'pd-opp-1': 'Missing',
    'pd-opp-2': 'Too Short',
    'pd-opp-3': 'Duplicate',
  };

  const opportunities: Opportunity[] = [
    {
      id: 'pd-opp-1',
      title: `Write descriptions for ${productDescriptionsData.missing} products with none`,
      description: 'Every product needs unique copy that covers features, benefits, and use cases to convert and rank.',
      impact: 'High',
      effort: 'Medium',
      ctaLabel: 'Review Products',
    },
    {
      id: 'pd-opp-2',
      title: `Expand ${productDescriptionsData.tooShort} descriptions under the recommended length`,
      description: 'Thin descriptions underperform in organic search and give shoppers too little to act on.',
      impact: 'Medium',
      effort: 'Medium',
      ctaLabel: 'Review Descriptions',
    },
    {
      id: 'pd-opp-3',
      title: `Resolve ${productDescriptionsData.duplicate} duplicate product descriptions`,
      description: 'Color and size variants sharing identical copy dilute uniqueness and confuse search indexing.',
      impact: 'High',
      effort: 'Low',
      ctaLabel: 'View Duplicates',
    },
  ];

  return (
    <div className="min-h-screen bg-surface-50">
      <PillarSubHeader
        title="Product Descriptions"
        description="Analyze product description coverage, depth, uniqueness, and optimization opportunities across your catalog."
        score={productDescriptionsData.score}
        statusLabel={statusLabelForScore(productDescriptionsData.score)}
        stats={[
          { label: 'Analyzed', value: productDescriptionsData.productsAnalyzed },
          { label: 'Healthy', value: productDescriptionsData.optimized },
          { label: 'Issues', value: totalIssues },
        ]}
        lastAnalyzed="Today, 10:42 AM"
        backHref="/content"
        backLabel="Back to Content Overview"
      />

      <div className="px-8 pb-8 max-w-7xl mx-auto">
        {/* Two Column */}
        <div className="grid items-start lg:grid-cols-[0.8fr_1.2fr] gap-6 mb-8">
          {/* Left Column - Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PillarMetricCard
              label="Missing Descriptions"
              value={productDescriptionsData.missing}
              description="products have no description at all"
              footnote={`${((productDescriptionsData.missing / productDescriptionsData.productsAnalyzed) * 100).toFixed(1)}% of analyzed products`}
              ctaLabel="View Products"
              onCta={() => setFilter('Missing')}
            />
            <PillarMetricCard
              label="Too Short"
              value={productDescriptionsData.tooShort}
              description="descriptions fall under 20 words, offering little context"
              footnote={`Recommended: ${productDescriptionsData.recommendedWordCount}`}
              ctaLabel="Review Descriptions"
              onCta={() => setFilter('Too Short')}
            />
            <PillarMetricCard
              label="Duplicate Descriptions"
              value={productDescriptionsData.duplicate}
              description="products share the same description as another SKU"
              footnote={`${((productDescriptionsData.duplicate / productDescriptionsData.productsAnalyzed) * 100).toFixed(1)}% of analyzed products`}
              ctaLabel="View Duplicates"
              onCta={() => setFilter('Duplicate')}
            />
            <PillarMetricCard
              label="Needs Improvement"
              value={productDescriptionsData.needsImprovement}
              description="descriptions are generic or templated and underperform"
              footnote="Flagged for thin or boilerplate wording"
              ctaLabel="Review Products"
              onCta={() => setFilter('Needs Improvement')}
            />
            <PillarMetricCard
              label="Optimized Descriptions"
              value={productDescriptionsData.optimized}
              description="descriptions are unique, complete, and well-sized"
              footnote={`${((productDescriptionsData.optimized / productDescriptionsData.productsAnalyzed) * 100).toFixed(1)}% coverage`}
              ctaLabel="View Optimized"
              onCta={() => setFilter('Good')}
            />
          </div>

          {/* Right Column - Health Breakdown */}
          <PillarHealthBreakdown
            title="Product Description Health Breakdown"
            total={productDescriptionsData.productsAnalyzed}
            items={[
              { label: 'Optimized', value: productDescriptionsData.optimized, barClass: 'bg-green-500', dotClass: 'bg-green-500' },
              { label: 'Needs Improvement', value: productDescriptionsData.needsImprovement, barClass: 'bg-amber-500', dotClass: 'bg-amber-500' },
              { label: 'Too Short', value: productDescriptionsData.tooShort, barClass: 'bg-amber-400', dotClass: 'bg-amber-400' },
              { label: 'Missing', value: productDescriptionsData.missing, barClass: 'bg-red-500', dotClass: 'bg-red-500' },
              { label: 'Duplicate', value: productDescriptionsData.duplicate, barClass: 'bg-gray-400', dotClass: 'bg-gray-400' },
            ]}
            footerNote={`${productDescriptionsData.productsAnalyzed.toLocaleString()} products analyzed • average description length ${productDescriptionsData.averageWordCount} words`}
          />
        </div>

        {/* Detected Issues */}
        {areaIssues.length > 0 && (
          <div className="bg-white border border-surface-200 rounded-lg shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-5 border-b border-surface-200">
              <h2 className="text-lg font-bold text-surface-900">Detected Issues</h2>
              <p className="text-xs text-surface-500 mt-1">{areaIssues.length} issue types found</p>
            </div>
            <div className="divide-y divide-surface-100">
              {areaIssues.map((issue) => (
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
                      <p className="text-sm text-surface-600 mt-1">{issue.affected} products affected</p>
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
          <PillarTableCard
            title="Product Description Analysis"
            subtitle="Search and filter products by description status"
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by product name or description…"
            filters={filters}
            activeFilter={filter}
            onFilterChange={setFilter}
          >
            {filteredRows.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-surface-500">
                No products match this filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-50 border-b border-surface-200">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-surface-700">Product</th>
                      <th className="px-6 py-3 text-left font-semibold text-surface-700">Description</th>
                      <th className="px-6 py-3 text-center font-semibold text-surface-700">Word Count</th>
                      <th className="px-6 py-3 text-left font-semibold text-surface-700">Issue</th>
                      <th className="px-6 py-3 text-right font-semibold text-surface-700">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {filteredRows.map((row) => {
                      const status = classify(row);
                      return (
                        <tr key={row.product} className="hover:bg-surface-50 transition-colors">
                          <td className="px-6 py-3">
                            <p className="text-xs font-medium text-surface-900">{row.product}</p>
                          </td>
                          <td className="px-6 py-3 max-w-xs">
                            <p className={`text-xs line-clamp-1 ${row.description ? 'text-surface-600' : 'text-surface-400 italic'}`}>
                              {row.description || '— no description —'}
                            </p>
                          </td>
                          <td className="px-6 py-3 text-center">
                            <span className="text-xs font-medium text-surface-700">{row.wordCount} words</span>
                          </td>
                          <td className="px-6 py-3">
                            <span className="text-xs text-surface-600">
                              {status === 'Good' ? 'None — meets guidelines' : `Recommendation: ${
                                status === 'Missing'
                                  ? 'add unique product copy'
                                  : status === 'Duplicate'
                                    ? 'de-duplicate against source product'
                                    : status === 'Too Short'
                                      ? 'expand to 60+ words'
                                      : 'rewrite generic phrasing'
                              }`}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span className={`text-xs px-2 py-1 rounded font-medium ${statusBadgeClass[status]}`}>
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </PillarTableCard>
        </div>

        {/* Optimization Opportunities */}
        <PillarOpportunityList
          opportunities={opportunities}
          onSelect={(opp) => setFilter(opportunityFilterTarget[opp.id] ?? 'All')}
        />
      </div>
    </div>
  );
}
