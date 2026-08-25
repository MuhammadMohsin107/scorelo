import type { GenericSubPillarConfig } from './genericTypes';
import { agentsMdLlmsTxtData, agenticCommerceAttributesData, answerableQaFaqData, catalogFeedReadinessData, priorityIssues } from '../../data/ai-discovery/ai-discovery.mock';

const status = (score: number) => score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Needs Work' : 'Critical';
const issueSet = (key: string) => priorityIssues.filter((issue) => issue.areaKey === key).map((issue) => ({ id: issue.id, severity: issue.severity, title: issue.title, affected: issue.affectedPages, recommendation: issue.recommendation }));
const base = (key: string, title: string, description: string, score: number, analyzedLabel: string, analyzed: number, healthy: number, metrics: GenericSubPillarConfig['metrics'], breakdown: GenericSubPillarConfig['breakdown']): GenericSubPillarConfig => ({ pillar: 'ai-discovery', pillarLabel: 'AI Discovery', key, title, description, score, statusLabel: status(score), analyzedLabel, analyzed, healthy, metrics, breakdown, issues: issueSet(key) });

export const aiPillarCatalog: Record<string, GenericSubPillarConfig> = {
  'ai-discovery/agents-md': base('agents-md', 'agents.md / llms.txt', 'Make the store legible to AI crawlers and answer engines with clear, intentional access signals.', agentsMdLlmsTxtData.score, 'Pages', agentsMdLlmsTxtData.pagesAnalyzed, agentsMdLlmsTxtData.aiReadablePages, [
    { label: 'AI-readable pages', value: agentsMdLlmsTxtData.aiReadablePages, description: 'pages expose usable AI context' },
    { label: 'Blocked pages', value: agentsMdLlmsTxtData.blockedPages, description: 'pages are blocked from trusted agents' },
    { label: 'Missing directives', value: agentsMdLlmsTxtData.missingDirectives, description: 'pages lack clear crawl guidance' },
  ], [
    { label: 'Readable', value: agentsMdLlmsTxtData.aiReadablePages, color: 'bg-success-500' },
    { label: 'Partial', value: agentsMdLlmsTxtData.partialAccessPages, color: 'bg-warning-500' },
    { label: 'Blocked', value: agentsMdLlmsTxtData.blockedPages, color: 'bg-critical-500' },
  ]),
  'ai-discovery/agentic-attrs': base('agentic-attrs', 'Agentic Commerce Attributes', 'Expose reliable product, price, availability, and purchase signals to shopping agents.', agenticCommerceAttributesData.score, 'Products', agenticCommerceAttributesData.productsAnalyzed, agenticCommerceAttributesData.completeAttributes, [
    { label: 'Complete attributes', value: agenticCommerceAttributesData.completeAttributes, description: 'products are ready for agentic discovery' },
    { label: 'Incomplete attributes', value: agenticCommerceAttributesData.incompleteAttributes, description: 'products need structured signals' },
    { label: 'Missing purchase signals', value: agenticCommerceAttributesData.missingPurchaseSignals, description: 'products lack a clear action path' },
  ], [
    { label: 'Complete', value: agenticCommerceAttributesData.completeAttributes, color: 'bg-success-500' },
    { label: 'Incomplete', value: agenticCommerceAttributesData.incompleteAttributes, color: 'bg-warning-500' },
  ]),
  'ai-discovery/answerable-qa': base('answerable-qa', 'Answerable Q&A + FAQ Schema', 'Give assistants genuine product-specific answers instead of generic or unsupported claims.', answerableQaFaqData.score, 'Products', answerableQaFaqData.productsAnalyzed, answerableQaFaqData.faqReady, [
    { label: 'FAQ-ready products', value: answerableQaFaqData.faqReady, description: 'products have answerable content' },
    { label: 'Missing FAQs', value: answerableQaFaqData.missingFaqs, description: 'products need useful customer answers' },
    { label: 'Partial coverage', value: answerableQaFaqData.partialCoverage, description: 'products have incomplete coverage' },
  ], [
    { label: 'FAQ ready', value: answerableQaFaqData.faqReady, color: 'bg-success-500' },
    { label: 'Partial', value: answerableQaFaqData.partialCoverage, color: 'bg-warning-500' },
    { label: 'Missing', value: answerableQaFaqData.missingFaqs, color: 'bg-critical-500' },
  ]),
  'ai-discovery/feed': base('feed', 'Catalog / Feed Readiness', 'Keep product feeds complete so AI shopping surfaces can understand, compare, and recommend the catalog.', catalogFeedReadinessData.score, 'Products', catalogFeedReadinessData.productsAnalyzed, catalogFeedReadinessData.feedReady, [
    { label: 'Feed-ready products', value: catalogFeedReadinessData.feedReady, description: 'products meet feed requirements' },
    { label: 'Incomplete products', value: catalogFeedReadinessData.incomplete, description: 'products need feed attributes' },
    { label: 'Missing attributes', value: catalogFeedReadinessData.missingAttributes, description: 'products have required fields missing' },
  ], [
    { label: 'Feed ready', value: catalogFeedReadinessData.feedReady, color: 'bg-success-500' },
    { label: 'Incomplete', value: catalogFeedReadinessData.incomplete, color: 'bg-warning-500' },
  ]),
};
