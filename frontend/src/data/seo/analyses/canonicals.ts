import { sortByCell, type SubPillarAnalysis } from '../subpillar.model';

// ─── Static presentation config only ──────────────────────────────────
// Data fields (summary/healthChip/totals/findings/evidence.rows/
// lastAnalyzed) are placeholders overwritten by fetchSubPillarAnalysis()
// on load — see data/seo/subpillar.repository.ts. `evidence.sorts`
// intentionally omits the severity sort — the repository prepends it
// once real findings are known (sortBySeverity closes over them).

export const canonicalsAnalysis: SubPillarAnalysis = {
  slug: 'canonicals',
  title: 'Canonicals & Duplicates',
  description: 'Make sure every page consolidates its ranking signals onto one preferred URL.',
  summary: '',
  healthChip: '',
  totals: {
    score: 0,
    analyzed: 0,
    healthy: 0,
    issues: 0,
    critical: 0,
    analyzedLabel: 'URLs analyzed',
    healthyLabel: 'Valid canonicals',
    issuesLabel: 'Issues',
    criticalLabel: 'Conflicts',
    contextLabel: '',
    contextValue: '',
  },
  findings: [],
  evidence: {
    title: 'Affected URLs',
    caption: 'URLs sampled from the latest crawl with their canonical status',
    searchPlaceholder: 'Search URL or canonical target…',
    searchKeys: ['url', 'canonical', 'expected'],
    sampleNoun: 'crawled URLs',
    facet: { label: 'URL type', allLabel: 'All URL types', values: ['Product', 'Collection', 'Blog', 'Page'] },
    columns: [
      { key: 'url', header: 'URL', variant: 'mono', subKey: 'urlType', clamp: 'max-w-[18rem]' },
      { key: 'canonical', header: 'Declared canonical', variant: 'mono', emptyText: 'none', clamp: 'max-w-[16rem]' },
      { key: 'expected', header: 'Expected canonical', variant: 'muted', clamp: 'max-w-[16rem]' },
      { key: 'status', header: 'Issue', variant: 'status' },
      { key: 'severity', header: 'Severity', variant: 'severity' },
      { key: 'action', header: 'Action', align: 'right', variant: 'action' },
    ],
    rows: [],
    sorts: [sortByCell('url', 'Sort: URL'), sortByCell('urlType', 'Sort: URL type')],
  },
  relatedAreas: [
    { label: 'Handles & Redirects', href: '/seo/handles-redirects', hint: 'Where duplicate URLs are created' },
    { label: 'Sitemap & Indexability', href: '/seo/sitemap', hint: 'Which of these URLs are indexable' },
    { label: 'Title Tags', href: '/seo/title-tags', hint: 'Duplicate titles often follow duplicate URLs' },
  ],
  lastAnalyzed: '',
};
