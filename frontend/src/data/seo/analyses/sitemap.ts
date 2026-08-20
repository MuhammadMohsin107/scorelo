import { sitemapIndexabilityData } from '../seo-8pillars.mock';
import {
  HEALTHY,
  bySeverity,
  sortByCell,
  sortBySeverity,
  type EvidenceRow,
  type SubPillarAnalysis,
  type SubPillarFinding,
} from '../subpillar.model';

const { sitemapUrls, indexed, notIndexed, blocked, noindex, excludedPages, errors, score } = sitemapIndexabilityData;
const issues = notIndexed + blocked + noindex + excludedPages;
// `excludedPages` are indexable URLs missing FROM the sitemap, so they sit
// outside sitemapUrls. Total analyzed spans both sets, keeping the metric
// strip consistent: indexed + issues === analyzed.
const urlsAnalyzed = sitemapUrls + excludedPages;

const findings: SubPillarFinding[] = bySeverity([
  {
    id: 'sm-blocked',
    issueType: 'Blocked',
    title: 'Pages blocked by robots.txt',
    severity: 'critical',
    affected: blocked,
    impact: 'High',
    effort: 'Low',
    whatIsWrong: `${blocked} URLs are disallowed in robots.txt yet still listed in the sitemap, so you are submitting pages you have told crawlers to ignore.`,
    whyItMatters:
      'A blocked URL cannot be read, so it cannot rank — and the contradictory signal wastes crawl budget on every visit.',
    recommendation: 'Decide per URL: either remove the disallow rule, or drop the URL from the sitemap.',
  },
  {
    id: 'sm-noindex',
    issueType: 'Noindex',
    title: 'Indexable pages carrying a noindex tag',
    severity: 'high',
    affected: noindex,
    impact: 'High',
    effort: 'Low',
    whatIsWrong: `${noindex} pages emit a noindex robots directive, including two revenue-generating collection pages.`,
    whyItMatters:
      'A noindex directive removes the page from search results entirely, regardless of how well it is otherwise optimised.',
    recommendation: 'Remove noindex from every page that should rank, and confirm the change before the next crawl.',
  },
  {
    id: 'sm-not-indexed',
    issueType: 'Not Indexed',
    title: 'Submitted pages that are not indexed',
    severity: 'medium',
    affected: notIndexed,
    impact: 'Medium',
    effort: 'Medium',
    whatIsWrong: `${notIndexed} URLs are in the sitemap and crawlable but have not been indexed — typically thin, near-duplicate or newly published pages.`,
    whyItMatters:
      'Pages that are crawled but never indexed usually signal a quality or duplication problem rather than a technical one.',
    recommendation: 'Strengthen the content, add internal links from established pages, and remove genuine near-duplicates.',
  },
  {
    id: 'sm-excluded',
    issueType: 'Excluded',
    title: 'Indexable pages missing from the sitemap',
    severity: 'low',
    affected: excludedPages,
    impact: 'Low',
    effort: 'Low',
    whatIsWrong: `${excludedPages} indexable URLs are absent from the sitemap, mostly newer blog posts and support pages.`,
    whyItMatters:
      'Omitted pages still get found through internal links, but discovery is slower and less reliable for deep pages.',
    recommendation: 'Include every indexable, canonical URL in the sitemap and regenerate it on publish.',
  },
]);

const row = (
  id: string,
  url: string,
  indexability: string,
  inSitemap: string,
  robots: string,
  pageType: string,
  status: string,
  note?: string,
  suggested?: string,
): EvidenceRow => ({
  id,
  status,
  facet: pageType,
  cells: { url, indexability, inSitemap, robots, pageType },
  current: { label: 'Current state', value: `${indexability} · robots: ${robots}`, meta: url },
  suggested: suggested ? { label: 'Should be', value: suggested } : undefined,
  note,
});

const rows: EvidenceRow[] = [
  row('i1', '/wireless-earbuds-pro', 'Indexed', 'Yes', 'index, follow', 'Product', HEALTHY),
  row('i2', '/noise-cancelling-headphones', 'Indexed', 'Yes', 'index, follow', 'Product', HEALTHY),
  row('i3', '/collections/gaming-audio', 'Not indexed', 'Yes', 'noindex, follow', 'Collection', 'Noindex', 'Revenue-generating collection excluded from search', 'index, follow'),
  row('i4', '/collections/clearance', 'Not indexed', 'Yes', 'noindex, follow', 'Collection', 'Noindex', 'Revenue-generating collection excluded from search', 'index, follow'),
  row('i5', '/blogs/guides/how-to-choose-headphones', 'Not indexed', 'Yes', 'noindex, follow', 'Blog', 'Noindex', 'Left over from the staging environment', 'index, follow'),
  row('i6', '/collections/all?sort=price-asc', 'Blocked', 'Yes', 'Disallow: /*?sort=', 'Collection', 'Blocked', 'Disallowed in robots.txt but still submitted', 'Remove from sitemap'),
  row('i7', '/search?q=earbuds', 'Blocked', 'Yes', 'Disallow: /search', 'Page', 'Blocked', 'Disallowed in robots.txt but still submitted', 'Remove from sitemap'),
  row('i8', '/cart', 'Blocked', 'Yes', 'Disallow: /cart', 'Page', 'Blocked', 'Disallowed in robots.txt but still submitted', 'Remove from sitemap'),
  row('i9', '/wireless-earbuds-black', 'Crawled, not indexed', 'Yes', 'index, follow', 'Product', 'Not Indexed', 'Near-duplicate of the parent product page'),
  row('i10', '/wireless-earbuds-white', 'Crawled, not indexed', 'Yes', 'index, follow', 'Product', 'Not Indexed', 'Near-duplicate of the parent product page'),
  row('i11', '/pages/warranty', 'Crawled, not indexed', 'Yes', 'index, follow', 'Page', 'Not Indexed', 'Thin content — 84 words on the page'),
  row('i12', '/blogs/news/spring-restock', 'Indexed', 'No', 'index, follow', 'Blog', 'Excluded', 'Published after the last sitemap regeneration', 'Add to sitemap'),
  row('i13', '/pages/shipping', 'Indexed', 'No', 'index, follow', 'Page', 'Excluded', 'Never added to the sitemap', 'Add to sitemap'),
  row('i14', '/studio-monitor-headphones', 'Indexed', 'Yes', 'index, follow', 'Product', HEALTHY),
  row('i15', '/collections/new-arrivals', 'Indexed', 'Yes', 'index, follow', 'Collection', HEALTHY),
];

export const sitemapAnalysis: SubPillarAnalysis = {
  slug: 'sitemap',
  title: 'Sitemap & Indexability',
  description: 'Confirm the pages you want ranking are submitted, crawlable and actually indexed.',
  summary: `${indexed.toLocaleString()} of ${urlsAnalyzed.toLocaleString()} discovered URLs are indexed, from a sitemap listing ${sitemapUrls.toLocaleString()}. ${issues} need attention — ${blocked} are blocked outright and ${noindex} carry a noindex tag.`,
  healthChip: `${((indexed / urlsAnalyzed) * 100).toFixed(1)}% indexed`,
  totals: {
    score,
    analyzed: urlsAnalyzed,
    healthy: indexed,
    issues,
    critical: blocked,
    analyzedLabel: 'URLs analyzed',
    healthyLabel: 'Indexed',
    issuesLabel: 'Issues',
    criticalLabel: 'Blocked',
    contextLabel: 'Sitemap errors',
    contextValue: `${errors}`,
  },
  findings,
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
    rows,
    sorts: [sortBySeverity(findings), sortByCell('url', 'Sort: URL'), sortByCell('indexability', 'Sort: indexability')],
  },
  relatedAreas: [
    { label: 'Canonicals & Duplicates', href: '/seo/canonicals', hint: 'Which URL should be indexed' },
    { label: 'Handles & Redirects', href: '/seo/handles-redirects', hint: 'Redirected URLs still in the sitemap' },
    { label: 'Internal Links & 404s', href: '/seo/internal-links', hint: 'How crawlers discover these pages' },
  ],
  lastAnalyzed: 'Today, 10:42 AM',
};
