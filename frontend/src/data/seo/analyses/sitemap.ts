import { sortByCell, type SubPillarAnalysis } from '../subpillar.model';

// ─── Static presentation config only ──────────────────────────────────
// Data fields (summary/healthChip/totals/findings/evidence.rows/
// lastAnalyzed) are placeholders overwritten by fetchSubPillarAnalysis()
// on load — see data/seo/subpillar.repository.ts. `evidence.sorts`
// intentionally omits the severity sort — the repository prepends it
// once real findings are known (sortBySeverity closes over them).

export const sitemapAnalysis: SubPillarAnalysis = {
  slug: 'sitemap',
  title: 'Sitemap & Indexability',
  description: 'Confirm the pages you want ranking are submitted, crawlable and actually indexed.',
  summary: '',
  healthChip: '',
  totals: {
    score: 0,
    analyzed: 0,
    healthy: 0,
    issues: 0,
    critical: 0,
    analyzedLabel: 'URLs analyzed',
    healthyLabel: 'Indexed',
    issuesLabel: 'Issues',
    criticalLabel: 'Blocked',
    contextLabel: '',
    contextValue: '',
  },
  findings: [],
  evidence: {
    title: 'Affected URLs',
    caption: 'URLs sampled from the latest crawl with their index and sitemap status',
    searchPlaceholder: 'Search URL or robots directive…',
    searchKeys: ['url', 'robots', 'indexability'],
    sampleNoun: 'crawled URLs',
    facet: { label: 'Page type', allLabel: 'All page types', values: ['Product', 'Collection', 'Blog', 'Page'] },
    columns: [
      { key: 'url', header: 'URL', variant: 'mono', subKey: 'pageType', clamp: 'max-w-[17rem]' },
      { key: 'indexability', header: 'Indexability' },
      { key: 'inSitemap', header: 'In sitemap', align: 'center' },
      { key: 'robots', header: 'Robots directive', variant: 'muted', clamp: 'max-w-[13rem]' },
      { key: 'status', header: 'Issue', variant: 'status' },
      { key: 'severity', header: 'Severity', variant: 'severity' },
      { key: 'action', header: 'Action', align: 'right', variant: 'action' },
    ],
    rows: [],
    sorts: [sortByCell('url', 'Sort: URL'), sortByCell('indexability', 'Sort: indexability')],
  },
  relatedAreas: [
    { label: 'Canonicals & Duplicates', href: '/seo/canonicals', hint: 'Which URL should be indexed' },
    { label: 'Handles & Redirects', href: '/seo/handles-redirects', hint: 'Redirected URLs still in the sitemap' },
    { label: 'Internal Links & 404s', href: '/seo/internal-links', hint: 'How crawlers discover these pages' },
  ],
  lastAnalyzed: '',
};
