// ─── AI Discovery Pillar Mock Data (4 Sub-Pillars) ────────────────────
// Mirrors the shape/pattern used by src/data/seo/seo-8pillars.mock.ts so
// the AI Discovery dashboard and each sub-pillar detail page always read
// from the same source of truth and can never disagree.

export type AiDiscoverySubPillarKey =
  | 'agents-md'
  | 'agentic-attrs'
  | 'answerable-qa'
  | 'feed';

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';

// ─── AGENTS.MD / LLMS.TXT ──────────────────────────────────────────
// AI-crawler access & directive coverage: is the store readable and
// well-signposted for AI agents, answer engines, and LLM crawlers?
export const agentsMdLlmsTxtData = {
  score: 80,
  status: 'good',
  pagesAnalyzed: 1342,
  aiReadablePages: 1086,
  partialAccessPages: 214,
  blockedPages: 42,
  missingDirectives: 18,
  agentsMdStatus: 'partial' as 'present' | 'partial' | 'missing',
  llmsTxtStatus: 'missing' as 'present' | 'partial' | 'missing',
  trackedAiAgents: 10,
  allowedAiAgents: 6,
  restrictedAiAgents: 2,
  unspecifiedAiAgents: 2,
};

// ─── AGENTIC COMMERCE ATTRIBUTES ───────────────────────────────────
// Structured price / availability / identifier / purchase-action
// signals that let AI shopping agents transact confidently.
export const agenticCommerceAttributesData = {
  score: 83,
  status: 'good',
  productsAnalyzed: 1284,
  completeAttributes: 1042,
  incompleteAttributes: 242,
  missingPurchaseSignals: 86,
  priceAttributeCoverage: 1246,
  availabilityAttributeCoverage: 1198,
  skuGtinCoverage: 1104,
  purchaseActionSignalCoverage: 1198,
};

// ─── ANSWERABLE Q&A + FAQ SCHEMA ───────────────────────────────────
// Genuine, product-specific answerable content plus FAQPage schema
// markup that AI assistants and answer engines can parse directly.
export const answerableQaFaqData = {
  score: 75,
  status: 'good',
  productsAnalyzed: 1284,
  faqReady: 742,
  missingFaqs: 318,
  partialCoverage: 224,
  schemaReady: 924,
  schemaWithoutContent: 182,
  questionCategories: {
    'Battery Life': { count: 1284, answered: 618, missing: 666 },
    'Waterproofing / Durability': { count: 842, answered: 402, missing: 440 },
    'Device Compatibility': { count: 1284, answered: 714, missing: 570 },
    'Sizing & Fit': { count: 512, answered: 268, missing: 244 },
    'Care & Maintenance': { count: 1284, answered: 388, missing: 896 },
  },
};

// ─── CATALOG / FEED READINESS ──────────────────────────────────────
// Product feed completeness for AI shopping agents & LLM-based
// discovery surfaces (structured feed fields beyond classic SEO).
export const catalogFeedReadinessData = {
  score: 90,
  status: 'excellent',
  productsAnalyzed: 1284,
  feedReady: 1102,
  incomplete: 182,
  missingAttributes: 76,
  totalFeedFields: 10,
  averageFieldsComplete: 8.7,
};

// ─── OVERALL AI DISCOVERY KPIs ──────────────────────────────────────
// Index 0 = overall pillar score (must equal 82/100 to match
// dashboard.types.ts's ai-discovery pillar entry). Exactly 5 more
// summary KPIs mirror seoKpis' shape.
export const aiDiscoveryKpis = [
  { label: 'Overall AI Discovery Score', value: '82/100', trend: '+3.6%', status: 'good' },
  { label: 'AI Readiness', value: '82%', trend: '+5.0%', status: 'excellent' },
  { label: 'Pages Analyzed', value: '1,342', trend: '+3.4%', status: 'neutral' },
  { label: 'AI Opportunities', value: '28', trend: '-6', status: 'improvement' },
  { label: 'Missing Signals', value: '14', trend: '-3', status: 'improvement' },
  { label: 'AI-Ready Products', value: '1,102', trend: '+4.1%', status: 'neutral' },
];

// ─── PRIORITY ISSUES ─────────────────────────────────────────────────
export const priorityIssues = [
  {
    id: 'ai-issue-1',
    severity: 'critical' as IssueSeverity,
    title: 'llms.txt file missing from site root',
    affectedPages: 1342,
    area: 'agents.md / llms.txt',
    areaKey: 'agents-md' as AiDiscoverySubPillarKey,
    impact: 'AI agents and LLM-based assistants cannot discover structured access permissions or key resources',
    recommendation: 'Publish an llms.txt file at the domain root describing crawl permissions and key resources',
  },
  {
    id: 'ai-issue-2',
    severity: 'high' as IssueSeverity,
    title: 'PerplexityBot and Bytespider blocked site-wide',
    affectedPages: 1342,
    area: 'agents.md / llms.txt',
    areaKey: 'agents-md' as AiDiscoverySubPillarKey,
    impact: 'Store is invisible to two major AI answer engines and their shopping surfaces',
    recommendation: 'Review robots.txt disallow rules and selectively allow trusted AI crawlers',
  },
  {
    id: 'ai-issue-3',
    severity: 'high' as IssueSeverity,
    title: '86 products missing a purchase-action signal',
    affectedPages: 86,
    area: 'Agentic Commerce Attributes',
    areaKey: 'agentic-attrs' as AiDiscoverySubPillarKey,
    impact: 'Shopping agents cannot confidently initiate checkout for these products',
    recommendation: 'Expose structured add-to-cart / buy-now signals in product markup',
  },
  {
    id: 'ai-issue-4',
    severity: 'medium' as IssueSeverity,
    title: '180 products missing SKU/GTIN identifiers',
    affectedPages: 180,
    area: 'Agentic Commerce Attributes',
    areaKey: 'agentic-attrs' as AiDiscoverySubPillarKey,
    impact: 'AI agents cannot reliably match products across marketplaces and comparison feeds',
    recommendation: 'Backfill GTIN or MPN identifiers for all catalog products',
  },
  {
    id: 'ai-issue-5',
    severity: 'high' as IssueSeverity,
    title: '318 products have no answerable FAQ content',
    affectedPages: 318,
    area: 'Answerable Q&A + FAQ Schema',
    areaKey: 'answerable-qa' as AiDiscoverySubPillarKey,
    impact: 'AI assistants default to generic or no answers for common product questions',
    recommendation: 'Author product-specific Q&A covering the most common customer questions',
  },
  {
    id: 'ai-issue-6',
    severity: 'medium' as IssueSeverity,
    title: '76 products missing required feed identifiers',
    affectedPages: 76,
    area: 'Catalog / Feed Readiness',
    areaKey: 'feed' as AiDiscoverySubPillarKey,
    impact: 'Products may be excluded from AI shopping agent recommendations and comparison feeds',
    recommendation: 'Complete missing GTIN/MPN and identifier fields in the product feed',
  },
];

// ─── RECOMMENDED ACTIONS ─────────────────────────────────────────────
export const recommendedActions = [
  {
    id: 'ai-action-1',
    title: 'Publish llms.txt at site root',
    pages: 1342,
    severity: 'critical',
    effort: 'Low',
    area: 'agents.md / llms.txt',
  },
  {
    id: 'ai-action-2',
    title: 'Allow trusted AI crawlers in robots.txt',
    pages: 1342,
    severity: 'high',
    effort: 'Low',
    area: 'agents.md / llms.txt',
  },
  {
    id: 'ai-action-3',
    title: 'Add purchase-action signals to product markup',
    pages: 86,
    severity: 'high',
    effort: 'Medium',
    area: 'Agentic Commerce Attributes',
  },
  {
    id: 'ai-action-4',
    title: 'Backfill missing SKU/GTIN identifiers',
    pages: 180,
    severity: 'medium',
    effort: 'Medium',
    area: 'Agentic Commerce Attributes',
  },
  {
    id: 'ai-action-5',
    title: 'Write answerable FAQ content for uncovered products',
    pages: 318,
    severity: 'high',
    effort: 'High',
    area: 'Answerable Q&A + FAQ Schema',
  },
  {
    id: 'ai-action-6',
    title: 'Complete missing feed identifier fields',
    pages: 76,
    severity: 'medium',
    effort: 'Low',
    area: 'Catalog / Feed Readiness',
  },
];

// ─── RECENT ACTIVITY ──────────────────────────────────────────────────
export const recentActivity = [
  { id: '1', action: 'Published updated robots.txt rules for 4 AI crawlers', timestamp: '3 hours ago', type: 'update' },
  { id: '2', action: 'Added purchase-action signals to 54 products', timestamp: '6 hours ago', type: 'improvement' },
  { id: '3', action: 'Backfilled GTIN identifiers for 96 products', timestamp: '1 day ago', type: 'fix' },
  { id: '4', action: 'Generated FAQ schema for 28 product pages', timestamp: '2 days ago', type: 'improvement' },
  { id: '5', action: 'Resolved 12 incomplete feed listings', timestamp: '3 days ago', type: 'fix' },
  { id: '6', action: 'Reviewed AI agent access logs for GPTBot and ClaudeBot', timestamp: '4 days ago', type: 'update' },
];

// ─── FINDINGS (audit engine model: severity · resolution · lift) ─────
import type { Finding } from '../pillars/finding.types';

export const findings: Finding<AiDiscoverySubPillarKey>[] = [
  {
    id: 'ai-f1',
    areaKey: 'agents-md',
    title: 'llms.txt is missing and agents.md is incomplete',
    severity: 'critical',
    resolution: 'Automated',
    affected: 1,
    affectedLabel: 'site root',
    scoreLift: 6,
    problem: `No llms.txt exists at the domain root and agents.md omits ${agentsMdLlmsTxtData.missingDirectives} directives (policies, catalog endpoints, support contact). ${agentsMdLlmsTxtData.blockedPages} pages are blocked for AI crawlers.`,
    impact: 'Answer engines and shopping agents cannot discover brand policies or catalog structure, so the store is skipped for agentic queries.',
    ctaLabel: 'Preview & fix',
    resolvedBy: 'Scorelo Auto-fix',
  },
  {
    id: 'ai-f2',
    areaKey: 'agentic-attrs',
    title: `Agent-facing attributes missing on ${agenticCommerceAttributesData.incompleteAttributes} products`,
    severity: 'high',
    resolution: 'Automated',
    affected: agenticCommerceAttributesData.incompleteAttributes,
    affectedLabel: 'products',
    scoreLift: 4,
    problem: `Returns window, shipping class, subscription eligibility and GTIN are absent from product markup on ${agenticCommerceAttributesData.incompleteAttributes} products; ${agenticCommerceAttributesData.missingPurchaseSignals} lack a purchase-action signal entirely.`,
    impact: 'AI shopping agents will not recommend or transact on products whose purchase terms they cannot read.',
    ctaLabel: 'Bulk fix all',
    resolvedBy: 'Scorelo Auto-fix',
  },
  {
    id: 'ai-f3',
    areaKey: 'answerable-qa',
    title: `No FAQPage schema on ${answerableQaFaqData.missingFaqs} PDPs; 12 recurring pre-sale questions unanswered`,
    severity: 'high',
    resolution: 'Automated',
    affected: answerableQaFaqData.missingFaqs,
    affectedLabel: 'products',
    scoreLift: 4,
    problem: 'The support inbox shows the same 12 questions (battery life, waterproofing, device compatibility) but the PDPs neither answer them nor expose FAQPage markup.',
    impact: 'Assistants fall back to generic answers — or a competitor whose page answers the question — for high-intent questions.',
    ctaLabel: 'Bulk fix all',
    resolvedBy: 'Scorelo Auto-fix',
  },
  {
    id: 'ai-f4',
    areaKey: 'feed',
    title: `${catalogFeedReadinessData.missingAttributes} products missing feed identifiers; no agentic feed variant`,
    severity: 'medium',
    resolution: 'Automated',
    affected: catalogFeedReadinessData.missingAttributes,
    affectedLabel: 'products',
    scoreLift: 3,
    problem: `${catalogFeedReadinessData.incomplete} feed rows are incomplete and ${catalogFeedReadinessData.missingAttributes} lack GTIN/MPN; no feed variant carries the agent-specific fields (returns, shipping, availability windows).`,
    impact: 'Incomplete rows are dropped from comparison surfaces and agent catalogs, removing the product from AI-driven discovery.',
    ctaLabel: 'Bulk fix all',
    resolvedBy: 'Scorelo Auto-fix',
  },
];
