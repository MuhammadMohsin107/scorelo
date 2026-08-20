import { metaDescriptionsData } from '../seo-8pillars.mock';
import {
  HEALTHY,
  bySeverity,
  sortByCell,
  sortBySeverity,
  type EvidenceRow,
  type SubPillarAnalysis,
  type SubPillarFinding,
} from '../subpillar.model';

const DESC_MIN = 120;
const DESC_MAX = 160;

const { pagesAnalyzed, optimized, missing, duplicate, tooLong, tooShort, score, averageLength, ctrImpact } =
  metaDescriptionsData;
const issues = missing + duplicate + tooLong + tooShort;

const findings: SubPillarFinding[] = bySeverity([
  {
    id: 'md-missing',
    issueType: 'Missing',
    title: 'Pages with no meta description',
    severity: 'critical',
    affected: missing,
    impact: 'High',
    effort: 'Low',
    whatIsWrong: `${missing} pages have no meta description, so Google writes the snippet itself by pulling an arbitrary sentence from the page.`,
    whyItMatters:
      'An auto-generated snippet rarely leads with the benefit or the offer, which costs click-through even when the ranking is good.',
    recommendation: `Write a benefit-led description of ${DESC_MIN}–${DESC_MAX} characters that answers what the page offers and why to click.`,
  },
  {
    id: 'md-duplicate',
    issueType: 'Duplicate',
    title: 'Duplicate meta descriptions',
    severity: 'high',
    affected: duplicate,
    impact: 'High',
    effort: 'Low',
    whatIsWrong: `${duplicate} pages reuse the same description, typically a category-level sentence copied across every product in the range.`,
    whyItMatters:
      'Repeated snippets make near-identical results in the SERP, so shoppers cannot tell your pages apart before clicking.',
    recommendation: 'Give each page a description naming its own specification, use case or audience.',
  },
  {
    id: 'md-too-short',
    issueType: 'Too Short',
    title: `Descriptions shorter than ${DESC_MIN} characters`,
    severity: 'medium',
    affected: tooShort,
    impact: 'Medium',
    effort: 'Low',
    whatIsWrong: `${tooShort} descriptions fall well under the space Google renders, leaving most of the snippet empty.`,
    whyItMatters: 'Short descriptions waste free advertising space and give the searcher less reason to choose your result.',
    recommendation: `Expand each one toward ${DESC_MIN}–${DESC_MAX} characters with a concrete benefit and a call to action.`,
  },
  {
    id: 'md-too-long',
    issueType: 'Too Long',
    title: `Descriptions longer than ${DESC_MAX} characters`,
    severity: 'low',
    affected: tooLong,
    impact: 'Low',
    effort: 'Low',
    whatIsWrong: `${tooLong} descriptions exceed the rendered width and are cut off mid-sentence with an ellipsis.`,
    whyItMatters: 'The truncated tail is usually where the call to action sits, so the snippet ends on nothing persuasive.',
    recommendation: `Lead with the value proposition and keep each description within ${DESC_MAX} characters.`,
  },
]);

const row = (
  id: string,
  url: string,
  description: string,
  pageType: string,
  status: string,
  suggested?: string,
  note?: string,
): EvidenceRow => ({
  id,
  status,
  facet: pageType,
  cells: { url, pageType, description, length: description.length },
  current: { label: 'Current description', value: description, meta: url },
  suggested: suggested ? { label: 'Suggested description', value: suggested } : undefined,
  note,
});

const rows: EvidenceRow[] = [
  row('m1', '/wireless-earbuds-pro', 'Studio-grade sound with active noise cancellation, 30-hour battery and an IPX5 sweat rating. Free delivery and a two-year warranty.', 'Product', HEALTHY),
  row('m2', '/noise-cancelling-headphones', 'Block out the commute with adaptive ANC, plush memory-foam cushions and 40 hours of playback on a single charge.', 'Product', HEALTHY),
  row('m3', '/best-bluetooth-speakers', 'Compare waterproof Bluetooth speakers from pocket-size to party-ready, with battery life, output and price side by side.', 'Collection', HEALTHY),
  row('m4', '/wireless-earbuds-black', '', 'Product', 'Missing', 'Matte black wireless earbuds with active noise cancellation and 30-hour battery. Free delivery, two-year warranty.'),
  row('m5', '/wireless-earbuds-white', '', 'Product', 'Missing', 'Arctic white wireless earbuds with active noise cancellation and 30-hour battery. Free delivery, two-year warranty.'),
  row('m6', '/collections/clearance', '', 'Collection', 'Missing', 'Save up to 40% on last-season headphones, earbuds and speakers. Limited stock, full warranty still included.'),
  row('m7', '/pages/shipping', '', 'Page', 'Missing', 'Free delivery over PKR 5,000, dispatch within 24 hours and full tracking on every Acme Store order.'),
  row('m8', '/gaming-headset-surround-7-1', 'Shop premium audio equipment at Acme Store with free shipping and a two-year warranty on every order.', 'Product', 'Duplicate', 'Gaming headset with 7.1 surround, a noise-cancelling boom mic and 24-hour wireless battery for PC and console.', 'Same description on 6 product pages'),
  row('m9', '/gaming-headset-pro-max', 'Shop premium audio equipment at Acme Store with free shipping and a two-year warranty on every order.', 'Product', 'Duplicate', 'Flagship gaming headset with 7.1 surround, RGB lighting and a detachable mic. Wireless for PC, PS5 and Xbox.', 'Same description on 6 product pages'),
  row('m10', '/collections/top-rated', 'Shop premium audio equipment at Acme Store with free shipping and a two-year warranty on every order.', 'Collection', 'Duplicate', 'Every Acme audio product rated 4.5 stars and above by verified buyers, ranked by review count.', 'Same description on 6 product pages'),
  row('m11', '/portable-speaker-mini', 'A small Bluetooth speaker.', 'Product', 'Too Short', 'Pocket-size Bluetooth speaker with 24-hour battery, IPX7 waterproofing and a clip for bags and bike bars.'),
  row('m12', '/collections/new-arrivals', 'The newest audio gear.', 'Collection', 'Too Short', 'The latest headphones, earbuds and speakers to land at Acme Store, updated weekly with launch pricing.'),
  row('m13', '/pages/warranty', 'Our warranty policy.', 'Page', 'Too Short', 'Every Acme product includes a two-year warranty covering manufacturing defects, with free return shipping.'),
  row('m14', '/home-theater-soundbar-5-1', 'Transform movie nights with a 5.1 channel soundbar featuring dual wireless subwoofers, Dolby Atmos height channels, rear surround satellites, HDMI eARC connectivity, four preset listening modes and app-based room calibration for any living space.', 'Product', 'Too Long', 'Dolby Atmos 5.1 soundbar with wireless subwoofer and rear speakers. HDMI eARC and app room calibration.'),
  row('m15', '/blogs/guides/how-to-choose-headphones', 'Choosing headphones can be genuinely difficult because there are so many form factors, driver sizes, codecs and price points available today, so this guide walks through every consideration in detail before making a recommendation.', 'Blog', 'Too Long', 'How to choose headphones: form factor, noise cancellation, battery and codecs explained in plain English.'),
  row('m16', '/studio-monitor-headphones', 'Reference-grade open-back monitors with a flat response curve, built for mixing and mastering rather than casual listening.', 'Product', HEALTHY),
];

export const metaDescriptionsAnalysis: SubPillarAnalysis = {
  slug: 'meta-descriptions',
  title: 'Meta Descriptions',
  description: 'Check that every page earns its click with a unique, well-sized description in the search snippet.',
  summary: `${optimized.toLocaleString()} of ${pagesAnalyzed.toLocaleString()} crawled pages have a usable description. ${issues} need attention — ${missing} have none at all.`,
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
    criticalLabel: 'Missing',
    contextLabel: 'Average length',
    contextValue: `${averageLength} chars`,
  },
  findings,
  evidence: {
    title: 'Affected pages',
    caption: 'Pages sampled from the latest crawl with their meta description status',
    searchPlaceholder: 'Search URL or description…',
    searchKeys: ['url', 'description'],
    sampleNoun: 'crawled pages',
    facet: { label: 'Page type', allLabel: 'All page types', values: ['Product', 'Collection', 'Blog', 'Page'] },
    columns: [
      { key: 'url', header: 'Page URL', variant: 'mono', subKey: 'pageType', clamp: 'max-w-[15rem]' },
      { key: 'description', header: 'Current meta description', emptyText: 'no description', clamp: 'max-w-[24rem]' },
      { key: 'length', header: 'Length', align: 'center', variant: 'number' },
      { key: 'status', header: 'Issue', variant: 'status' },
      { key: 'severity', header: 'Severity', variant: 'severity' },
      { key: 'action', header: 'Action', align: 'right', variant: 'action' },
    ],
    rows,
    sorts: [
      sortBySeverity(findings),
      sortByCell('length', 'Sort: description length', 'desc'),
      sortByCell('url', 'Sort: URL'),
    ],
  },
  relatedAreas: [
    { label: 'Title Tags', href: '/seo/title-tags', hint: 'The other half of the search snippet' },
    { label: 'Canonicals & Duplicates', href: '/seo/canonicals', hint: 'Where duplicate snippets originate' },
    { label: 'Sitemap & Indexability', href: '/seo/sitemap', hint: 'Whether these pages can rank at all' },
  ],
  lastAnalyzed: 'Today, 10:42 AM',
};

/** Surfaced on the pillar dashboard; kept here so the figure has one home. */
export const metaDescriptionsCtrImpact = ctrImpact;
