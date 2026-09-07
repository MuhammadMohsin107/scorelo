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
    // ─── Columns must match what the CHECK measures ────────────────────
    // These used to be "Declared canonical" and "Expected canonical", reading `canonical` and
    // `expected` cells. The canonicals check writes neither: it measures HANDLE FAMILIES from
    // Admin data, because a rendered <link rel="canonical"> needs page HTML and the storefront is
    // password-protected. So both columns fell back to their empty text on every row — a table of
    // "none" and "—" that read as a measured result ("this page declares no canonical") when in
    // fact nothing had been read.
    //
    // The subKey was `urlType`; the check writes `pageType`, so the URL's second line was blank
    // too. Every key below is one the check actually writes: url, pageType, title, length.
    caption: 'URLs sampled from the latest audit with their handle-duplication status',
    searchPlaceholder: 'Search URL or page name…',
    searchKeys: ['url', 'title'],
    sampleNoun: 'analyzed URLs',
    facet: { label: 'URL type', allLabel: 'All URL types', values: ['Product', 'Collection', 'Blog', 'Page'] },
    columns: [
      { key: 'url', header: 'URL', variant: 'mono', subKey: 'pageType', clamp: 'max-w-[20rem]' },
      { key: 'title', header: 'Page', variant: 'muted', clamp: 'max-w-[16rem]' },
      // Family size. 1 means the handle is unique — which is exactly what "Healthy" means here.
      { key: 'length', header: 'In handle family', align: 'center', variant: 'number' },
      { key: 'status', header: 'Issue', variant: 'status' },
      { key: 'severity', header: 'Severity', variant: 'severity' },
      { key: 'action', header: 'Action', align: 'right', variant: 'action' },
    ],
    rows: [],
    sorts: [sortByCell('length', 'Sort: family size', 'desc'), sortByCell('url', 'Sort: URL')],
  },
  relatedAreas: [
    { label: 'Handles & Redirects', href: '/seo/handles-redirects', hint: 'Where duplicate URLs are created' },
    { label: 'Sitemap & Indexability', href: '/seo/sitemap', hint: 'Which of these URLs are indexable' },
    { label: 'Title Tags', href: '/seo/title-tags', hint: 'Duplicate titles often follow duplicate URLs' },
  ],
  lastAnalyzed: '',
};
