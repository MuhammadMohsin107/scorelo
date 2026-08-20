import { schemaJsonLdData } from '../seo-8pillars.mock';
import {
  HEALTHY,
  bySeverity,
  sortByCell,
  sortBySeverity,
  type EvidenceRow,
  type SubPillarAnalysis,
  type SubPillarFinding,
} from '../subpillar.model';

const { pagesAnalyzed, pagesWithSchema, errorCount, warningCount, score, schemaTypes } = schemaJsonLdData;

const missingSchema = pagesAnalyzed - pagesWithSchema;
const validSchema = pagesWithSchema - errorCount - warningCount;
const issues = missingSchema + errorCount + warningCount;
const typeCount = Object.keys(schemaTypes).length;

const findings: SubPillarFinding[] = bySeverity([
  {
    id: 'sc-errors',
    issueType: 'Error',
    title: 'Structured data with validation errors',
    severity: 'critical',
    affected: errorCount,
    impact: 'High',
    effort: 'Medium',
    whatIsWrong: `${errorCount} pages emit JSON-LD that fails validation — usually a missing required property such as price, availability or an offer block.`,
    whyItMatters:
      'Invalid markup is discarded entirely, so the page loses rich-result eligibility even though the schema is technically present.',
    recommendation: 'Fix the required properties flagged on each type, then re-validate before the next crawl.',
  },
  {
    id: 'sc-missing',
    issueType: 'Missing',
    title: 'Pages with no structured data',
    severity: 'high',
    affected: missingSchema,
    impact: 'High',
    effort: 'Medium',
    whatIsWrong: `${missingSchema} crawled pages emit no JSON-LD at all, including collection templates and editorial content.`,
    whyItMatters:
      'Without markup, search engines infer the page type from raw HTML and the page cannot qualify for any rich result.',
    recommendation: 'Add the appropriate type — Product, BreadcrumbList, Article or FAQPage — to each uncovered template.',
  },
  {
    id: 'sc-warnings',
    issueType: 'Warning',
    title: 'Structured data with warnings',
    severity: 'medium',
    affected: warningCount,
    impact: 'Medium',
    effort: 'Low',
    whatIsWrong: `${warningCount} pages validate but omit recommended properties such as aggregateRating, brand or shipping details.`,
    whyItMatters:
      'Warnings do not block rich results, but the missing fields are exactly the ones that make a listing visually richer.',
    recommendation: 'Populate the recommended properties for each type to unlock the fuller result format.',
  },
]);

const row = (
  id: string,
  url: string,
  types: string,
  detail: string,
  status: string,
  errors: number,
  warnings: number,
  suggested?: string,
  note?: string,
): EvidenceRow => ({
  id,
  status,
  facet: types.split(',')[0].trim() || 'None',
  cells: { url, types, errors, warnings, detail },
  current: { label: 'Detected markup', value: types || 'none', meta: url },
  suggested: suggested ? { label: 'Required fix', value: suggested } : undefined,
  note,
});

const rows: EvidenceRow[] = [
  row('s1', '/wireless-earbuds-pro', 'Product, BreadcrumbList, Review', 'Valid — all required properties present', HEALTHY, 0, 0),
  row('s2', '/noise-cancelling-headphones', 'Product, BreadcrumbList', 'Valid — all required properties present', HEALTHY, 0, 0),
  row('s3', '/over-ear-headphones-2024', 'Product, BreadcrumbList', 'Missing offers.price and offers.availability', 'Error', 2, 0, 'Add offers.price and offers.availability to the Product block'),
  row('s4', '/gaming-headset-pro-max', 'Product', 'offers block present but priceCurrency is absent', 'Error', 1, 0, 'Add offers.priceCurrency (PKR) to the Product block'),
  row('s5', '/home-theater-soundbar-5-1', 'Product, Review', 'Review markup has no itemReviewed reference', 'Error', 1, 0, 'Point Review.itemReviewed at the parent Product'),
  row('s6', '/collections/gaming-audio', 'BreadcrumbList', 'CollectionPage markup absent on a category template', 'Error', 1, 0, 'Add CollectionPage and ItemList markup to the collection template'),
  row('s7', '/best-bluetooth-speakers', 'Product, BreadcrumbList, FAQPage', 'FAQPage present but two answers are empty', 'Warning', 0, 1, 'Populate acceptedAnswer.text for every FAQ entry'),
  row('s8', '/portable-speaker-mini', 'Product, BreadcrumbList, Review', 'No aggregateRating despite 42 published reviews', 'Warning', 0, 1, 'Add aggregateRating so the star rating can appear in results'),
  row('s9', '/studio-monitor-headphones', 'Product, BreadcrumbList', 'brand and sku are not declared', 'Warning', 0, 1, 'Declare brand and sku on the Product type'),
  row('s10', '/gaming-headset-guide', '', 'No JSON-LD emitted on an editorial template', 'Missing', 0, 0, 'Add Article and BreadcrumbList markup to the blog template'),
  row('s11', '/home-audio-setup', '', 'No JSON-LD emitted on an editorial template', 'Missing', 0, 0, 'Add Article and BreadcrumbList markup to the blog template'),
  row('s12', '/wireless-earbuds-black', '', 'Variant page inherits no markup from its parent', 'Missing', 0, 0, 'Emit Product markup for variant URLs or canonicalise them to the parent'),
  row('s13', '/pages/warranty', '', 'Support page has no markup', 'Missing', 0, 0, 'Add FAQPage markup covering the warranty questions on this page'),
  row('s14', '/collections/new-arrivals', 'BreadcrumbList', 'Valid — breadcrumb trail resolves correctly', HEALTHY, 0, 0),
];

export const schemaAnalysis: SubPillarAnalysis = {
  slug: 'schema',
  title: 'Schema / JSON-LD',
  description: 'Verify that your structured data is present, valid and complete enough to earn rich results.',
  summary: `${pagesWithSchema.toLocaleString()} of ${pagesAnalyzed.toLocaleString()} crawled pages emit JSON-LD across ${typeCount} schema types. ${issues} pages need attention — ${errorCount} have blocking errors.`,
  healthChip: `${((validSchema / pagesAnalyzed) * 100).toFixed(1)}% valid`,
  totals: {
    score,
    analyzed: pagesAnalyzed,
    healthy: validSchema,
    issues,
    critical: errorCount,
    analyzedLabel: 'Pages analyzed',
    healthyLabel: 'Valid schema',
    issuesLabel: 'Issues',
    criticalLabel: 'Errors',
    contextLabel: 'Schema types in use',
    contextValue: `${typeCount}`,
  },
  findings,
  evidence: {
    title: 'Affected pages',
    caption: 'Pages sampled from the latest crawl with their structured-data status',
    searchPlaceholder: 'Search URL, type or detail…',
    searchKeys: ['url', 'types', 'detail'],
    sampleNoun: 'crawled pages',
    facet: { label: 'Schema type', allLabel: 'All schema types', values: ['Product', 'BreadcrumbList', 'None'] },
    columns: [
      { key: 'url', header: 'Page URL', variant: 'mono', clamp: 'max-w-[15rem]' },
      { key: 'types', header: 'Schema types', subKey: 'detail', emptyText: 'no markup', clamp: 'max-w-[20rem]' },
      { key: 'errors', header: 'Errors', align: 'center', variant: 'number' },
      { key: 'warnings', header: 'Warnings', align: 'center', variant: 'number' },
      { key: 'status', header: 'Issue', variant: 'status' },
      { key: 'severity', header: 'Severity', variant: 'severity' },
      { key: 'action', header: 'Action', align: 'right', variant: 'action' },
    ],
    rows,
    sorts: [sortBySeverity(findings), sortByCell('errors', 'Sort: errors', 'desc'), sortByCell('url', 'Sort: URL')],
  },
  relatedAreas: [
    { label: 'Title Tags', href: '/seo/title-tags', hint: 'What the result headline says' },
    { label: 'Meta Descriptions', href: '/seo/meta-descriptions', hint: 'What the result snippet says' },
    { label: 'Sitemap & Indexability', href: '/seo/sitemap', hint: 'Whether these pages are indexable' },
  ],
  lastAnalyzed: 'Today, 10:42 AM',
};
