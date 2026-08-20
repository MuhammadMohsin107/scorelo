import type { PillarKey } from './dashboard/dashboard.mock';

export type WorkflowSeverity = 'critical' | 'high' | 'medium' | 'low';
export type WorkflowStatus = 'open' | 'reviewed' | 'resolved' | 'ignored';

export interface FixFinding {
  id: string;
  title: string;
  pillar: PillarKey;
  pillarLabel: string;
  subPillar: string;
  severity: WorkflowSeverity;
  affected: number;
  affectedLabel: string;
  impact: 'High' | 'Medium' | 'Low';
  status: WorkflowStatus;
  scoreLift: number;
  why: string;
  evidence: string[];
  recommendation: string;
}

export const fixFindings: FixFinding[] = [
  {
    id: 'fix-title-duplicates',
    title: 'Duplicate title tags',
    pillar: 'seo',
    pillarLabel: 'SEO',
    subPillar: 'Title Tags',
    severity: 'high',
    affected: 16,
    affectedLabel: 'pages',
    impact: 'High',
    status: 'open',
    scoreLift: 2,
    why: 'Duplicate titles weaken page relevance because multiple URLs compete for the same search intent.',
    evidence: ['/over-ear-headphones-2024', '/noise-cancelling-headphones', 'Same title detected on 16 pages'],
    recommendation: 'Create unique titles with a clear product or collection modifier for every affected URL.',
  },
  {
    id: 'fix-meta-missing',
    title: 'Missing meta descriptions',
    pillar: 'seo',
    pillarLabel: 'SEO',
    subPillar: 'Meta Descriptions',
    severity: 'high',
    affected: 38,
    affectedLabel: 'pages',
    impact: 'High',
    status: 'open',
    scoreLift: 2,
    why: 'Search engines have to generate snippets without page-specific guidance, which can reduce click-through rate.',
    evidence: ['/best-bluetooth-speakers', '/wireless-earbuds-black', '38 pages have no description'],
    recommendation: 'Write concise, benefit-led descriptions between 120 and 160 characters.',
  },
  {
    id: 'fix-alt-text',
    title: 'Missing image alt text',
    pillar: 'seo',
    pillarLabel: 'SEO',
    subPillar: 'Image Alt Text',
    severity: 'medium',
    affected: 428,
    affectedLabel: 'images',
    impact: 'Medium',
    status: 'open',
    scoreLift: 1,
    why: 'Missing alternative text limits accessibility and removes useful product context from image search.',
    evidence: ['428 images have no alt text', 'Product gallery coverage is 96.2%', '96 images have empty alt attributes'],
    recommendation: 'Describe the product, viewpoint, and meaningful visual detail without keyword stuffing.',
  },
  {
    id: 'fix-images',
    title: 'Oversized product images',
    pillar: 'speed',
    pillarLabel: 'Speed',
    subPillar: 'Image Weight & Format',
    severity: 'high',
    affected: 428,
    affectedLabel: 'images',
    impact: 'High',
    status: 'open',
    scoreLift: 3,
    why: 'Large legacy images compete with page content and slow the first meaningful render on mobile.',
    evidence: ['Average image size is 224 KB', '428 images exceed the 200 KB threshold', 'Estimated savings: 38.4 MB'],
    recommendation: 'Serve responsive WebP or AVIF variants at the rendered display size.',
  },
  {
    id: 'fix-content-copy',
    title: 'Thin product descriptions',
    pillar: 'content',
    pillarLabel: 'Content',
    subPillar: 'Product Descriptions',
    severity: 'medium',
    affected: 72,
    affectedLabel: 'products',
    impact: 'Medium',
    status: 'reviewed',
    scoreLift: 2,
    why: 'Short descriptions leave shoppers without enough context to compare products or make a confident decision.',
    evidence: ['72 descriptions are under the 60-word target', 'Average product description is 47 words', '96 products need improvement'],
    recommendation: 'Expand copy with benefits, compatibility, use cases, and concrete product details.',
  },
  {
    id: 'fix-cod-otp',
    title: 'COD checkout missing OTP verification',
    pillar: 'cro',
    pillarLabel: 'CRO',
    subPillar: 'COD Checkout Quality',
    severity: 'critical',
    affected: 1840,
    affectedLabel: 'eligible orders',
    impact: 'High',
    status: 'open',
    scoreLift: 4,
    why: 'Unverified cash-on-delivery orders carry higher fraud and refusal risk.',
    evidence: ['OTP verification is disabled', 'COD refusal rate is 18%', '1,840 orders are eligible for COD'],
    recommendation: 'Add a confirmation step before placing COD orders and measure refusal-rate change.',
  },
  {
    id: 'fix-ai-feed',
    title: 'Missing purchase-action signals',
    pillar: 'ai-discovery',
    pillarLabel: 'AI Discovery',
    subPillar: 'Agentic Commerce Attributes',
    severity: 'high',
    affected: 86,
    affectedLabel: 'products',
    impact: 'Medium',
    status: 'open',
    scoreLift: 2,
    why: 'Shopping agents cannot confidently start checkout when product action signals are incomplete.',
    evidence: ['86 products lack a purchase-action signal', '1,198 products currently expose the signal', 'Feed readiness score is 90'],
    recommendation: 'Expose a structured add-to-cart or buy-now action in product markup.',
  },
];

export const integrationRecords = [
  {
    id: 'shopify',
    group: 'Store',
    name: 'Shopify',
    description: 'Store catalog, products, orders, theme and inventory context.',
    status: 'Connected' as const,
    detail: 'My Shopify Store',
    lastSynced: 'Today, 10:42 AM',
    data: ['Products and collections', 'Orders and inventory', 'Theme and storefront URLs'],
  },
  {
    id: 'search-console',
    group: 'Analytics',
    name: 'Google Search Console',
    description: 'Search visibility, queries, clicks, impressions, and index coverage.',
    status: 'Connected' as const,
    detail: 'myshopifystore.com',
    lastSynced: 'Today, 10:38 AM',
    data: ['Search queries', 'Clicks and impressions', 'CTR and average position'],
  },
  {
    id: 'analytics',
    group: 'Analytics',
    name: 'Google Analytics',
    description: 'Traffic, engagement, conversion and acquisition context for audits.',
    status: 'Needs Attention' as const,
    detail: 'Property 348219',
    lastSynced: 'Yesterday, 4:18 PM',
    data: ['Sessions and landing pages', 'Engagement signals', 'Conversion events'],
    notice: 'Authorization expired. Reconnect to resume behavioral data.',
  },
  {
    id: 'pagespeed',
    group: 'Performance',
    name: 'PageSpeed Insights',
    description: 'Field and lab performance signals for Core Web Vitals analysis.',
    status: 'Connected' as const,
    detail: 'myshopifystore.com',
    lastSynced: 'Today, 9:54 AM',
    data: ['LCP, INP and CLS', 'Mobile and desktop results', 'Template performance'],
  },
  {
    id: 'clarity',
    group: 'Analytics',
    name: 'Microsoft Clarity',
    description: 'Session insights that help explain friction in conversion journeys.',
    status: 'Not Connected' as const,
    detail: 'No project connected',
    lastSynced: 'Not available',
    data: ['Session recordings', 'Heatmaps', 'Rage-click signals'],
    notice: 'Connect Clarity to include behavioral evidence in CRO analysis.',
  },
  {
    id: 'merchant-center',
    group: 'AI / Discovery',
    name: 'Google Merchant Center',
    description: 'Product feed context for shopping surfaces and AI discovery readiness.',
    status: 'Not Connected' as const,
    detail: 'No account connected',
    lastSynced: 'Not available',
    data: ['Product feed status', 'Availability and price', 'Identifier coverage'],
  },
];

export const reportPillars = [
  { key: 'seo', label: 'SEO', current: 91, previous: 85, status: 'Excellent', color: '#4f46e5' },
  { key: 'content', label: 'Content', current: 55, previous: 56, status: 'Needs Work', color: '#f59e0b' },
  { key: 'speed', label: 'Speed', current: 84, previous: 82, status: 'Good', color: '#0ea5e9' },
  { key: 'cro', label: 'CRO', current: 78, previous: 75, status: 'Needs Work', color: '#f97316' },
  { key: 'ai-discovery', label: 'AI Discovery', current: 82, previous: 78, status: 'Good', color: '#10b981' },
];

export const reportTrend = [78, 80, 79, 82, 84, 85, 87, 91];
