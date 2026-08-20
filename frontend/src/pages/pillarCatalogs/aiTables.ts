import type { GenericSubPillarDetails } from '../PillarSubPillarPage';

const good = 'bg-success-100 text-success-700';
const warn = 'bg-warning-100 text-warning-700';
const bad = 'bg-critical-100 text-critical-700';

const makeDetails = (
  title: string,
  subtitle: string,
  searchPlaceholder: string,
  rows: GenericSubPillarDetails['table']['rows'],
  opportunities: GenericSubPillarDetails['opportunities'],
): GenericSubPillarDetails => ({
  table: {
    title,
    subtitle,
    searchPlaceholder,
    filters: ['All', 'Critical', 'Needs Work', 'Healthy'],
    statusClass: { Critical: bad, 'Needs Work': warn, Healthy: good },
    columns: [
      { key: 'signal', header: 'Signal' },
      { key: 'detail', header: 'Detail', variant: 'muted' },
      { key: 'coverage', header: 'Coverage', align: 'center', variant: 'number' },
      { key: 'status', header: 'Status', align: 'center', variant: 'status' },
      { key: 'recommendation', header: 'Recommendation', variant: 'muted' },
    ],
    rows,
  },
  opportunities,
});

const opportunities = (title: string, description: string, filter: string = 'Needs Work') => [
  { id: `${filter}-1`, title, description, impact: 'High' as const, effort: 'Low' as const, ctaLabel: 'Review Signals', filter },
  { id: `${filter}-2`, title: 'Use the strongest signals as a reference', description: 'Healthy coverage shows the structure AI agents can already understand and reuse across the catalog.', impact: 'Medium' as const, effort: 'Low' as const, ctaLabel: 'View Healthy', filter: 'Healthy' },
];

export const aiTables: Record<string, GenericSubPillarDetails> = {
  'ai-discovery/agents-md': makeDetails('AI Crawler Access Signals', 'Directive and access coverage for answer engines and shopping agents.', 'Search by crawler or directive…', [
    { id: 'agents-1', status: 'Healthy', cells: { signal: 'AI-readable pages', detail: 'Pages available to trusted agents', coverage: '1,086', recommendation: 'Keep access rules intentional' } },
    { id: 'agents-2', status: 'Needs Work', cells: { signal: 'Partial access', detail: 'Pages with incomplete directives', coverage: '214', recommendation: 'Add policy and resource guidance' } },
    { id: 'agents-3', status: 'Critical', cells: { signal: 'llms.txt', detail: 'Site-root discovery file', coverage: 'Missing', recommendation: 'Publish llms.txt and complete agents.md' } },
  ], opportunities('Publish llms.txt at the site root', 'Give AI agents a clear map of permissions, resources, and catalog context.', 'Critical')),
  'ai-discovery/agentic-attrs': makeDetails('Agentic Commerce Attribute Coverage', 'Structured product signals used by shopping agents to compare and transact.', 'Search by product attribute…', [
    { id: 'attrs-1', status: 'Healthy', cells: { signal: 'Complete attributes', detail: 'Products with reliable commerce signals', coverage: '1,042', recommendation: 'Keep price and availability current' } },
    { id: 'attrs-2', status: 'Needs Work', cells: { signal: 'SKU / GTIN', detail: 'Products with identifiers', coverage: '1,104', recommendation: 'Backfill missing identifiers' } },
    { id: 'attrs-3', status: 'Critical', cells: { signal: 'Purchase action', detail: 'Products missing buy-now signals', coverage: '86', recommendation: 'Expose add-to-cart or buy-now action' } },
  ], opportunities('Add purchase-action signals to 86 products', 'Help shopping agents confidently initiate the next step.', 'Critical')),
  'ai-discovery/answerable-qa': makeDetails('Answerable Q&A Coverage', 'Product-specific answers and FAQ schema that assistants can cite.', 'Search by question category…', [
    { id: 'qa-1', status: 'Healthy', cells: { signal: 'FAQ-ready products', detail: 'Products with answerable content', coverage: '742', recommendation: 'Keep answers specific and current' } },
    { id: 'qa-2', status: 'Needs Work', cells: { signal: 'Partial coverage', detail: 'Products with incomplete answers', coverage: '224', recommendation: 'Fill the highest-volume questions' } },
    { id: 'qa-3', status: 'Critical', cells: { signal: 'Missing FAQs', detail: 'Products without useful Q&A', coverage: '318', recommendation: 'Author product-specific FAQs' } },
  ], opportunities('Write answerable FAQs for 318 products', 'Cover the questions assistants and shoppers ask before purchase.', 'Critical')),
  'ai-discovery/feed': makeDetails('Catalog Feed Readiness', 'Product feed completeness for AI shopping and comparison surfaces.', 'Search by feed field…', [
    { id: 'feed-1', status: 'Healthy', cells: { signal: 'Feed-ready products', detail: 'Products meeting feed requirements', coverage: '1,102', recommendation: 'Monitor feed freshness' } },
    { id: 'feed-2', status: 'Needs Work', cells: { signal: 'Incomplete products', detail: 'Products missing feed data', coverage: '182', recommendation: 'Backfill required product fields' } },
    { id: 'feed-3', status: 'Critical', cells: { signal: 'Missing attributes', detail: 'Products with required fields absent', coverage: '76', recommendation: 'Complete identifiers and availability' } },
  ], opportunities('Complete feed fields for 76 products', 'Keep products eligible for AI shopping recommendations and comparisons.', 'Critical')),
};
