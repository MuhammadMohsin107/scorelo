import { sortByCell, type SubPillarAnalysis } from '../subpillar.model';

// ─── Static presentation config only ──────────────────────────────────
// Data fields (summary/healthChip/totals/findings/evidence.rows/
// lastAnalyzed) are placeholders overwritten by fetchSubPillarAnalysis()
// on load — see data/seo/subpillar.repository.ts. `evidence.sorts`
// intentionally omits the severity sort — the repository prepends it
// once real findings are known (sortBySeverity closes over them).

export const metaDescriptionsAnalysis: SubPillarAnalysis = {
  slug: 'meta-descriptions',
  title: 'Meta Descriptions',
  description: 'Check that every page earns its click with a unique, well-sized description in the search snippet.',
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
    criticalLabel: 'Missing',
    contextLabel: '',
    contextValue: '',
  },
  findings: [],
  evidence: {
    title: 'Affected pages',
    caption: 'Pages sampled from the latest crawl with their meta description status',
    searchPlaceholder: 'Search URL or description…',
    searchKeys: ['url', 'description'],
    sampleNoun: 'crawled pages',
    facet: { label: 'Page type', allLabel: 'All page types', values: ['Product', 'Collection', 'Blog', 'Page'] },
    columns: [
      { key: 'url', header: 'Page URL', variant: 'mono', subKey: 'pageType', clamp: 'max-w-[15rem]' },
      { key: 'description', header: 'Current meta description', emptyText: 'no description', clamp: 'max-w-[24rem]' },
      { key: 'length', header: 'Length', align: 'center', variant: 'number' },
      { key: 'status', header: 'Issue', variant: 'status' },
      { key: 'severity', header: 'Severity', variant: 'severity' },
      { key: 'action', header: 'Action', align: 'right', variant: 'action' },
    ],
    rows: [],
    sorts: [
      sortByCell('length', 'Sort: description length', 'desc'),
      sortByCell('url', 'Sort: URL'),
    ],
  },
  relatedAreas: [
    { label: 'Title Tags', href: '/seo/title-tags', hint: 'The other half of the search snippet' },
    { label: 'Canonicals & Duplicates', href: '/seo/canonicals', hint: 'Where duplicate snippets originate' },
    { label: 'Sitemap & Indexability', href: '/seo/sitemap', hint: 'Whether these pages can rank at all' },
  ],
  lastAnalyzed: '',
};
