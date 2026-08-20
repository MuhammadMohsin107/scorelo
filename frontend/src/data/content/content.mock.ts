// ─── Content Pillar Mock Data (6 Exact Sub-Pillars) ───────────────────

export type ContentSubPillarKey =
  | 'product-descriptions'
  | 'collection-descriptions'
  | 'metafields'
  | 'dup-templated'
  | 'blog-freshness'
  | 'media-richness';

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';

export type ContentStatusLabel = 'Excellent' | 'Good' | 'Needs Work' | 'Critical';

/** Shared score → status-label thresholds used across the Content pillar. */
export function statusLabelForScore(score: number): ContentStatusLabel {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs Work';
  return 'Critical';
}

// ─── PRODUCT DESCRIPTIONS ───────────────────────────────────────────
export const productDescriptionsData = {
  score: 60,
  status: 'needs-work',
  productsAnalyzed: 1284,
  optimized: 1054,
  missing: 38,
  tooShort: 72,
  duplicate: 24,
  needsImprovement: 96,
  averageWordCount: 47,
  recommendedWordCount: '60-120 words',
};

// ─── COLLECTION DESCRIPTIONS ────────────────────────────────────────
export const collectionDescriptionsData = {
  score: 52,
  status: 'needs-work',
  collectionsAnalyzed: 84,
  optimized: 47,
  missing: 12,
  tooShort: 18,
  duplicate: 7,
  averageWordCount: 38,
  recommendedWordCount: '80-150 words',
};

// ─── METAFIELD COMPLETENESS ──────────────────────────────────────────
export interface MetafieldRow {
  key: string;
  label: string;
  category: string;
  applicable: number;
  missing: number;
  critical: boolean;
}

export const metafieldCompletenessData = {
  score: 46,
  status: 'critical',
  productsAnalyzed: 1284,
  complete: 1012,
  incomplete: 272,
  missingCriticalFields: 86,
  fields: [
    { key: 'material', label: 'Material', category: 'Product Attributes', applicable: 1284, missing: 64, critical: false },
    { key: 'battery_life', label: 'Battery Life', category: 'Technical Specs', applicable: 842, missing: 58, critical: false },
    { key: 'warranty_period', label: 'Warranty Period', category: 'Trust & Support', applicable: 1284, missing: 112, critical: true },
    { key: 'care_instructions', label: 'Care Instructions', category: 'Product Attributes', applicable: 1284, missing: 38, critical: false },
    { key: 'size_chart', label: 'Size Chart', category: 'Sizing & Fit', applicable: 96, missing: 41, critical: false },
    { key: 'country_of_origin', label: 'Country of Origin', category: 'Compliance', applicable: 1284, missing: 96, critical: true },
  ] as MetafieldRow[],
};

// ─── DUPLICATE / TEMPLATED COPY ──────────────────────────────────────
export const duplicateTemplatedCopyData = {
  score: 40,
  status: 'critical',
  pagesAnalyzed: 1284,
  unique: 1076,
  potentialDuplicates: 124,
  highlyTemplated: 84,
};

// ─── BLOG FRESHNESS ───────────────────────────────────────────────────
export const blogFreshnessData = {
  score: 54,
  status: 'needs-work',
  articlesAnalyzed: 126,
  fresh: 64,
  aging: 38,
  stale: 24,
};

// ─── MEDIA RICHNESS ───────────────────────────────────────────────────
export const mediaRichnessData = {
  score: 72,
  status: 'good',
  productsAnalyzed: 1284,
  richMedia: 842,
  limitedMedia: 312,
  missingMedia: 130,
  averageImagesPerProduct: 3.4,
  productsWithVideo: 218,
};

// ─── OVERALL CONTENT KPIs ─────────────────────────────────────────────
export const contentKpis = [
  { label: 'Overall Content Score', value: '55/100', trend: '+2.1%', status: 'needs-work' },
  { label: 'Products Analyzed', value: '1,284', trend: '+58', status: 'neutral' },
  { label: 'Content Issues', value: '184', trend: '-11', status: 'improvement' },
  { label: 'Incomplete Products', value: '96', trend: '-9', status: 'improvement' },
  { label: 'Duplicate Content', value: '42', trend: '+6', status: 'decline' },
  { label: 'Stale Content', value: '31', trend: '+3', status: 'decline' },
];

// ─── PRIORITY ISSUES ───────────────────────────────────────────────────
export const priorityIssues = [
  {
    id: 'issue-1',
    severity: 'critical' as IssueSeverity,
    title: 'Highly templated product & collection copy detected',
    affected: 84,
    area: 'Duplicate/Templated Copy',
    areaKey: 'dup-templated' as ContentSubPillarKey,
    impact: 'Search engines and shoppers see repetitive, low-value copy',
    recommendation: 'Rewrite templated product copy with unique selling points per SKU',
  },
  {
    id: 'issue-2',
    severity: 'high' as IssueSeverity,
    title: 'Missing warranty & origin metafields on trust-critical products',
    affected: 86,
    area: 'Metafield Completeness',
    areaKey: 'metafields' as ContentSubPillarKey,
    impact: "Shoppers can't verify warranty coverage or compliance before buying",
    recommendation: 'Backfill warranty_period and country_of_origin metafields for all active products',
  },
  {
    id: 'issue-3',
    severity: 'high' as IssueSeverity,
    title: '38 products have no description at all',
    affected: 38,
    area: 'Product Descriptions',
    areaKey: 'product-descriptions' as ContentSubPillarKey,
    impact: 'Empty product pages hurt conversion and give search engines nothing to index',
    recommendation: 'Write unique descriptions for all products missing copy',
  },
  {
    id: 'issue-4',
    severity: 'medium' as IssueSeverity,
    title: '24 blog articles have not been updated in over a year',
    affected: 24,
    area: 'Blog Freshness',
    areaKey: 'blog-freshness' as ContentSubPillarKey,
    impact: 'Outdated guidance and pricing in old posts erode trust and search relevance',
    recommendation: 'Refresh or retire blog posts older than 12 months',
  },
  {
    id: 'issue-5',
    severity: 'medium' as IssueSeverity,
    title: '130 products are missing all imagery or video',
    affected: 130,
    area: 'Media Richness',
    areaKey: 'media-richness' as ContentSubPillarKey,
    impact: 'Thin product galleries reduce buyer confidence and conversion rate',
    recommendation: 'Add at least 3 images and one lifestyle or video asset per product',
  },
  {
    id: 'issue-6',
    severity: 'high' as IssueSeverity,
    title: '7 collection pages duplicate the same boilerplate description',
    affected: 7,
    area: 'Collection Descriptions',
    areaKey: 'collection-descriptions' as ContentSubPillarKey,
    impact: 'Duplicate collection copy dilutes category page rankings',
    recommendation: 'Write unique, keyword-relevant descriptions for each collection',
  },
  {
    id: 'issue-7',
    severity: 'low' as IssueSeverity,
    title: '72 product descriptions fall under the recommended word count',
    affected: 72,
    area: 'Product Descriptions',
    areaKey: 'product-descriptions' as ContentSubPillarKey,
    impact: 'Thin descriptions underperform in organic search and on-page conversion',
    recommendation: 'Expand short descriptions to at least 60 words covering benefits and specs',
  },
];

// ─── RECOMMENDED ACTIONS ────────────────────────────────────────────────
export const recommendedActions = [
  {
    id: 'action-1',
    title: 'Rewrite highly templated product & collection copy',
    pages: 84,
    severity: 'critical' as IssueSeverity,
    effort: 'Medium',
    area: 'Duplicate/Templated Copy',
  },
  {
    id: 'action-2',
    title: 'Backfill critical trust metafields',
    pages: 86,
    severity: 'high' as IssueSeverity,
    effort: 'Medium',
    area: 'Metafield Completeness',
  },
  {
    id: 'action-3',
    title: 'Write descriptions for products with none',
    pages: 38,
    severity: 'high' as IssueSeverity,
    effort: 'Low',
    area: 'Product Descriptions',
  },
  {
    id: 'action-4',
    title: 'Refresh stale blog content',
    pages: 24,
    severity: 'medium' as IssueSeverity,
    effort: 'Medium',
    area: 'Blog Freshness',
  },
  {
    id: 'action-5',
    title: 'Add missing product imagery & video',
    pages: 130,
    severity: 'medium' as IssueSeverity,
    effort: 'High',
    area: 'Media Richness',
  },
  {
    id: 'action-6',
    title: 'De-duplicate collection descriptions',
    pages: 7,
    severity: 'high' as IssueSeverity,
    effort: 'Low',
    area: 'Collection Descriptions',
  },
];

// ─── RECENT ACTIVITY ──────────────────────────────────────────────────
export const recentActivity = [
  { id: '1', action: 'Rewrote 18 duplicate product descriptions', timestamp: '3 hours ago', type: 'fix' },
  { id: '2', action: 'Added warranty_period metafield to 42 products', timestamp: '6 hours ago', type: 'improvement' },
  { id: '3', action: 'Published unique copy for 5 collection pages', timestamp: '1 day ago', type: 'fix' },
  { id: '4', action: 'Refreshed 6 stale blog articles', timestamp: '2 days ago', type: 'improvement' },
  { id: '5', action: 'Added product video to 24 top-selling SKUs', timestamp: '3 days ago', type: 'improvement' },
  { id: '6', action: 'Flagged 84 pages as highly templated content', timestamp: '4 days ago', type: 'update' },
];

// ─── FINDINGS (audit engine model: severity · resolution · lift) ─────
import type { Finding } from '../pillars/finding.types';

export const findings: Finding<ContentSubPillarKey>[] = [
  {
    id: 'content-f1',
    areaKey: 'product-descriptions',
    title: `${productDescriptionsData.tooShort} thin or templated product descriptions`,
    severity: 'high',
    resolution: 'Automated',
    affected: productDescriptionsData.tooShort,
    affectedLabel: 'products',
    scoreLift: 7,
    problem: `${productDescriptionsData.tooShort} products have descriptions under 60 words, and ${productDescriptionsData.duplicate} share copy verbatim across colour/size variants.`,
    impact: 'Thin PDP copy underperforms in organic search and gives shoppers too little to act on before adding to cart.',
    ctaLabel: 'Preview & fix',
    resolvedBy: 'Scorelo Auto-fix',
  },
  {
    id: 'content-f2',
    areaKey: 'product-descriptions',
    title: `${productDescriptionsData.missing} products have no description at all`,
    severity: 'high',
    resolution: 'Automated',
    affected: productDescriptionsData.missing,
    affectedLabel: 'products',
    scoreLift: 4,
    problem: 'Variant listings were created from a template and the description body was never filled in.',
    impact: 'Empty product pages convert poorly and give search engines nothing to index.',
    ctaLabel: 'Preview & fix',
    resolvedBy: 'Scorelo Auto-fix',
  },
  {
    id: 'content-f3',
    areaKey: 'collection-descriptions',
    title: `${collectionDescriptionsData.missing} collections have no intro copy`,
    severity: 'high',
    resolution: 'Automated',
    affected: collectionDescriptionsData.missing,
    affectedLabel: 'collections',
    scoreLift: 6,
    problem: `${collectionDescriptionsData.missing} of ${collectionDescriptionsData.collectionsAnalyzed} collections render a bare product grid with no descriptive heading or paragraph.`,
    impact: 'Collection pages are your highest-intent category landing pages; without copy they cannot rank for category terms.',
    ctaLabel: 'Preview & fix',
    resolvedBy: 'Scorelo Auto-fix',
  },
  {
    id: 'content-f4',
    areaKey: 'metafields',
    title: `Warranty & origin metafields missing on ${metafieldCompletenessData.missingCriticalFields} products`,
    severity: 'medium',
    resolution: 'Automated',
    affected: metafieldCompletenessData.missingCriticalFields,
    affectedLabel: 'products',
    scoreLift: 4,
    problem: '`warranty_period` and `country_of_origin` are populated on only a subset of the catalog, so theme blocks and filters that depend on them render empty.',
    impact: 'Shoppers cannot verify coverage or compliance before buying, and faceted navigation loses two trust filters.',
    ctaLabel: 'Preview & fix',
    resolvedBy: 'Scorelo Auto-fix',
  },
  {
    id: 'content-f5',
    areaKey: 'dup-templated',
    title: `Boilerplate shipping paragraph on ${duplicateTemplatedCopyData.highlyTemplated} products`,
    severity: 'medium',
    resolution: 'Automated',
    affected: duplicateTemplatedCopyData.highlyTemplated,
    affectedLabel: 'pages',
    scoreLift: 3,
    problem: `A 40-word shipping & returns paragraph appears verbatim inside the description body of ${duplicateTemplatedCopyData.highlyTemplated} products.`,
    impact: 'Repeated blocks dilute page uniqueness and push the genuinely useful copy below the fold.',
    ctaLabel: 'Preview & fix',
    resolvedBy: 'Scorelo Auto-fix',
  },
  {
    id: 'content-f6',
    areaKey: 'blog-freshness',
    title: `Blog is stale — ${blogFreshnessData.stale} articles over 12 months old`,
    severity: 'medium',
    resolution: 'Service',
    affected: blogFreshnessData.stale,
    affectedLabel: 'articles',
    scoreLift: 5,
    problem: `${blogFreshnessData.stale} buying guides and how-tos reference discontinued models and old pricing; the most recent post is over 4 months old.`,
    impact: 'Outdated guidance erodes trust and search relevance on the pages that should be winning informational queries.',
    ctaLabel: 'Request a quote',
    resolvedBy: 'Content Refresh service · Small scope',
  },
  {
    id: 'content-f7',
    areaKey: 'media-richness',
    title: `Sparse media on ${mediaRichnessData.missingMedia} products`,
    severity: 'medium',
    resolution: 'Deferred',
    affected: mediaRichnessData.missingMedia,
    affectedLabel: 'products',
    scoreLift: 4,
    problem: `Only ${Math.round((mediaRichnessData.productsWithVideo / mediaRichnessData.productsAnalyzed) * 100)}% of products have video and ${mediaRichnessData.missingMedia} ship with a single image or none.`,
    impact: 'Thin galleries reduce buyer confidence; video on PDPs lifts conversion on considered purchases.',
    ctaLabel: 'Snoozed for now',
  },
];
