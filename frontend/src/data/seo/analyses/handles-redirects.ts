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
    // `source`, `destination`, `type` and `httpStatus` were all unwritten — the check records a
    // redirect as url (the path), title (its target) and length (1, or 2 when it chains). Nothing
    // fetches the destination, so there is no HTTP status to show and the column always sat empty.
    caption: 'Redirects read from the store in the latest audit',
    searchPlaceholder: 'Search path or target…',
    searchKeys: ['url', 'title'],
    sampleNoun: 'redirects',
    facet: { label: 'Type', allLabel: 'All types', values: ['Redirect'] },
    columns: [
      { key: 'url', header: 'Source path', variant: 'mono', subKey: 'pageType', clamp: 'max-w-[18rem]' },
      { key: 'title', header: 'Target', variant: 'mono', clamp: 'max-w-[18rem]' },
      { key: 'length', header: 'Hops', align: 'center', variant: 'number' },
      { key: 'status', header: 'Issue', variant: 'status' },
      { key: 'severity', header: 'Severity', variant: 'severity' },
      { key: 'action', header: 'Action', align: 'right', variant: 'action' },
    ],
    rows: [],
    sorts: [sortByCell('length', 'Sort: hops', 'desc'), sortByCell('url', 'Sort: source path')],
  },
  relatedAreas: [
    { label: 'Internal Links & 404s', href: '/seo/internal-links', hint: 'What still links to these URLs' },
    { label: 'Canonicals & Duplicates', href: '/seo/canonicals', hint: 'How duplicate URLs consolidate' },
    { label: 'Sitemap & Indexability', href: '/seo/sitemap', hint: 'Whether redirected URLs are still listed' },
  ],
  lastAnalyzed: '',
};
