import { sortByCell, type SubPillarAnalysis } from '../subpillar.model';

// ─── Static presentation config only ──────────────────────────────────
// Data fields below (summary/healthChip/totals/findings/evidence.rows/
// lastAnalyzed) are placeholders overwritten by fetchSubPillarAnalysis()
// on load — see data/seo/subpillar.repository.ts. This file keeps only
// what doesn't change per audit: labels, columns, facet, sorts, related
// areas. `evidence.sorts` intentionally omits the severity sort — the
// repository rebuilds and prepends it once real findings are known
// (sortBySeverity closes over the findings array).

export const titleTagsAnalysis: SubPillarAnalysis = {
  slug: 'title-tags',
  title: 'Title Tags',
  description: 'Evaluate how effectively your store uses unique, descriptive and search-friendly page titles.',
  supportsBulkFix: true,
  bulkFixMode: 'title-tags',
  summary: '',
  healthChip: '',
  totals: {
    score: 0,
    analyzed: 0,
    healthy: 0,
    issues: 0,
    critical: 0,
    analyzedLabel: 'Pages analyzed',
    healthyLabel: 'Healthy',
    issuesLabel: 'Issues',
    criticalLabel: 'Critical',
    contextLabel: '',
    contextValue: '',
  },
  findings: [],
  evidence: {
    title: 'Affected pages',
    caption: 'Pages sampled from the latest crawl with their title tag status',
    searchPlaceholder: 'Search URL, title or keyword…',
    searchKeys: ['url', 'title', 'keyword'],
    sampleNoun: 'crawled pages',
    facet: { label: 'Page type', allLabel: 'All page types', values: ['Product', 'Collection', 'Blog', 'Page'] },
    columns: [
      { key: 'url', header: 'Page URL', variant: 'mono', subKey: 'pageType', clamp: 'max-w-[15rem]' },
      { key: 'title', header: 'Current title', subKey: 'keyword', emptyText: 'no title tag', clamp: 'max-w-[20rem]' },
      { key: 'length', header: 'Length', align: 'center', variant: 'number' },
      { key: 'status', header: 'Issue', variant: 'status' },
      { key: 'severity', header: 'Severity', variant: 'severity' },
      { key: 'action', header: 'Action', align: 'right', variant: 'action' },
    ],
    rows: [],
    sorts: [sortByCell('length', 'Sort: title length', 'desc'), sortByCell('url', 'Sort: URL')],
  },
  relatedAreas: [
    { label: 'Meta Descriptions', href: '/seo/meta-descriptions', hint: 'The other half of the search snippet' },
    { label: 'Canonicals & Duplicates', href: '/seo/canonicals', hint: 'Where duplicate titles usually originate' },
    { label: 'Schema / JSON-LD', href: '/seo/schema', hint: 'Structured data behind rich results' },
  ],
  lastAnalyzed: '',
};
