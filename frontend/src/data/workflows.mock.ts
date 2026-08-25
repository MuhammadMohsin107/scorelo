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
  statusChangedAt: string | null;
}

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
