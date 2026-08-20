import { canonicalsDuplicatesData } from '../seo-8pillars.mock';
import {
  HEALTHY,
  bySeverity,
  sortByCell,
  sortBySeverity,
  type EvidenceRow,
  type SubPillarAnalysis,
  type SubPillarFinding,
} from '../subpillar.model';

const { urlsAnalyzed, validCanonicals, duplicateUrls, canonicalConflicts, missingCanonicals, score } =
  canonicalsDuplicatesData;
const issues = duplicateUrls + canonicalConflicts + missingCanonicals;

const findings: SubPillarFinding[] = bySeverity([
  {
    id: 'cn-conflict',
    issueType: 'Conflict',
    title: 'Conflicting canonical tags',
    severity: 'critical',
    affected: canonicalConflicts,
    impact: 'High',
    effort: 'Medium',
    whatIsWrong: `${canonicalConflicts} URLs declare a canonical that points somewhere unexpected — at a filtered variant, a paginated page, or back and forth between two URLs.`,
    whyItMatters:
      'A conflicting canonical tells search engines to consolidate ranking signals onto the wrong URL, so the page you want ranking is suppressed.',
    recommendation: 'Point each canonical at the single preferred URL and make sure that target self-references.',
  },
  {
    id: 'cn-duplicate',
    issueType: 'Duplicate',
    title: 'Duplicate URLs without consolidation',
    severity: 'high',
    affected: duplicateUrls,
    impact: 'High',
    effort: 'Medium',
    whatIsWrong: `${duplicateUrls} URLs serve substantially the same content — filter and sort parameters generating a crawlable page per combination.`,
    whyItMatters:
      'Duplicate URLs split ranking signals and burn crawl budget on pages that will never rank in their own right.',
    recommendation: 'Canonicalise parameter URLs to the clean collection URL and keep faceted combinations out of the crawl.',
  },
  {
    id: 'cn-missing',
    issueType: 'Missing',
    title: 'Pages with no canonical tag',
    severity: 'medium',
    affected: missingCanonicals,
    impact: 'Medium',
    effort: 'Low',
    whatIsWrong: `${missingCanonicals} URLs emit no canonical link element, leaving consolidation entirely to search-engine inference.`,
    whyItMatters:
      'Without an explicit canonical, any future parameter or protocol variation can be treated as a separate page.',
    recommendation: 'Emit a self-referencing canonical on every indexable template by default.',
  },
]);

const row = (
  id: string,
  url: string,
  canonical: string,
  expected: string,
  urlType: string,
  status: string,
  note?: string,
): EvidenceRow => ({
  id,
  status,
  facet: urlType,
  cells: { url, canonical, expected, urlType },
  current: { label: 'Declared canonical', value: canonical, meta: url },
  suggested: status === HEALTHY ? undefined : { label: 'Expected canonical', value: expected },
  note,
});

const rows: EvidenceRow[] = [
  row('c1', '/wireless-earbuds-pro', '/wireless-earbuds-pro', '/wireless-earbuds-pro', 'Product', HEALTHY),
  row('c2', '/noise-cancelling-headphones', '/noise-cancelling-headphones', '/noise-cancelling-headphones', 'Product', HEALTHY),
  row('c3', '/collections/gaming-audio?sort=price-asc', '/collections/gaming-audio?sort=price-asc', '/collections/gaming-audio', 'Collection', 'Conflict', 'Canonical self-references a sort parameter'),
  row('c4', '/collections/gaming-audio?sort=price-desc', '/collections/gaming-audio?sort=price-desc', '/collections/gaming-audio', 'Collection', 'Conflict', 'Canonical self-references a sort parameter'),
  row('c5', '/collections/all?page=2', '/collections/all?page=2', '/collections/all?page=2', 'Collection', 'Conflict', 'Paginated page canonicalises to page 1 in the theme, creating a loop'),
  row('c6', '/wireless-earbuds-black', '/wireless-earbuds-white', '/wireless-earbuds-pro', 'Product', 'Conflict', 'Points at a sibling variant rather than the parent product'),
  row('c7', '/collections/gaming-audio?color=black', '', '/collections/gaming-audio', 'Collection', 'Duplicate', 'Filter combination generates a crawlable URL'),
  row('c8', '/collections/gaming-audio?color=white', '', '/collections/gaming-audio', 'Collection', 'Duplicate', 'Filter combination generates a crawlable URL'),
  row('c9', '/collections/gaming-audio?color=black&sort=price-asc', '', '/collections/gaming-audio', 'Collection', 'Duplicate', 'Filter combination generates a crawlable URL'),
  row('c10', '/products/earbuds-pro?variant=41822', '', '/wireless-earbuds-pro', 'Product', 'Duplicate', 'Variant query string duplicates the product page'),
  row('c11', '/pages/warranty', '', '/pages/warranty', 'Page', 'Missing', 'No canonical element emitted'),
  row('c12', '/pages/shipping', '', '/pages/shipping', 'Page', 'Missing', 'No canonical element emitted'),
  row('c13', '/blogs/guides/how-to-choose-headphones', '', '/blogs/guides/how-to-choose-headphones', 'Blog', 'Missing', 'No canonical element emitted'),
  row('c14', '/collections/new-arrivals', '/collections/new-arrivals', '/collections/new-arrivals', 'Collection', HEALTHY),
  row('c15', '/studio-monitor-headphones', '/studio-monitor-headphones', '/studio-monitor-headphones', 'Product', HEALTHY),
];

export const canonicalsAnalysis: SubPillarAnalysis = {
  slug: 'canonicals',
  title: 'Canonicals & Duplicates',
  description: 'Make sure every page consolidates its ranking signals onto one preferred URL.',
  summary: `${validCanonicals.toLocaleString()} of ${urlsAnalyzed.toLocaleString()} crawled URLs canonicalise correctly. ${issues} need attention — ${canonicalConflicts} point at the wrong target.`,
  healthChip: `${((validCanonicals / urlsAnalyzed) * 100).toFixed(1)}% consolidated`,
  totals: {
    score,
    analyzed: urlsAnalyzed,
    healthy: validCanonicals,
    issues,
    critical: canonicalConflicts,
    analyzedLabel: 'URLs analyzed',
    healthyLabel: 'Valid canonicals',
    issuesLabel: 'Issues',
    criticalLabel: 'Conflicts',
    contextLabel: 'Duplicate URLs found',
    contextValue: `${duplicateUrls}`,
  },
  findings,
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
    rows,
    sorts: [sortBySeverity(findings), sortByCell('url', 'Sort: URL'), sortByCell('urlType', 'Sort: URL type')],
  },
  relatedAreas: [
    { label: 'Handles & Redirects', href: '/seo/handles-redirects', hint: 'Where duplicate URLs are created' },
    { label: 'Sitemap & Indexability', href: '/seo/sitemap', hint: 'Which of these URLs are indexable' },
    { label: 'Title Tags', href: '/seo/title-tags', hint: 'Duplicate titles often follow duplicate URLs' },
  ],
  lastAnalyzed: 'Today, 10:42 AM',
};
