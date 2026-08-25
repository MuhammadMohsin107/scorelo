import type { GenericSubPillarConfig } from './genericTypes';
import { collectionDescriptionsData, metafieldCompletenessData, duplicateTemplatedCopyData, blogFreshnessData, mediaRichnessData, productDescriptionsData, priorityIssues } from '../../data/content/content.mock';

const status = (score: number) => score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Needs Work' : 'Critical';
const issueSet = (key: string) => priorityIssues.filter((issue) => issue.areaKey === key).map((issue) => ({ id: issue.id, severity: issue.severity, title: issue.title, affected: issue.affected, recommendation: issue.recommendation }));
const base = (key: string, title: string, description: string, score: number, analyzedLabel: string, analyzed: number, healthy: number, metrics: GenericSubPillarConfig['metrics'], breakdown: GenericSubPillarConfig['breakdown']): GenericSubPillarConfig => ({ pillar: 'content', pillarLabel: 'Content', key, title, description, score, statusLabel: status(score), analyzedLabel, analyzed, healthy, metrics, breakdown, issues: issueSet(key) });

export const contentPillarCatalog: Record<string, GenericSubPillarConfig> = {
  'content/product-descriptions': base('product-descriptions', 'Product Descriptions', 'Make product copy useful, specific, and persuasive across every product detail page.', productDescriptionsData.score, 'Products', productDescriptionsData.productsAnalyzed, productDescriptionsData.optimized, [
    { label: 'Missing descriptions', value: productDescriptionsData.missing, description: 'products have no description' },
    { label: 'Too short', value: productDescriptionsData.tooShort, description: 'descriptions need more useful detail' },
    { label: 'Optimized', value: productDescriptionsData.optimized, description: 'products meet the content standard' },
  ], [
    { label: 'Optimized', value: productDescriptionsData.optimized, color: 'bg-success-500' },
    { label: 'Too short', value: productDescriptionsData.tooShort, color: 'bg-warning-500' },
    { label: 'Missing', value: productDescriptionsData.missing, color: 'bg-critical-500' },
  ]),
  'content/collection-descriptions': base('collection-descriptions', 'Collection Descriptions', 'Make every collection page useful for shoppers and search engines with unique, intent-led copy.', collectionDescriptionsData.score, 'Collections', collectionDescriptionsData.collectionsAnalyzed, collectionDescriptionsData.optimized, [
    { label: 'Missing descriptions', value: collectionDescriptionsData.missing, description: 'collections have no description' },
    { label: 'Too short', value: collectionDescriptionsData.tooShort, description: 'descriptions need more useful context' },
    { label: 'Duplicate copy', value: collectionDescriptionsData.duplicate, description: 'collections share boilerplate copy' },
    { label: 'Optimized', value: collectionDescriptionsData.optimized, description: 'collections meet the content standard' },
  ], [
    { label: 'Optimized', value: collectionDescriptionsData.optimized, color: 'bg-success-500' },
    { label: 'Too Short', value: collectionDescriptionsData.tooShort, color: 'bg-warning-500' },
    { label: 'Missing', value: collectionDescriptionsData.missing, color: 'bg-critical-500' },
    { label: 'Duplicate', value: collectionDescriptionsData.duplicate, color: 'bg-surface-400' },
  ]),
  'content/metafields': base('metafields', 'Metafield Completeness', 'Complete the structured product attributes that support filtering, trust, and rich product experiences.', metafieldCompletenessData.score, 'Products', metafieldCompletenessData.productsAnalyzed, metafieldCompletenessData.complete, [
    { label: 'Incomplete products', value: metafieldCompletenessData.incomplete, description: 'products are missing one or more fields' },
    { label: 'Critical fields missing', value: metafieldCompletenessData.missingCriticalFields, description: 'trust or compliance fields need attention' },
    { label: 'Complete products', value: metafieldCompletenessData.complete, description: 'products have all applicable attributes' },
  ], [
    { label: 'Complete', value: metafieldCompletenessData.complete, color: 'bg-success-500' },
    { label: 'Incomplete', value: metafieldCompletenessData.incomplete, color: 'bg-warning-500' },
  ]),
  'content/dup-templated': base('dup-templated', 'Duplicate / Templated Copy', 'Find repetitive copy patterns that dilute product value, relevance, and buyer confidence.', duplicateTemplatedCopyData.score, 'Pages', duplicateTemplatedCopyData.pagesAnalyzed, duplicateTemplatedCopyData.unique, [
    { label: 'Potential duplicates', value: duplicateTemplatedCopyData.potentialDuplicates, description: 'pages look substantially alike' },
    { label: 'Highly templated', value: duplicateTemplatedCopyData.highlyTemplated, description: 'pages need unique selling points' },
    { label: 'Unique pages', value: duplicateTemplatedCopyData.unique, description: 'pages have distinct copy' },
  ], [
    { label: 'Unique', value: duplicateTemplatedCopyData.unique, color: 'bg-success-500' },
    { label: 'Potential duplicate', value: duplicateTemplatedCopyData.potentialDuplicates, color: 'bg-warning-500' },
    { label: 'Highly templated', value: duplicateTemplatedCopyData.highlyTemplated, color: 'bg-critical-500' },
  ]),
  'content/blog-freshness': base('blog-freshness', 'Blog Freshness', 'Keep editorial content current, useful, and aligned with the questions shoppers ask today.', blogFreshnessData.score, 'Articles', blogFreshnessData.articlesAnalyzed, blogFreshnessData.fresh, [
    { label: 'Stale articles', value: blogFreshnessData.stale, description: 'articles are overdue for review' },
    { label: 'Aging articles', value: blogFreshnessData.aging, description: 'articles should be reviewed soon' },
    { label: 'Fresh articles', value: blogFreshnessData.fresh, description: 'articles are current' },
  ], [
    { label: 'Fresh', value: blogFreshnessData.fresh, color: 'bg-success-500' },
    { label: 'Aging', value: blogFreshnessData.aging, color: 'bg-warning-500' },
    { label: 'Stale', value: blogFreshnessData.stale, color: 'bg-critical-500' },
  ]),
  'content/media-richness': base('media-richness', 'Media Richness', 'Give product pages the visual depth shoppers need to understand, compare, and trust what they are buying.', mediaRichnessData.score, 'Products', mediaRichnessData.productsAnalyzed, mediaRichnessData.richMedia, [
    { label: 'Missing media', value: mediaRichnessData.missingMedia, description: 'products need imagery or video' },
    { label: 'Limited media', value: mediaRichnessData.limitedMedia, description: 'products have thin galleries' },
    { label: 'Rich media', value: mediaRichnessData.richMedia, description: 'products have strong visual coverage' },
  ], [
    { label: 'Rich media', value: mediaRichnessData.richMedia, color: 'bg-success-500' },
    { label: 'Limited', value: mediaRichnessData.limitedMedia, color: 'bg-warning-500' },
    { label: 'Missing', value: mediaRichnessData.missingMedia, color: 'bg-critical-500' },
  ]),
};
