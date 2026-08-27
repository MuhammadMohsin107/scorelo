import { sortByCell, type SubPillarAnalysis } from '../subpillar.model';

// ─── Static presentation config only ──────────────────────────────────
// Brought into line with the other seven SEO analyses. This file previously carried a full set
// of invented measurements — a computed score, three hand-written findings and fourteen evidence
// rows with real-looking URLs and error counts — which SchemaJsonLdPage rendered without ever
// calling the API. Data fields (summary/healthChip/totals/findings/evidence.rows/lastAnalyzed)
// are now placeholders overwritten by fetchSubPillarAnalysis() on load, exactly as in
// canonicals.ts and its siblings. `evidence.sorts` intentionally omits the severity sort — the
// repository prepends it once real findings are known (sortBySeverity closes over them).

export const schemaAnalysis: SubPillarAnalysis = {
  slug: 'schema',
  title: 'Schema / JSON-LD',
  description: 'Verify that your structured data is present, valid and complete enough to earn rich results.',
  summary: '',
  healthChip: '',
  totals: {
    score: 0,
    analyzed: 0,
    healthy: 0,
    issues: 0,
    critical: 0,
    analyzedLabel: 'Pages analyzed',
    healthyLabel: 'Valid schema',
    issuesLabel: 'Issues',
    criticalLabel: 'Errors',
    contextLabel: 'Schema types in use',
    contextValue: '',
  },
  findings: [],
  evidence: {
    title: 'Affected pages',
    caption: 'Pages sampled from the latest crawl with their structured-data status',
    searchPlaceholder: 'Search URL, type or detail…',
    searchKeys: ['url', 'types', 'detail'],
    sampleNoun: 'crawled pages',
    facet: { label: 'Schema type', allLabel: 'All schema types', values: ['Product', 'BreadcrumbList', 'None'] },
    columns: [
      { key: 'url', header: 'Page URL', variant: 'mono', clamp: 'max-w-[15rem]' },
      { key: 'types', header: 'Schema types', subKey: 'detail', emptyText: 'no markup', clamp: 'max-w-[20rem]' },
      { key: 'errors', header: 'Errors', align: 'center', variant: 'number' },
      { key: 'warnings', header: 'Warnings', align: 'center', variant: 'number' },
      { key: 'status', header: 'Issue', variant: 'status' },
      { key: 'severity', header: 'Severity', variant: 'severity' },
      { key: 'action', header: 'Action', align: 'right', variant: 'action' },
    ],
    rows: [],
    sorts: [sortByCell('errors', 'Sort: errors', 'desc'), sortByCell('url', 'Sort: URL')],
  },
  relatedAreas: [
    { label: 'Title Tags', href: '/seo/title-tags', hint: 'What the result headline says' },
    { label: 'Meta Descriptions', href: '/seo/meta-descriptions', hint: 'What the result snippet says' },
    { label: 'Sitemap & Indexability', href: '/seo/sitemap', hint: 'Whether these pages are indexable' },
  ],
  lastAnalyzed: '',
};
