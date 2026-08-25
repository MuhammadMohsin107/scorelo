import { sortByCell, type SubPillarAnalysis } from '../subpillar.model';

// ─── Static presentation config only ──────────────────────────────────
// Data fields (summary/healthChip/totals/findings/evidence.rows/
// lastAnalyzed) are placeholders overwritten by fetchSubPillarAnalysis()
// on load — see data/seo/subpillar.repository.ts. `evidence.sorts`
// intentionally omits the severity sort — the repository prepends it
// once real findings are known (sortBySeverity closes over them).

export const handlesRedirectsAnalysis: SubPillarAnalysis = {
  slug: 'handles-redirects',
  title: 'Handles & Redirects',
  description: 'Keep URLs stable and make sure every redirect resolves cleanly in a single hop.',
  summary: '',
  healthChip: '',
  totals: {
    score: 0,
    analyzed: 0,
    healthy: 0,
    issues: 0,
    critical: 0,
    analyzedLabel: 'URLs analyzed',
    healthyLabel: 'Resolving cleanly',
    issuesLabel: 'Issues',
    criticalLabel: 'Broken redirects',
    contextLabel: '',
    contextValue: '',
  },
  findings: [],
  evidence: {
    title: 'Affected URLs',
    caption: 'Redirects and handles sampled from the latest crawl',
    searchPlaceholder: 'Search source or destination…',
    searchKeys: ['source', 'destination'],
    sampleNoun: 'crawled redirects',
    facet: { label: 'URL type', allLabel: 'All URL types', values: ['Product', 'Collection', 'Blog', 'Page'] },
    columns: [
      { key: 'source', header: 'Source URL', variant: 'mono', subKey: 'linkType', clamp: 'max-w-[16rem]' },
      { key: 'destination', header: 'Destination', variant: 'mono', emptyText: 'no redirect', clamp: 'max-w-[16rem]' },
      { key: 'type', header: 'Type', align: 'center' },
      { key: 'httpStatus', header: 'Status', align: 'center', variant: 'number' },
      { key: 'status', header: 'Issue', variant: 'status' },
      { key: 'severity', header: 'Severity', variant: 'severity' },
      { key: 'action', header: 'Action', align: 'right', variant: 'action' },
    ],
    rows: [],
    sorts: [sortByCell('source', 'Sort: source URL'), sortByCell('httpStatus', 'Sort: HTTP status', 'desc')],
  },
  relatedAreas: [
    { label: 'Internal Links & 404s', href: '/seo/internal-links', hint: 'What still links to these URLs' },
    { label: 'Canonicals & Duplicates', href: '/seo/canonicals', hint: 'How duplicate URLs consolidate' },
    { label: 'Sitemap & Indexability', href: '/seo/sitemap', hint: 'Whether redirected URLs are still listed' },
  ],
  lastAnalyzed: '',
};
