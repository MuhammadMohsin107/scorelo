import { useMemo, useState } from 'react';
import { canonicalsDuplicatesData, priorityIssues } from '../../data/seo/seo-8pillars.mock';
import SeoSubPillarHeader from '../../components/seo/SeoSubPillarHeader';
import SeoMetricCard from '../../components/seo/SeoMetricCard';
import SeoHealthBreakdown from '../../components/seo/SeoHealthBreakdown';
import SeoTableCard from '../../components/seo/SeoTableCard';
import SeoOpportunityList, { type Opportunity } from '../../components/seo/SeoOpportunityList';

type CanonicalStatus = 'Conflict' | 'Duplicate' | 'Missing' | 'Valid';

interface CanonicalRow {
  primaryUrl: string;
  variantUrl: string;
  canonicalTarget: string;
  status: CanonicalStatus;
}

const rows: CanonicalRow[] = [
  {
    primaryUrl: '/wireless-earbuds-pro',
    variantUrl: '/wireless-earbuds-pro?color=black',
    canonicalTarget: '/wireless-earbuds-pro?color=black',
    status: 'Conflict',
  },
  {
    primaryUrl: '/best-bluetooth-speakers',
    variantUrl: '/best-bluetooth-speakers?sort=price',
    canonicalTarget: '/best-bluetooth-speakers?sort=price',
    status: 'Conflict',
  },
  {
    primaryUrl: '/gaming-headset-guide',
    variantUrl: '/gaming-headset-guide/',
    canonicalTarget: '/gaming-headset-guide',
    status: 'Duplicate',
  },
  {
    primaryUrl: '/collections/headphones',
    variantUrl: '/collections/headphones?filter=wireless',
    canonicalTarget: '/collections/headphones',
    status: 'Duplicate',
  },
  {
    primaryUrl: '/home-audio-setup',
    variantUrl: '—',
    canonicalTarget: '—',
    status: 'Missing',
  },
  {
    primaryUrl: '/portable-speaker-mini',
    variantUrl: '—',
    canonicalTarget: '—',
    status: 'Missing',
  },
  {
    primaryUrl: '/noise-cancelling-headphones',
    variantUrl: '—',
    canonicalTarget: '/noise-cancelling-headphones',
    status: 'Valid',
  },
  {
    primaryUrl: '/wireless-earbuds-black',
    variantUrl: '—',
    canonicalTarget: '/wireless-earbuds-black',
    status: 'Valid',
  },
];

const statusBadgeClass: Record<CanonicalStatus, string> = {
  Conflict: 'bg-critical-100 text-critical-700',
  Missing: 'bg-critical-100 text-critical-700',
  Duplicate: 'bg-warning-100 text-warning-700',
  Valid: 'bg-success-100 text-success-700',
};

const filters = ['All', 'Conflict', 'Duplicate', 'Missing', 'Valid'];

export default function CanonicalsDuplicatesPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const canonicalIssues = priorityIssues.filter((i) => i.areaKey === 'canonicals');
  const totalIssues =
    canonicalsDuplicatesData.duplicateUrls + canonicalsDuplicatesData.canonicalConflicts + canonicalsDuplicatesData.missingCanonicals;

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (filter !== 'All' && row.status !== filter) return false;
      if (
        search &&
        !row.primaryUrl.toLowerCase().includes(search.toLowerCase()) &&
        !row.variantUrl.toLowerCase().includes(search.toLowerCase()) &&
        !row.canonicalTarget.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [search, filter]);

  const opportunityFilterTarget: Record<string, string> = {
    'canonical-opp-1': 'Conflict',
    'canonical-opp-2': 'Duplicate',
    'canonical-opp-3': 'Missing',
  };

  const opportunities: Opportunity[] = [
    {
      id: 'canonical-opp-1',
      title: `Resolve ${canonicalsDuplicatesData.canonicalConflicts} canonical conflicts`,
      description: 'Conflicting canonical targets split ranking signals across near-identical URLs.',
      impact: 'High',
      effort: 'Medium',
      ctaLabel: 'Review Conflicts',
    },
    {
      id: 'canonical-opp-2',
      title: `Fix ${canonicalsDuplicatesData.duplicateUrls} duplicate URL variants`,
      description: 'Consolidate parameterized, trailing-slash, and sorted URL variants onto a single canonical version.',
      impact: 'Medium',
      effort: 'Low',
      ctaLabel: 'View Duplicates',
    },
    {
      id: 'canonical-opp-3',
      title: `Add canonical tags to ${canonicalsDuplicatesData.missingCanonicals} pages`,
      description: 'Pages with no canonical tag leave search engines to guess which version should rank.',
      impact: 'Medium',
      effort: 'Low',
      ctaLabel: 'View Pages',
    },
  ];

  return (
    <div className="min-h-screen bg-surface-50">
      <SeoSubPillarHeader
        title="Canonicals & Duplicates"
        description="Prevent duplicate content issues by ensuring every URL points to the correct canonical version."
        score={canonicalsDuplicatesData.score}
        statusLabel="Excellent"
        stats={[
          { label: 'Analyzed', value: canonicalsDuplicatesData.urlsAnalyzed },
          { label: 'Healthy', value: canonicalsDuplicatesData.validCanonicals },
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
              label="Canonical Conflicts"
              value={canonicalsDuplicatesData.canonicalConflicts}
              description="URLs point to conflicting canonical targets, splitting ranking signals"
              ctaLabel="Review Conflicts"
              onCta={() => setFilter('Conflict')}
            />
            <SeoMetricCard
              label="Duplicate URLs"
              value={canonicalsDuplicatesData.duplicateUrls}
              description="URL variants (parameters, trailing slashes, sorting) return near-identical content"
              ctaLabel="View Duplicates"
              onCta={() => setFilter('Duplicate')}
            />
            <SeoMetricCard
              label="Missing Canonicals"
              value={canonicalsDuplicatesData.missingCanonicals}
              description="pages have no canonical tag at all"
              ctaLabel="View Pages"
              onCta={() => setFilter('Missing')}
            />
            <SeoMetricCard
              label="Valid Canonicals"
              value={canonicalsDuplicatesData.validCanonicals}
              description="URLs have correct, self-referencing canonical tags"
              footnote={`${((canonicalsDuplicatesData.validCanonicals / canonicalsDuplicatesData.urlsAnalyzed) * 100).toFixed(1)}% of analyzed URLs`}
              ctaLabel="View Valid"
              onCta={() => setFilter('Valid')}
            />
          </div>

          {/* Right Column - Health Breakdown */}
          <SeoHealthBreakdown
            title="Canonical Health Breakdown"
            total={canonicalsDuplicatesData.urlsAnalyzed}
            items={[
              { label: 'Valid', value: canonicalsDuplicatesData.validCanonicals, barClass: 'bg-green-500', dotClass: 'bg-green-500' },
              { label: 'Conflicts', value: canonicalsDuplicatesData.canonicalConflicts, barClass: 'bg-red-500', dotClass: 'bg-red-500' },
              { label: 'Duplicate', value: canonicalsDuplicatesData.duplicateUrls, barClass: 'bg-amber-500', dotClass: 'bg-amber-500' },
              { label: 'Missing', value: canonicalsDuplicatesData.missingCanonicals, barClass: 'bg-red-400', dotClass: 'bg-red-400' },
            ]}
            footerNote={`${canonicalsDuplicatesData.urlsAnalyzed.toLocaleString()} URLs analyzed • ${canonicalsDuplicatesData.selfReferencingCanonical.toLocaleString()} self-referencing canonicals confirmed`}
          />
        </div>

        {/* Detected Issues */}
        {canonicalIssues.length > 0 && (
          <div className="bg-white border border-surface-200 rounded-lg shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-5 border-b border-surface-200">
              <h2 className="text-lg font-bold text-surface-900">Detected Issues</h2>
              <p className="text-xs text-surface-500 mt-1">{canonicalIssues.length} issue types found</p>
            </div>
            <div className="divide-y divide-surface-100">
              {canonicalIssues.map((issue) => (
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
            title="Duplicate & Canonical URL Groups"
            subtitle="Search and filter URLs by canonical status"
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by URL…"
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
                      <th className="px-6 py-3 text-left font-semibold text-surface-700">Primary URL</th>
                      <th className="px-6 py-3 text-left font-semibold text-surface-700">Variant / Duplicate URL</th>
                      <th className="px-6 py-3 text-left font-semibold text-surface-700">Canonical Target</th>
                      <th className="px-6 py-3 text-right font-semibold text-surface-700">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {filteredRows.map((row) => (
                      <tr key={row.primaryUrl} className="hover:bg-surface-50 transition-colors">
                        <td className="px-6 py-3">
                          <p className="text-xs text-surface-500 font-mono">{row.primaryUrl}</p>
                        </td>
                        <td className="px-6 py-3">
                          <p className={`text-xs font-mono ${row.variantUrl !== '—' ? 'text-surface-700' : 'text-surface-400 italic'}`}>
                            {row.variantUrl}
                          </p>
                        </td>
                        <td className="px-6 py-3">
                          <p className={`text-xs font-mono ${row.canonicalTarget !== '—' ? 'text-surface-700' : 'text-surface-400 italic'}`}>
                            {row.canonicalTarget}
                          </p>
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
