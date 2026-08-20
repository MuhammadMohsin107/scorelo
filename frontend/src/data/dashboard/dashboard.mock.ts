// ─── Type Definitions ───────────────────────────────────────────────

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type PillarKey = 'seo' | 'content' | 'speed' | 'cro' | 'ai-discovery';
export type ScoreStatus = 'excellent' | 'good' | 'needs-work' | 'critical';
export type TrendDirection = 'up' | 'down' | 'stable';

export interface OverallScore {
  score: number;
  status: ScoreStatus;
  statusLabel: string;
  description: string;
  trend: TrendDirection;
  trendValue: number;
}

export interface KeyMetric {
  id: string;
  label: string;
  value: number;
  statusLabel?: string;
  suffix?: string;
  trend?: TrendDirection;
  trendValue?: number;
  color: 'critical' | 'warning' | 'success' | 'info' | 'neutral';
}

export interface SubPillar {
  id: string;
  label: string;
}

export interface PillarScore {
  key: PillarKey;
  label: string;
  score: number;
  status: ScoreStatus;
  statusLabel: string;
  description: string;
  icon: string;
  checksTotal: number;
  checksPassed: number;
  subPillars: SubPillar[];
}

export interface PriorityIssue {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  pillar: PillarKey;
  pillarLabel: string;
  actionLabel: string;
}

export interface RecommendedAction {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  pillar: PillarKey;
  pillarLabel: string;
  estimatedTime: string;
}

export interface ScoreTrendPoint {
  date: string;
  score: number;
}

export interface DashboardData {
  overallScore: OverallScore;
  keyMetrics: KeyMetric[];
  pillars: PillarScore[];
  priorityIssues: PriorityIssue[];
  recommendedActions: RecommendedAction[];
  scoreTrend: ScoreTrendPoint[];
  lastUpdated: string;
  storeName: string;
  storeUrl: string;
}

// ─── Mock Data ──────────────────────────────────────────────────────

export const dashboardMockData: DashboardData = {
  storeName: 'My Shopify Store',
  storeUrl: 'myshopifystore.com',
  lastUpdated: '2026-08-18T06:00:00Z',

  overallScore: {
    score: 87,
    status: 'good',
    statusLabel: 'Good',
    description: 'Your store is performing well, with several opportunities that could improve visibility and conversions.',
    trend: 'up',
    trendValue: 3,
  },

  keyMetrics: [
    {
      id: 'overall-health',
      label: 'Overall Health',
      value: 87,
      statusLabel: 'Good',
      color: 'success',
      trend: 'up',
      trendValue: 3,
    },
    {
      id: 'issues',
      label: 'Total Issues',
      value: 8,
      color: 'warning',
      trend: 'down',
      trendValue: 2,
    },
    {
      id: 'critical',
      label: 'Critical',
      value: 2,
      color: 'critical',
    },
    {
      id: 'passed',
      label: 'Passed Checks',
      value: 48,
      color: 'success',
      trend: 'up',
      trendValue: 5,
    },
  ],

  pillars: [
    {
      key: 'seo',
      label: 'SEO',
      score: 91,
      status: 'excellent',
      statusLabel: 'Excellent',
      description: 'Strong technical SEO foundation with minor content gaps.',
      icon: 'search',
      checksTotal: 24,
      checksPassed: 22,
      subPillars: [
        { id: 'title-tags', label: 'Title tags' },
        { id: 'meta-descriptions', label: 'Meta descriptions' },
        { id: 'schema', label: 'Schema / JSON-LD' },
        { id: 'alt-text', label: 'Image alt text' },
        { id: 'canonicals', label: 'Canonicals & duplicates' },
        { id: 'handles', label: 'Handles & redirects' },
        { id: 'sitemap', label: 'Sitemap & indexability' },
        { id: 'internal-links', label: 'Internal links & 404s' },
      ],
    },
    {
      key: 'content',
      label: 'Content',
      score: 55,
      status: 'needs-work',
      statusLabel: 'Needs Work',
      description: 'Depth, uniqueness and richness of your product & brand copy.',
      icon: 'file-text',
      checksTotal: 18,
      checksPassed: 10,
      subPillars: [
        { id: 'product-descriptions', label: 'Product descriptions' },
        { id: 'collection-descriptions', label: 'Collection descriptions' },
        { id: 'metafields', label: 'Metafield completeness' },
        { id: 'dup-templated', label: 'Duplicate/templated copy' },
        { id: 'blog-freshness', label: 'Blog freshness' },
        { id: 'media-richness', label: 'Media richness' },
      ],
    },
    {
      key: 'speed',
      label: 'Speed',
      score: 84,
      status: 'good',
      statusLabel: 'Good',
      description: 'Good load times with room for image optimization.',
      icon: 'zap',
      checksTotal: 18,
      checksPassed: 15,
      subPillars: [
        { id: 'cwv', label: 'Core Web Vitals' },
        { id: 'image-weight', label: 'Image weight & format' },
        { id: 'app-bloat', label: 'App & script bloat' },
        { id: 'theme-weight', label: 'Theme weight / fonts / lazy-load' },
      ],
    },
    {
      key: 'cro',
      label: 'CRO',
      score: 78,
      status: 'needs-work',
      statusLabel: 'Needs Work',
      description: 'Conversion elements could use improvement on product pages.',
      icon: 'target',
      checksTotal: 20,
      checksPassed: 14,
      subPillars: [
        { id: 'clarity', label: 'Clarity / behavior readiness' },
        { id: 'cart-recovery', label: 'Cart recovery' },
        { id: 'trust', label: 'Trust & social proof' },
        { id: 'returns', label: 'Returns flow' },
        { id: 'tracking', label: 'Order tracking' },
        { id: 'cod', label: 'COD checkout quality' },
        { id: 'options', label: 'Product options / add-ons' },
        { id: 'subscription', label: 'Subscription opportunity' },
        { id: 'wishlist', label: 'Wishlist' },
        { id: 'locator', label: 'Store locator' },
        { id: 'mobile-ux', label: 'Mobile UX' },
      ],
    },
    {
      key: 'ai-discovery',
      label: 'AI Discovery',
      score: 82,
      status: 'good',
      statusLabel: 'Good',
      description: 'Content is generally well-structured for AI consumption.',
      icon: 'sparkles',
      checksTotal: 15,
      checksPassed: 12,
      subPillars: [
        { id: 'agents-md', label: 'agents.md / llms.txt' },
        { id: 'agentic-attrs', label: 'Agentic commerce attributes' },
        { id: 'answerable-qa', label: 'Answerable Q&A + FAQ schema' },
        { id: 'feed', label: 'Catalog / feed readiness' },
      ],
    },
  ],

  priorityIssues: [
    {
      id: 'issue-1',
      title: 'Missing product schema on 3 pages',
      description: 'Product pages without schema markup won\'t display rich results in search engines.',
      severity: 'critical',
      pillar: 'seo',
      pillarLabel: 'SEO',
      actionLabel: 'Fix issue',
    },
    {
      id: 'issue-2',
      title: '4 pages have weak meta titles',
      description: 'Meta titles are either too short, duplicated, or missing target keywords.',
      severity: 'critical',
      pillar: 'seo',
      pillarLabel: 'SEO',
      actionLabel: 'Fix issue',
    },
    {
      id: 'issue-3',
      title: 'Mobile layout shift detected on homepage',
      description: 'Cumulative Layout Shift (CLS) exceeds recommended thresholds on mobile.',
      severity: 'high',
      pillar: 'speed',
      pillarLabel: 'Speed',
      actionLabel: 'Review',
    },
    {
      id: 'issue-4',
      title: 'Product pages missing clear CTAs',
      description: 'Add-to-cart buttons are below the fold on 5 product pages.',
      severity: 'high',
      pillar: 'cro',
      pillarLabel: 'CRO',
      actionLabel: 'Review',
    },
    {
      id: 'issue-5',
      title: '3 images missing alt text',
      description: 'Images without alt text hurt SEO and accessibility.',
      severity: 'medium',
      pillar: 'seo',
      pillarLabel: 'SEO',
      actionLabel: 'Fix issue',
    },
    {
      id: 'issue-6',
      title: 'FAQ schema not present on support pages',
      description: 'Adding FAQ schema could improve search visibility for common questions.',
      severity: 'low',
      pillar: 'seo',
      pillarLabel: 'SEO',
      actionLabel: 'Review',
    },
  ],

  recommendedActions: [
    {
      id: 'rec-1',
      title: 'Fix critical schema issues',
      description: 'Add missing product schema to improve rich result eligibility across 3 product pages.',
      impact: 'high',
      pillar: 'seo',
      pillarLabel: 'SEO',
      estimatedTime: '15 min',
    },
    {
      id: 'rec-2',
      title: 'Optimize meta titles',
      description: 'Rewrite 4 weak meta titles to include primary keywords and improve click-through rates.',
      impact: 'high',
      pillar: 'seo',
      pillarLabel: 'SEO',
      estimatedTime: '20 min',
    },
    {
      id: 'rec-3',
      title: 'Improve mobile page speed',
      description: 'Reduce layout shift on mobile by setting explicit dimensions for media elements.',
      impact: 'medium',
      pillar: 'speed',
      pillarLabel: 'Speed',
      estimatedTime: '30 min',
    },
    {
      id: 'rec-4',
      title: 'Enhance product page conversions',
      description: 'Move CTA buttons above the fold and add urgency elements on product pages.',
      impact: 'medium',
      pillar: 'cro',
      pillarLabel: 'CRO',
      estimatedTime: '25 min',
    },
  ],

  scoreTrend: [
    { date: '2026-07-14', score: 72 },
    { date: '2026-07-21', score: 74 },
    { date: '2026-07-28', score: 78 },
    { date: '2026-08-04', score: 81 },
    { date: '2026-08-11', score: 84 },
    { date: '2026-08-18', score: 87 },
  ],
};
