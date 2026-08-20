import { internalLinksData } from '../seo-8pillars.mock';
import {
  HEALTHY,
  bySeverity,
  sortByCell,
  sortBySeverity,
  type EvidenceRow,
  type SubPillarAnalysis,
  type SubPillarFinding,
} from '../subpillar.model';

const {
  pagesAnalyzed,
  internalLinks,
  orphanPages,
  brokenLinks,
  notFoundPages,
  linkOpportunities,
  averageLinksPerPage,
  score,
} = internalLinksData;

const issues = brokenLinks + notFoundPages + orphanPages;
const healthyPages = pagesAnalyzed - issues;

const findings: SubPillarFinding[] = bySeverity([
  {
    id: 'il-broken',
    issueType: 'Broken Link',
    title: 'Internal links pointing at a 404',
    severity: 'critical',
    affected: brokenLinks,
    impact: 'High',
    effort: 'Low',
    whatIsWrong: `${brokenLinks} internal links resolve to a missing page — mostly navigation and in-body links to products removed in the last catalogue cleanup.`,
    whyItMatters:
      'Broken links strand shoppers mid-journey and stop crawlers from reaching whatever sat behind that link.',
    recommendation: 'Repoint each link at the live equivalent, or remove it where the destination is genuinely gone.',
  },
  {
    id: 'il-404',
    issueType: '404 Page',
    title: 'URLs returning 404 that still receive traffic',
    severity: 'high',
    affected: notFoundPages,
    impact: 'High',
    effort: 'Low',
    whatIsWrong: `${notFoundPages} URLs return a 404 but still receive internal links, external links or organic clicks.`,
    whyItMatters:
      'These URLs still hold accumulated authority; leaving them dead discards it and produces avoidable error sessions.',
    recommendation: 'Add a 301 to the nearest live equivalent for every 404 that still attracts traffic or links.',
  },
  {
    id: 'il-orphan',
    issueType: 'Orphan',
    title: 'Pages with no internal links pointing to them',
    severity: 'medium',
    affected: orphanPages,
    impact: 'Medium',
    effort: 'Medium',
    whatIsWrong: `${orphanPages} indexable pages receive no internal links at all — reachable only through the sitemap or a direct URL.`,
    whyItMatters:
      'Orphan pages get crawled rarely and inherit almost no authority, so they compete poorly no matter how good the content is.',
    recommendation: 'Link each orphan from a relevant collection, guide or related-products block.',
  },
]);

const row = (
  id: string,
  source: string,
  target: string,
  anchor: string,
  httpStatus: string,
  linkType: string,
  status: string,
  suggested?: string,
  note?: string,
): EvidenceRow => ({
  id,
  status,
  facet: linkType,
  cells: { source, target, anchor, httpStatus, linkType },
  current: { label: 'Link target', value: target, meta: `${source} → ${target}` },
  suggested: suggested ? { label: 'Should point to', value: suggested } : undefined,
  note,
});

const rows: EvidenceRow[] = [
  row('l1', '/collections/gaming-audio', '/gaming-headset-pro-max', 'Gaming Headset Pro Max', '200', 'In-body', HEALTHY),
  row('l2', '/blogs/guides/how-to-choose-headphones', '/noise-cancelling-headphones', 'noise-cancelling models', '200', 'In-body', HEALTHY),
  row('l3', '/collections/gaming-audio', '/gaming-headset-v1', 'Gaming Headset V1', '404', 'In-body', 'Broken Link', '/gaming-headset-pro-max', 'Product removed in the March cleanup'),
  row('l4', '/', '/collections/summer-sale', 'Summer Sale', '404', 'Navigation', 'Broken Link', '/collections/clearance', 'Seasonal collection deleted after the campaign'),
  row('l5', '/blogs/guides/how-to-choose-headphones', '/earbuds-v1', 'our entry-level earbuds', '404', 'In-body', 'Broken Link', '/wireless-earbuds-pro', 'Linked from a high-traffic guide'),
  row('l6', '/pages/warranty', '/pages/returns-policy', 'returns policy', '404', 'In-body', 'Broken Link', '/pages/shipping', 'Page was merged into shipping'),
  row('l7', '/footer', '/blogs/news/launch-day', 'Launch day', '404', 'Footer', 'Broken Link', '/blogs/guides/how-to-choose-headphones', 'Site-wide footer link'),
  row('l8', '—', '/old-earbuds-pro', '—', '404', 'External', '404 Page', '/wireless-earbuds-pro', '84 organic sessions in the last 30 days'),
  row('l9', '—', '/collections/summer-sale-2025', '—', '404', 'External', '404 Page', '/collections/clearance', '31 organic sessions in the last 30 days'),
  row('l10', '—', '/headphones-2023', '—', '404', 'External', '404 Page', '/noise-cancelling-headphones', '3 referring domains still point here'),
  row('l11', '—', '/studio-monitor-headphones', '—', '200', 'Orphan', 'Orphan', 'Link from /collections/all and the studio buying guide', 'No internal links point to this page'),
  row('l12', '—', '/pages/shipping', '—', '200', 'Orphan', 'Orphan', 'Link from the footer and the checkout confirmation page', 'No internal links point to this page'),
  row('l13', '—', '/blogs/news/spring-restock', '—', '200', 'Orphan', 'Orphan', 'Link from the blog index and related-articles block', 'No internal links point to this page'),
  row('l14', '/collections/new-arrivals', '/wireless-earbuds-pro', 'Wireless Earbuds Pro', '200', 'In-body', HEALTHY),
  row('l15', '/', '/collections/gaming-audio', 'Gaming Audio', '200', 'Navigation', HEALTHY),
];

export const internalLinksAnalysis: SubPillarAnalysis = {
  slug: 'internal-links',
  title: 'Internal Links & 404s',
  description: 'Make sure crawlers and shoppers can reach every page, and that no link leads to a dead end.',
  summary: `${internalLinks.toLocaleString()} internal links were followed across ${pagesAnalyzed.toLocaleString()} pages. ${issues} need attention — ${brokenLinks} links resolve to a 404.`,
  healthChip: `${((healthyPages / pagesAnalyzed) * 100).toFixed(1)}% healthy`,
  totals: {
    score,
    analyzed: pagesAnalyzed,
    healthy: healthyPages,
    issues,
    critical: brokenLinks,
    analyzedLabel: 'Pages analyzed',
    healthyLabel: 'Healthy pages',
    issuesLabel: 'Issues',
    criticalLabel: 'Broken links',
    contextLabel: 'Average links per page',
    contextValue: `${averageLinksPerPage}`,
  },
  findings,
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
    rows,
    sorts: [sortBySeverity(findings), sortByCell('httpStatus', 'Sort: HTTP status', 'desc'), sortByCell('target', 'Sort: target URL')],
  },
  relatedAreas: [
    { label: 'Handles & Redirects', href: '/seo/handles-redirects', hint: 'Where these 404s should redirect' },
    { label: 'Sitemap & Indexability', href: '/seo/sitemap', hint: 'How orphan pages get discovered' },
    { label: 'Canonicals & Duplicates', href: '/seo/canonicals', hint: 'Which URL links should point at' },
  ],
  lastAnalyzed: 'Today, 10:42 AM',
};

/** Linking opportunities surfaced by the crawl, shown on the pillar dashboard. */
export const internalLinkOpportunities = linkOpportunities;
