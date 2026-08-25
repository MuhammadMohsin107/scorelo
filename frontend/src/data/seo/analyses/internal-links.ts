import { sortByCell, type SubPillarAnalysis } from '../subpillar.model';

// ─── Static presentation config only ──────────────────────────────────
// Data fields (summary/healthChip/totals/findings/evidence.rows/
// lastAnalyzed) are placeholders overwritten by fetchSubPillarAnalysis()
// on load — see data/seo/subpillar.repository.ts. `evidence.sorts`
// intentionally omits the severity sort — the repository prepends it
// once real findings are known (sortBySeverity closes over them).

export const internalLinksAnalysis: SubPillarAnalysis = {
  slug: 'internal-links',
  title: 'Internal Links & 404s',
  description: 'Make sure crawlers and shoppers can reach every page, and that no link leads to a dead end.',
  summary: '',
  healthChip: '',
  totals: {
    score: 0,
    analyzed: 0,
    healthy: 0,
    issues: 0,
    critical: 0,
    analyzedLabel: 'Pages analyzed',
    healthyLabel: 'Healthy pages',
    issuesLabel: 'Issues',
    criticalLabel: 'Broken links',
    contextLabel: '',
    contextValue: '',
  },
  findings: [],
  evidence: {
    title: 'Affected links',
    caption: 'Internal links sampled from the latest crawl with their resolution status',
    searchPlaceholder: 'Search source, target or anchor…',
    searchKeys: ['source', 'target', 'anchor'],
    sampleNoun: 'crawled links',
    facet: { label: 'Link type', allLabel: 'All link types', values: ['In-body', 'Navigation', 'Footer', 'External', 'Orphan'] },
    columns: [
      { key: 'source', header: 'Source page', variant: 'mono', subKey: 'linkType', clamp: 'max-w-[16rem]' },
      { key: 'target', header: 'Target URL', variant: 'mono', clamp: 'max-w-[16rem]' },
      { key: 'anchor', header: 'Anchor text', variant: 'muted', clamp: 'max-w-[13rem]' },
      { key: 'httpStatus', header: 'HTTP', align: 'center', variant: 'number' },
      { key: 'status', header: 'Issue', variant: 'status' },
      { key: 'severity', header: 'Severity', variant: 'severity' },
      { key: 'action', header: 'Action', align: 'right', variant: 'action' },
    ],
    rows: [],
    sorts: [sortByCell('httpStatus', 'Sort: HTTP status', 'desc'), sortByCell('target', 'Sort: target URL')],
  },
  relatedAreas: [
    { label: 'Handles & Redirects', href: '/seo/handles-redirects', hint: 'Where these 404s should redirect' },
    { label: 'Sitemap & Indexability', href: '/seo/sitemap', hint: 'How orphan pages get discovered' },
    { label: 'Canonicals & Duplicates', href: '/seo/canonicals', hint: 'Which URL links should point at' },
  ],
  lastAnalyzed: '',
};
