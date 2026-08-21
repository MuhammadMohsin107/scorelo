import { titleTagsData } from '../seo-8pillars.mock';
import {
  HEALTHY,
  bySeverity,
  sortByCell,
  sortBySeverity,
  type EvidenceRow,
  type SubPillarAnalysis,
  type SubPillarFinding,
} from '../subpillar.model';

const TITLE_MIN = 30;
const TITLE_MAX = 60;

const { pagesAnalyzed, optimized, missing, duplicate, tooLong, tooShort, score, averageLength } = titleTagsData;
const issues = missing + duplicate + tooLong + tooShort;

const findings: SubPillarFinding[] = bySeverity([
  {
    id: 'tt-missing',
    issueType: 'Missing',
    title: 'Pages with no title tag',
    severity: 'critical',
    affected: missing,
    impact: 'High',
    effort: 'Low',
    whatIsWrong: `${missing} pages render without a <title> element, so search engines fall back to the page handle or an on-page heading.`,
    whyItMatters:
      'A missing title removes the strongest on-page relevance signal you control and leaves the search snippet to be generated for you.',
    recommendation: `Write a unique, keyword-relevant title of ${TITLE_MIN}–${TITLE_MAX} characters for every affected page.`,
  },
  {
    id: 'tt-duplicate',
    issueType: 'Duplicate',
    title: 'Duplicate title tags',
    severity: 'high',
    affected: duplicate,
    impact: 'High',
    effort: 'Low',
    whatIsWrong: `${duplicate} pages share their title with at least one other page, most commonly colour and size variants of the same product.`,
    whyItMatters:
      'Identical titles make pages compete for the same query, so search engines pick one and the rest lose visibility.',
    recommendation: 'Add a distinguishing modifier — variant, use case or audience — so no two titles are identical.',
  },
  {
    id: 'tt-too-long',
    issueType: 'Too Long',
    title: `Titles longer than ${TITLE_MAX} characters`,
    severity: 'medium',
    affected: tooLong,
    impact: 'Medium',
    effort: 'Low',
    whatIsWrong: `${tooLong} titles exceed ${TITLE_MAX} characters and are truncated in search results.`,
    whyItMatters:
      'When a title truncates, the part that gets cut is usually the differentiator — the brand, the offer or the key spec.',
    recommendation: `Front-load the primary keyword and trim each title to ${TITLE_MAX} characters or fewer.`,
  },
  {
    id: 'tt-too-short',
    issueType: 'Too Short',
    title: `Titles shorter than ${TITLE_MIN} characters`,
    severity: 'low',
    affected: tooShort,
    impact: 'Low',
    effort: 'Low',
    whatIsWrong: `${tooShort} titles are under ${TITLE_MIN} characters and carry little keyword context.`,
    whyItMatters: 'Short titles waste available snippet space and give search engines less to match a query against.',
    recommendation: 'Expand each title with the qualifier a shopper would actually search for.',
  },
]);

const row = (
  id: string,
  url: string,
  title: string,
  keyword: string,
  pageType: string,
  status: string,
  suggested?: string,
  note?: string,
): EvidenceRow => ({
  id,
  status,
  facet: pageType,
  cells: { url, pageType, title, keyword, length: title.length },
  current: { label: 'Current', value: title, meta: url },
  suggested: suggested ? { label: 'Suggested', value: suggested } : undefined,
  note,
});

const rows: EvidenceRow[] = [
  row('e1', '/wireless-earbuds-pro', 'Premium Wireless Earbuds - Acme Store', 'wireless earbuds', 'Product', HEALTHY),
  row('e2', '/noise-cancelling-headphones', 'Best Noise Cancelling Headphones 2024', 'noise cancelling headphones', 'Product', HEALTHY),
  row('e3', '/best-bluetooth-speakers', 'Top Bluetooth Speakers for Every Budget', 'bluetooth speakers', 'Collection', HEALTHY),
  row('e4', '/gaming-headset-guide', 'Ultimate Gaming Headset Buying Guide', 'gaming headset', 'Blog', HEALTHY),
  row('e5', '/home-audio-setup', 'Complete Home Audio System Setup Guide', 'home audio system', 'Blog', HEALTHY),
  row('e6', '/wireless-earbuds-black', '', 'wireless earbuds black', 'Product', 'Missing', 'Wireless Earbuds in Matte Black — 30h Battery | Acme'),
  row('e7', '/wireless-earbuds-white', '', 'wireless earbuds white', 'Product', 'Missing', 'Wireless Earbuds in Arctic White — 30h Battery | Acme'),
  row('e8', '/collections/clearance', '', 'audio clearance deals', 'Collection', 'Missing', 'Clearance Audio Deals — Up to 40% Off | Acme Store'),
  row('e9', '/over-ear-headphones-2024', 'Best Noise Cancelling Headphones 2024', 'over ear headphones', 'Product', 'Duplicate', 'Over-Ear Headphones with ANC — 40h Battery | Acme', 'Collides with /noise-cancelling-headphones'),
  row('e10', '/earbuds-pro-charging-case', 'Premium Wireless Earbuds - Acme Store', 'earbuds charging case', 'Product', 'Duplicate', 'Wireless Earbuds Pro Charging Case — USB-C | Acme', 'Collides with /wireless-earbuds-pro'),
  row('e11', '/collections/top-rated', 'Top Bluetooth Speakers for Every Budget', 'top rated speakers', 'Collection', 'Duplicate', 'Top-Rated Bluetooth Speakers — 4.5★ and Above | Acme', 'Collides with /best-bluetooth-speakers'),
  row('e12', '/gaming-headset-pro-max-surround', 'Gaming Headset Pro Max Wireless RGB 7.1 Surround Sound Edition For PC And Console', 'gaming headset surround sound', 'Product', 'Too Long', 'Gaming Headset Pro Max — 7.1 Surround, Wireless | Acme'),
  row('e13', '/home-theater-soundbar-5-1', 'Home Theater Soundbar 5.1 Channel With Wireless Subwoofer And Dolby Atmos Support', 'home theater soundbar', 'Product', 'Too Long', 'Home Theater Soundbar 5.1 — Dolby Atmos | Acme'),
  row('e14', '/blogs/guides/how-to-choose-headphones', 'How To Choose The Right Headphones For Running Commuting Studio Work And Gaming', 'how to choose headphones', 'Blog', 'Too Long', 'How to Choose Headphones: A Practical Buying Guide'),
  row('e15', '/portable-speaker-mini', 'Portable Speaker', 'portable bluetooth speaker', 'Product', 'Too Short', 'Portable Bluetooth Speaker — Waterproof, 24h Battery'),
  row('e16', '/collections/new-arrivals', 'New Arrivals', 'new audio products', 'Collection', 'Too Short', 'New Arrivals — Latest Headphones & Speakers | Acme'),
  row('e17', '/pages/warranty', 'Warranty', 'acme warranty policy', 'Page', 'Too Short', 'Warranty & Coverage — 2-Year Guarantee | Acme Store'),
  row('e18', '/studio-monitor-headphones', 'Studio Monitor Headphones - Reference Grade Audio', 'studio monitor headphones', 'Product', HEALTHY),
];

export const titleTagsAnalysis: SubPillarAnalysis = {
  slug: 'title-tags',
  title: 'Title Tags',
  description: 'Evaluate how effectively your store uses unique, descriptive and search-friendly page titles.',
  supportsBulkFix: true,
  bulkFixMode: 'title-tags',
  summary: `${optimized.toLocaleString()} of ${pagesAnalyzed.toLocaleString()} crawled pages have a unique, well-sized title. ${issues} need attention — ${missing} of them urgently.`,
  healthChip: `${((optimized / pagesAnalyzed) * 100).toFixed(1)}% healthy`,
  totals: {
    score,
    analyzed: pagesAnalyzed,
    healthy: optimized,
    issues,
    critical: missing,
    analyzedLabel: 'Pages analyzed',
    healthyLabel: 'Healthy',
    issuesLabel: 'Issues',
    criticalLabel: 'Critical',
    contextLabel: 'Average length',
    contextValue: `${averageLength} chars`,
  },
  findings,
  evidence: {
    title: 'Affected pages',
    caption: 'Pages sampled from the latest crawl with their title tag status',
    searchPlaceholder: 'Search URL, title or keyword…',
    searchKeys: ['url', 'title', 'keyword'],
    sampleNoun: 'crawled pages',
    facet: { label: 'Page type', allLabel: 'All page types', values: ['Product', 'Collection', 'Blog', 'Page'] },
    columns: [
      { key: 'url', header: 'Page URL', variant: 'mono', subKey: 'pageType', clamp: 'max-w-[15rem]' },
      { key: 'title', header: 'Current title', subKey: 'keyword', emptyText: 'no title tag', clamp: 'max-w-[20rem]' },
      { key: 'length', header: 'Length', align: 'center', variant: 'number' },
      { key: 'status', header: 'Issue', variant: 'status' },
      { key: 'severity', header: 'Severity', variant: 'severity' },
      { key: 'action', header: 'Action', align: 'right', variant: 'action' },
    ],
    rows,
    sorts: [sortBySeverity(findings), sortByCell('length', 'Sort: title length', 'desc'), sortByCell('url', 'Sort: URL')],
  },
  relatedAreas: [
    { label: 'Meta Descriptions', href: '/seo/meta-descriptions', hint: 'The other half of the search snippet' },
    { label: 'Canonicals & Duplicates', href: '/seo/canonicals', hint: 'Where duplicate titles usually originate' },
    { label: 'Schema / JSON-LD', href: '/seo/schema', hint: 'Structured data behind rich results' },
  ],
  lastAnalyzed: 'Today, 10:42 AM',
};
