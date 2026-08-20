import { useMemo, useState } from 'react';
import { schemaJsonLdData, priorityIssues } from '../../data/seo/seo-8pillars.mock';
import SeoSubPillarHeader from '../../components/seo/SeoSubPillarHeader';
import SeoMetricCard from '../../components/seo/SeoMetricCard';
import SeoHealthBreakdown from '../../components/seo/SeoHealthBreakdown';
import SeoTableCard from '../../components/seo/SeoTableCard';
import SeoOpportunityList, { type Opportunity } from '../../components/seo/SeoOpportunityList';

interface SchemaRow {
  url: string;
  types: string[];
  errors: number;
  warnings: number;
}

const rows: SchemaRow[] = [
  { url: '/wireless-earbuds-pro', types: ['Product', 'BreadcrumbList', 'Review'], errors: 0, warnings: 0 },
  { url: '/noise-cancelling-headphones', types: ['Product', 'BreadcrumbList'], errors: 1, warnings: 0 },
  { url: '/best-bluetooth-speakers', types: ['Product', 'BreadcrumbList', 'FAQPage'], errors: 0, warnings: 1 },
  { url: '/gaming-headset-guide', types: [], errors: 0, warnings: 0 },
  { url: '/home-audio-setup', types: ['BreadcrumbList'], errors: 0, warnings: 0 },
  { url: '/wireless-earbuds-black', types: [], errors: 0, warnings: 0 },
  { url: '/portable-speaker-mini', types: ['Product', 'BreadcrumbList', 'Review'], errors: 0, warnings: 1 },
  { url: '/over-ear-headphones-2024', types: ['Product', 'BreadcrumbList'], errors: 2, warnings: 0 },
];

function classify(row: SchemaRow): 'Missing' | 'Error' | 'Warning' | 'Valid' {
  if (row.types.length === 0) return 'Missing';
  if (row.errors > 0) return 'Error';
  if (row.warnings > 0) return 'Warning';
  return 'Valid';
}

const statusBadgeClass: Record<string, string> = {
  Missing: 'bg-critical-100 text-critical-700',
  Error: 'bg-critical-100 text-critical-700',
  Warning: 'bg-warning-100 text-warning-700',
  Valid: 'bg-success-100 text-success-700',
};

const filters = ['All', 'Missing', 'Error', 'Warning', 'Valid'];

export default function SchemaJsonLdPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const schemaIssues = priorityIssues.filter((i) => i.areaKey === 'schema');

  const pagesWithoutSchema = schemaJsonLdData.pagesAnalyzed - schemaJsonLdData.pagesWithSchema;
  const validSchema = schemaJsonLdData.pagesWithSchema - schemaJsonLdData.validationIssues;
  const totalIssues = schemaJsonLdData.warningCount + schemaJsonLdData.errorCount + pagesWithoutSchema;
  const schemaTypeEntries = Object.entries(schemaJsonLdData.schemaTypes);
  const schemaTypeCount = schemaTypeEntries.length;

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const status = classify(row);
      if (filter !== 'All' && status !== filter) return false;
      const haystack = `${row.url} ${row.types.join(' ')}`.toLowerCase();
      if (search && !haystack.includes(search.toLowerCase())) return false;
      return true;
    });
  }, [search, filter]);

  const opportunityFilterTarget: Record<string, string> = {
    'schema-opp-1': 'Missing',
    'schema-opp-2': 'Error',
    'schema-opp-3': 'Warning',
  };

  const opportunities: Opportunity[] = [
    {
      id: 'schema-opp-1',
      title: `Add structured data to ${pagesWithoutSchema} pages with no schema`,
      description: 'Pages without schema.org markup miss out on rich results and enhanced search listings.',
      impact: 'High',
      effort: 'Medium',
      ctaLabel: 'Review Pages',
    },
    {
      id: 'schema-opp-2',
      title: `Fix ${schemaJsonLdData.errorCount} pages with schema validation errors`,
      description: 'Invalid structured data can be ignored by search engines, forfeiting rich result eligibility.',
      impact: 'High',
      effort: 'Low',
      ctaLabel: 'Review Errors',
    },
    {
      id: 'schema-opp-3',
      title: `Resolve ${schemaJsonLdData.warningCount} schema warnings`,
      description: 'Warnings flag optional fields that strengthen eligibility for enhanced rich results.',
      impact: 'Medium',
      effort: 'Low',
      ctaLabel: 'Review Warnings',
    },
  ];

  return (
    <div className="min-h-screen bg-surface-50">
      <SeoSubPillarHeader
        title="Schema / JSON-LD"
        description="Implement and validate structured data for rich snippets and enhanced search indexing."
        score={schemaJsonLdData.score}
        statusLabel="Excellent"
        stats={[
          { label: 'Analyzed', value: schemaJsonLdData.pagesAnalyzed },
          { label: 'Healthy', value: validSchema },
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
              label="Missing Schema"
              value={pagesWithoutSchema}
              description="pages have no structured data implemented"
              footnote={`${((pagesWithoutSchema / schemaJsonLdData.pagesAnalyzed) * 100).toFixed(1)}% of analyzed pages`}
              ctaLabel="Review Pages"
              onCta={() => setFilter('Missing')}
            />
            <SeoMetricCard
              label="Validation Errors"
              value={schemaJsonLdData.errorCount}
              description="schema blocks contain critical errors that block rich results"
              ctaLabel="Review Errors"
              onCta={() => setFilter('Error')}
            />
            <SeoMetricCard
              label="Warnings"
              value={schemaJsonLdData.warningCount}
              description="schema is present but has minor validation warnings"
              ctaLabel="Review Warnings"
              onCta={() => setFilter('Warning')}
            />
            <SeoMetricCard
              label="Valid Schema"
              value={validSchema}
              description="pages have error-free structured data"
              footnote={`${((validSchema / schemaJsonLdData.pagesAnalyzed) * 100).toFixed(1)}% of analyzed pages`}
              ctaLabel="View Valid"
              onCta={() => setFilter('Valid')}
            />
            <SeoMetricCard
              label="Schema Types Tracked"
              value={schemaTypeCount}
              description="distinct schema.org types implemented across your store"
            />
          </div>

          {/* Right Column - Reusable Schema Health Breakdown */}
          <SeoHealthBreakdown
            title="Schema Health Breakdown"
            total={schemaJsonLdData.pagesAnalyzed}
            summary={[
              { label: 'Valid', value: validSchema, tone: 'valid' },
              { label: 'Warning', value: schemaJsonLdData.warningCount, tone: 'warning' },
              { label: 'Error', value: schemaJsonLdData.errorCount, tone: 'error' },
              { label: 'Missing', value: pagesWithoutSchema, tone: 'missing' },
            ]}
            rows={schemaTypeEntries.map(([type, data]) => ({
              label: type,
              count: data.count,
              valid: data.valid,
              errors: data.errors,
              tone: data.errors > 0 ? 'warning' : 'valid',
            }))}
            footerNote={`${schemaTypeCount} schema types tracked across ${schemaJsonLdData.pagesAnalyzed.toLocaleString()} pages.`}
          />
        </div>

        {/* Detected Issues */}
        {schemaIssues.length > 0 && (
          <div className="bg-white border border-surface-200 rounded-lg shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-5 border-b border-surface-200">
              <h2 className="text-lg font-bold text-surface-900">Detected Issues</h2>
              <p className="text-xs text-surface-500 mt-1">{schemaIssues.length} issue types found</p>
            </div>
            <div className="divide-y divide-surface-100">
              {schemaIssues.map((issue) => (
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
            title="Page Schema Status"
            subtitle="Search and filter pages by schema implementation status"
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by URL or schema type…"
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
                      <th className="px-6 py-3 text-left font-semibold text-surface-700">Schema Types</th>
                      <th className="px-6 py-3 text-center font-semibold text-surface-700">Errors</th>
                      <th className="px-6 py-3 text-center font-semibold text-surface-700">Warnings</th>
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
                          <td className="px-6 py-3">
                            <p className={`text-xs ${row.types.length ? 'text-surface-900' : 'text-surface-400 italic'}`}>
                              {row.types.length ? row.types.join(', ') : '—'}
                            </p>
                          </td>
                          <td className="px-6 py-3 text-center">
                            <span className="text-xs font-medium text-surface-700">{row.errors}</span>
                          </td>
                          <td className="px-6 py-3 text-center">
                            <span className="text-xs font-medium text-surface-700">{row.warnings}</span>
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
