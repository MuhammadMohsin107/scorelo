import { handlesRedirectsData } from '../seo-8pillars.mock';
import {
  HEALTHY,
  bySeverity,
  sortByCell,
  sortBySeverity,
  type EvidenceRow,
  type SubPillarAnalysis,
  type SubPillarFinding,
} from '../subpillar.model';

const { urlsAnalyzed, cleanUrls, redirects301, redirects302, redirectChains, brokenRedirects, invalidHandles, score } =
  handlesRedirectsData;
const issues = redirectChains + brokenRedirects + invalidHandles;
// Everything that is not a chain, a broken redirect or a bad handle
// resolves in a single hop. Derived so the metric strip adds up:
// resolving + issues === urlsAnalyzed.
const resolvingCleanly = urlsAnalyzed - issues;

const findings: SubPillarFinding[] = bySeverity([
  {
    id: 'hr-broken',
    issueType: 'Broken',
    title: 'Redirects that end in a 404',
    severity: 'critical',
    affected: brokenRedirects,
    impact: 'High',
    effort: 'Low',
    whatIsWrong: `${brokenRedirects} redirects resolve to a destination that no longer exists, so the visitor lands on an error page.`,
    whyItMatters:
      'A broken redirect wastes every inbound link pointing at the old URL and sends shoppers to a dead end mid-journey.',
    recommendation: 'Repoint each redirect at the closest live equivalent, or the parent collection if the product is gone.',
  },
  {
    id: 'hr-chain',
    issueType: 'Chain',
    title: 'Redirect chains and loops',
    severity: 'high',
    affected: redirectChains,
    impact: 'Medium',
    effort: 'Low',
    whatIsWrong: `${redirectChains} URLs pass through two or more hops before reaching their destination, and two of them loop back on themselves.`,
    whyItMatters:
      'Each hop adds latency and dilutes link equity; a loop never resolves at all and is dropped from the index.',
    recommendation: 'Flatten every chain to a single 301 from the original URL straight to the final destination.',
  },
  {
    id: 'hr-handle',
    issueType: 'Handle',
    title: 'Invalid or unstable URL handles',
    severity: 'medium',
    affected: invalidHandles,
    impact: 'Medium',
    effort: 'Medium',
    whatIsWrong: `${invalidHandles} handles contain uppercase characters, underscores or auto-generated numeric suffixes such as -1 and -copy.`,
    whyItMatters:
      'Unstable handles change when products are re-saved, quietly creating new URLs and orphaning the originals.',
    recommendation: 'Normalise handles to lowercase hyphenated slugs and redirect the old form once.',
  },
]);

const row = (
  id: string,
  source: string,
  destination: string,
  type: string,
  httpStatus: string,
  linkType: string,
  status: string,
  suggested?: string,
  note?: string,
): EvidenceRow => ({
  id,
  status,
  facet: linkType,
  cells: { source, destination, type, httpStatus, linkType },
  current: { label: 'Current destination', value: destination || 'unresolved', meta: source },
  suggested: suggested ? { label: 'Should point to', value: suggested } : undefined,
  note,
});

const rows: EvidenceRow[] = [
  row('h1', '/old-earbuds-pro', '/wireless-earbuds-pro', '301', '200', 'Product', HEALTHY),
  row('h2', '/headphones-2023', '/noise-cancelling-headphones', '301', '200', 'Product', HEALTHY),
  row('h3', '/earbuds-v1', '/earbuds-v1-discontinued', '301', '404', 'Product', 'Broken', '/wireless-earbuds-pro', 'Destination was deleted in the March catalogue cleanup'),
  row('h4', '/collections/summer-sale-2025', '/collections/summer-sale', '301', '404', 'Collection', 'Broken', '/collections/clearance', 'Seasonal collection removed after the campaign ended'),
  row('h5', '/blogs/news/launch-day', '/blogs/news/launch', '301', '404', 'Blog', 'Broken', '/blogs/guides/how-to-choose-headphones', 'Article was merged into the buying guide'),
  row('h6', '/speaker-mini', '/portable-speaker-mini-old', '301', '301', 'Product', 'Chain', '/portable-speaker-mini', 'Three hops before reaching the live product'),
  row('h7', '/portable-speaker-mini-old', '/portable-speaker-mini', '301', '200', 'Product', 'Chain', '/portable-speaker-mini', 'Second hop in the chain from /speaker-mini'),
  row('h8', '/gaming-headset', '/gaming-headset-pro', '302', '301', 'Product', 'Chain', '/gaming-headset-pro-max', 'Temporary redirect feeding into a permanent one'),
  row('h9', '/collections/deals', '/collections/offers', '301', '301', 'Collection', 'Chain', '/collections/clearance', 'Loops between /deals and /offers'),
  row('h10', '/Wireless_Earbuds_PRO', '', '—', '200', 'Product', 'Handle', '/wireless-earbuds-pro', 'Uppercase and underscores in the handle'),
  row('h11', '/soundbar-5-1-copy', '', '—', '200', 'Product', 'Handle', '/home-theater-soundbar-5-1', 'Duplicate handle created by a re-save'),
  row('h12', '/studio-headphones-1', '', '—', '200', 'Product', 'Handle', '/studio-monitor-headphones', 'Numeric suffix from a duplicate title'),
  row('h13', '/old-warranty-page', '/pages/warranty', '301', '200', 'Page', HEALTHY),
  row('h14', '/blogs/guides/headphone-care', '/blogs/guides/how-to-choose-headphones', '301', '200', 'Blog', HEALTHY),
];

export const handlesRedirectsAnalysis: SubPillarAnalysis = {
  slug: 'handles-redirects',
  title: 'Handles & Redirects',
  description: 'Keep URLs stable and make sure every redirect resolves cleanly in a single hop.',
  summary: `${resolvingCleanly.toLocaleString()} of ${urlsAnalyzed.toLocaleString()} crawled URLs resolve in a single hop, ${cleanUrls.toLocaleString()} of them without any redirect at all. ${issues} need attention — ${brokenRedirects} redirects end in a 404.`,
  healthChip: `${((resolvingCleanly / urlsAnalyzed) * 100).toFixed(1)}% resolving`,
  totals: {
    score,
    analyzed: urlsAnalyzed,
    healthy: resolvingCleanly,
    issues,
    critical: brokenRedirects,
    analyzedLabel: 'URLs analyzed',
    healthyLabel: 'Resolving cleanly',
    issuesLabel: 'Issues',
    criticalLabel: 'Broken redirects',
    contextLabel: 'Redirects in place',
    contextValue: `${redirects301} × 301 · ${redirects302} × 302`,
  },
  findings,
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
    rows,
    sorts: [sortBySeverity(findings), sortByCell('source', 'Sort: source URL'), sortByCell('httpStatus', 'Sort: HTTP status', 'desc')],
  },
  relatedAreas: [
    { label: 'Internal Links & 404s', href: '/seo/internal-links', hint: 'What still links to these URLs' },
    { label: 'Canonicals & Duplicates', href: '/seo/canonicals', hint: 'How duplicate URLs consolidate' },
    { label: 'Sitemap & Indexability', href: '/seo/sitemap', hint: 'Whether redirected URLs are still listed' },
  ],
  lastAnalyzed: 'Today, 10:42 AM',
};
