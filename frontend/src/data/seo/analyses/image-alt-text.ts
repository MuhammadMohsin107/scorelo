import { imageAltTextData } from '../seo-8pillars.mock';
import {
  HEALTHY,
  bySeverity,
  sortByCell,
  sortBySeverity,
  type EvidenceRow,
  type SubPillarAnalysis,
  type SubPillarFinding,
} from '../subpillar.model';

const { imagesAnalyzed, optimized, missing, empty, duplicate, score, productImageCoverage } = imageAltTextData;
const issues = missing + empty + duplicate;

const findings: SubPillarFinding[] = bySeverity([
  {
    id: 'alt-missing',
    issueType: 'Missing',
    title: 'Images with no alt attribute',
    severity: 'critical',
    affected: missing,
    impact: 'High',
    effort: 'Medium',
    whatIsWrong: `${missing} images render with no alt attribute at all, mostly gallery shots uploaded in bulk.`,
    whyItMatters:
      'Screen readers announce the filename instead of the product, and the image is invisible to image search.',
    recommendation: 'Describe what the image actually shows — product, angle and any meaningful detail — in one short sentence.',
  },
  {
    id: 'alt-duplicate',
    issueType: 'Generic',
    title: 'Generic or repeated alt text',
    severity: 'high',
    affected: duplicate,
    impact: 'Medium',
    effort: 'Low',
    whatIsWrong: `${duplicate} images reuse the same alt text — typically the bare product name repeated across every shot in the gallery.`,
    whyItMatters:
      'Identical alt text tells a screen-reader user nothing about what changes between images, and adds no new context for search.',
    recommendation: 'Differentiate each image by what it depicts: front view, in use, size reference, packaging.',
  },
  {
    id: 'alt-empty',
    issueType: 'Empty',
    title: 'Empty alt attributes on meaningful images',
    severity: 'medium',
    affected: empty,
    impact: 'Medium',
    effort: 'Low',
    whatIsWrong: `${empty} images declare alt="" — correct for decorative images, but these carry product or editorial meaning.`,
    whyItMatters:
      'An empty alt tells assistive technology to skip the image entirely, so genuinely useful content is silently dropped.',
    recommendation: 'Keep alt="" only for purely decorative graphics; describe everything a sighted user would gain from.',
  },
]);

const row = (
  id: string,
  file: string,
  page: string,
  alt: string,
  imageType: string,
  status: string,
  suggested?: string,
  note?: string,
): EvidenceRow => ({
  id,
  status,
  facet: imageType,
  cells: { file, page, alt, imageType, length: alt.length },
  current: { label: 'Current alt text', value: alt, meta: file },
  suggested: suggested ? { label: 'Suggested alt text', value: suggested } : undefined,
  note,
});

const rows: EvidenceRow[] = [
  row('a1', 'earbuds-pro-front.avif', '/wireless-earbuds-pro', 'Wireless Earbuds Pro shown front-on in the open charging case', 'Product', HEALTHY),
  row('a2', 'earbuds-pro-inear.avif', '/wireless-earbuds-pro', 'Wireless Earbuds Pro worn in-ear during a run', 'Lifestyle', HEALTHY),
  row('a3', 'IMG_4471.jpg', '/gaming-headset-pro-max', '', 'Product', 'Missing', 'Gaming Headset Pro Max side profile showing the detachable boom mic'),
  row('a4', 'IMG_4472.jpg', '/gaming-headset-pro-max', '', 'Product', 'Missing', 'Gaming Headset Pro Max earcup close-up showing RGB lighting ring'),
  row('a5', 'DSC_0093.jpg', '/home-theater-soundbar-5-1', '', 'Product', 'Missing', 'Home Theater Soundbar 5.1 mounted below a wall-hung television'),
  row('a6', 'banner-summer-sale.png', '/', '', 'Banner', 'Missing', 'Summer sale — up to 40% off headphones and speakers'),
  row('a7', 'speaker-mini-1.jpg', '/portable-speaker-mini', 'Bluetooth Speaker Mini', 'Product', 'Generic', 'Bluetooth Speaker Mini standing upright, showing the control buttons'),
  row('a8', 'speaker-mini-2.jpg', '/portable-speaker-mini', 'Bluetooth Speaker Mini', 'Product', 'Generic', 'Bluetooth Speaker Mini clipped to a backpack strap for scale', 'Same alt text on 4 gallery images'),
  row('a9', 'speaker-mini-3.jpg', '/portable-speaker-mini', 'Bluetooth Speaker Mini', 'Product', 'Generic', 'Bluetooth Speaker Mini submerged in water demonstrating IPX7 rating', 'Same alt text on 4 gallery images'),
  row('a10', 'headphones-studio-2.jpg', '/studio-monitor-headphones', 'product image', 'Product', 'Generic', 'Studio Monitor Headphones resting on a mixing desk beside a fader bank'),
  row('a11', 'size-chart-headphones.png', '/studio-monitor-headphones', '', 'Diagram', 'Empty', 'Headband size chart listing measurements from 52cm to 62cm'),
  row('a12', 'battery-life-comparison.png', '/blogs/guides/how-to-choose-headphones', '', 'Diagram', 'Empty', 'Bar chart comparing battery life across six headphone models'),
  row('a13', 'divider-swirl.svg', '/blogs/guides/how-to-choose-headphones', '', 'Decorative', HEALTHY, undefined, 'Correctly marked decorative'),
  row('a14', 'soundbar-lifestyle.avif', '/home-theater-soundbar-5-1', 'Soundbar beneath a television in a living room at dusk', 'Lifestyle', HEALTHY),
];

export const imageAltTextAnalysis: SubPillarAnalysis = {
  slug: 'image-alt-text',
  title: 'Image Alt Text',
  description: 'Check that every meaningful image describes itself for assistive technology and image search.',
  summary: `${optimized.toLocaleString()} of ${imagesAnalyzed.toLocaleString()} crawled images carry descriptive alt text. ${issues} need attention — ${missing} have no alt attribute at all.`,
  healthChip: `${((optimized / imagesAnalyzed) * 100).toFixed(1)}% described`,
  totals: {
    score,
    analyzed: imagesAnalyzed,
    healthy: optimized,
    issues,
    critical: missing,
    analyzedLabel: 'Images analyzed',
    healthyLabel: 'Described',
    issuesLabel: 'Issues',
    criticalLabel: 'No alt attribute',
    contextLabel: 'Product image coverage',
    contextValue: `${productImageCoverage}%`,
  },
  findings,
  evidence: {
    title: 'Affected images',
    caption: 'Images sampled from the latest crawl with their alt-text status',
    searchPlaceholder: 'Search file, page or alt text…',
    searchKeys: ['file', 'page', 'alt'],
    sampleNoun: 'crawled images',
    facet: { label: 'Image type', allLabel: 'All image types', values: ['Product', 'Lifestyle', 'Banner', 'Diagram', 'Decorative'] },
    columns: [
      { key: 'file', header: 'Image', variant: 'mono', subKey: 'imageType', clamp: 'max-w-[14rem]' },
      { key: 'page', header: 'Page', variant: 'muted', clamp: 'max-w-[14rem]' },
      { key: 'alt', header: 'Current alt text', emptyText: 'no alt attribute', clamp: 'max-w-[22rem]' },
      { key: 'status', header: 'Issue', variant: 'status' },
      { key: 'severity', header: 'Severity', variant: 'severity' },
      { key: 'action', header: 'Action', align: 'right', variant: 'action' },
    ],
    rows,
    sorts: [sortBySeverity(findings), sortByCell('page', 'Sort: page'), sortByCell('file', 'Sort: file name')],
  },
  relatedAreas: [
    { label: 'Schema / JSON-LD', href: '/seo/schema', hint: 'Structured data for product imagery' },
    { label: 'Title Tags', href: '/seo/title-tags', hint: 'How these pages describe themselves' },
    { label: 'Internal Links & 404s', href: '/seo/internal-links', hint: 'How these pages are reached' },
  ],
  lastAnalyzed: 'Today, 10:42 AM',
};
