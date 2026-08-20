// ─── SEO Pillar Mock Data (8 Exact Sub-Pillars) ───────────────────────

export type SeoSubPillarKey =
  | 'title-tags'
  | 'meta-descriptions'
  | 'schema'
  | 'image-alt-text'
  | 'canonicals'
  | 'handles-redirects'
  | 'sitemap'
  | 'internal-links';

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';

// ─── TITLE TAGS ─────────────────────────────────────────────────────
export const titleTagsData = {
  score: 94,
  status: 'excellent',
  pagesAnalyzed: 1284,
  optimized: 1214,
  missing: 18,
  tooLong: 24,
  tooShort: 12,
  duplicate: 16,
  averageLength: 58,
};

// ─── META DESCRIPTIONS ──────────────────────────────────────────────
export const metaDescriptionsData = {
  score: 89,
  status: 'good',
  pagesAnalyzed: 1284,
  optimized: 1146,
  missing: 38,
  tooShort: 42,
  tooLong: 34,
  duplicate: 24,
  averageLength: 156,
  ctrImpact: '+2.4% CTR improvement potential',
};

// ─── SCHEMA / JSON-LD ───────────────────────────────────────────────
export const schemaJsonLdData = {
  score: 93,
  status: 'excellent',
  pagesAnalyzed: 1342,
  pagesWithSchema: 1198,
  validTypes: 96,
  validationIssues: 18,
  errorCount: 12,
  warningCount: 6,
  schemaTypes: {
    Product: { count: 842, valid: 831, errors: 11 },
    BreadcrumbList: { count: 1284, valid: 1278, errors: 6 },
    Organization: { count: 1, valid: 1, errors: 0 },
    WebSite: { count: 1, valid: 1, errors: 0 },
    FAQPage: { count: 42, valid: 38, errors: 4 },
    Review: { count: 356, valid: 348, errors: 8 },
  },
};

// ─── IMAGE ALT TEXT ─────────────────────────────────────────────────
export const imageAltTextData = {
  score: 87,
  status: 'good',
  imagesAnalyzed: 3842,
  optimized: 3214,
  missing: 428,
  empty: 96,
  duplicate: 104,
  descriptive: 3214,
  productImageCoverage: 96.2,
};

// ─── CANONICALS & DUPLICATES ────────────────────────────────────────
export const canonicalsDuplicatesData = {
  score: 92,
  status: 'excellent',
  urlsAnalyzed: 1342,
  validCanonicals: 1260,
  duplicateUrls: 42,
  canonicalConflicts: 22,
  missingCanonicals: 18,
  selfReferencingCanonical: 1260,
};

// ─── HANDLES & REDIRECTS ────────────────────────────────────────────
export const handlesRedirectsData = {
  score: 90,
  status: 'excellent',
  urlsAnalyzed: 1342,
  cleanUrls: 1260,
  redirects301: 38,
  redirects302: 8,
  redirectChains: 24,
  brokenRedirects: 12,
  invalidHandles: 8,
};

// ─── SITEMAP & INDEXABILITY ────────────────────────────────────────
export const sitemapIndexabilityData = {
  score: 95,
  status: 'excellent',
  sitemapUrls: 1342,
  indexed: 1284,
  notIndexed: 36,
  blocked: 12,
  noindex: 10,
  excludedPages: 18,
  errors: 22,
};

// ─── INTERNAL LINKS & 404S ──────────────────────────────────────────
export const internalLinksData = {
  score: 86,
  status: 'good',
  pagesAnalyzed: 1342,
  internalLinks: 4842,
  orphanPages: 31,
  brokenLinks: 18,
  notFoundPages: 12,
  linkOpportunities: 74,
  averageLinksPerPage: 3.6,
};

// ─── OVERALL SEO KPIs ───────────────────────────────────────────────
export const seoKpis = [
  { label: 'Overall SEO Score', value: '91/100', trend: '+4.8%', status: 'excellent' },
  { label: 'Pages Analyzed', value: '1,342', trend: '+2.1%', status: 'neutral' },
  { label: 'SEO Issues', value: '18', trend: '-5', status: 'improvement' },
  { label: 'Critical Issues', value: '2', trend: '-1', status: 'improvement' },
  { label: 'Optimized Pages', value: '1,186', trend: '+3.2%', status: 'neutral' },
  { label: 'Pages Needing Attention', value: '156', trend: '-2.8%', status: 'improvement' },
];

// ─── PERFORMANCE TREND DATA ────────────────────────────────────────
export const performanceTrend = [
  { date: 'Jul 20', organicTraffic: 34800, keywords: 842, visibility: 68.2, position: 18.3 },
  { date: 'Jul 24', organicTraffic: 36100, keywords: 856, visibility: 69.1, position: 17.8 },
  { date: 'Jul 28', organicTraffic: 35900, keywords: 851, visibility: 68.9, position: 18.1 },
  { date: 'Aug 01', organicTraffic: 38400, keywords: 874, visibility: 70.2, position: 17.2 },
  { date: 'Aug 05', organicTraffic: 41200, keywords: 898, visibility: 71.4, position: 16.8 },
  { date: 'Aug 09', organicTraffic: 43700, keywords: 923, visibility: 72.1, position: 16.4 },
  { date: 'Aug 13', organicTraffic: 46100, keywords: 942, visibility: 72.8, position: 16.1 },
  { date: 'Aug 18', organicTraffic: 48200, keywords: 958, visibility: 72.4, position: 15.9 },
];

// ─── PRIORITY ISSUES ───────────────────────────────────────────────
export const priorityIssues = [
  {
    id: 'issue-1',
    severity: 'high' as IssueSeverity,
    title: 'Missing meta descriptions',
    affectedPages: 38,
    area: 'Meta Descriptions',
    areaKey: 'meta-descriptions' as SeoSubPillarKey,
    impact: 'Reduced CTR in search results',
    recommendation: 'Add compelling meta descriptions to all pages',
  },
  {
    id: 'issue-2',
    severity: 'medium' as IssueSeverity,
    title: 'Missing image alt text',
    affectedPages: 428,
    area: 'Image Alt Text',
    areaKey: 'image-alt-text' as SeoSubPillarKey,
    impact: 'Poor image SEO and accessibility',
    recommendation: 'Add descriptive alt text to all product images',
  },
  {
    id: 'issue-3',
    severity: 'high' as IssueSeverity,
    title: 'Duplicate title tags',
    affectedPages: 16,
    area: 'Title Tags',
    areaKey: 'title-tags' as SeoSubPillarKey,
    impact: 'Confused ranking signals',
    recommendation: 'Make each title tag unique and descriptive',
  },
  {
    id: 'issue-4',
    severity: 'critical' as IssueSeverity,
    title: 'Canonical conflicts',
    affectedPages: 22,
    area: 'Canonicals & Duplicates',
    areaKey: 'canonicals' as SeoSubPillarKey,
    impact: 'Duplicate content issues',
    recommendation: 'Resolve conflicting canonical tags',
  },
  {
    id: 'issue-5',
    severity: 'high' as IssueSeverity,
    title: 'Broken redirects',
    affectedPages: 12,
    area: 'Handles & Redirects',
    areaKey: 'handles-redirects' as SeoSubPillarKey,
    impact: 'Broken user experience and lost link equity',
    recommendation: 'Fix redirect chains and update links',
  },
  {
    id: 'issue-6',
    severity: 'critical' as IssueSeverity,
    title: 'Indexing issues',
    affectedPages: 22,
    area: 'Sitemap & Indexability',
    areaKey: 'sitemap' as SeoSubPillarKey,
    impact: 'Pages not appearing in search results',
    recommendation: 'Check robots.txt and meta robots tags',
  },
  {
    id: 'issue-7',
    severity: 'high' as IssueSeverity,
    title: 'Broken internal links',
    affectedPages: 18,
    area: 'Internal Links & 404s',
    areaKey: 'internal-links' as SeoSubPillarKey,
    impact: 'Poor crawlability and user experience',
    recommendation: 'Fix broken links or update navigation',
  },
];

// ─── OPPORTUNITIES ──────────────────────────────────────────────────
export const opportunities = [
  {
    id: 'opp-1',
    title: 'Improve 16 duplicate title tags',
    potentialImpact: 'High CTR improvement',
    relatedPage: 'Multiple product pages',
    recommendation: 'Add unique modifiers to titles',
    type: 'Title Tags',
  },
  {
    id: 'opp-2',
    title: 'Add missing alt text to 428 product images',
    potentialImpact: 'Image SEO + accessibility',
    relatedPage: 'Product catalog',
    recommendation: 'Use consistent alt text format',
    type: 'Image Alt Text',
  },
  {
    id: 'opp-3',
    title: 'Fix 22 canonical conflicts',
    potentialImpact: 'Improved indexing',
    relatedPage: 'Multiple categories',
    recommendation: 'Standardize canonical implementation',
    type: 'Canonicals & Duplicates',
  },
  {
    id: 'opp-4',
    title: 'Resolve 18 broken internal links',
    potentialImpact: 'Better crawlability',
    relatedPage: 'Navigation structure',
    recommendation: 'Update links or create redirects',
    type: 'Internal Links & 404s',
  },
];

// ─── TOP PERFORMING PAGES ──────────────────────────────────────────
export const topPages = [
  {
    url: '/wireless-earbuds-pro',
    title: 'Premium Wireless Earbuds - Acme Store',
    traffic: 2841,
    keywords: 142,
    avgPosition: 5.2,
    ctr: 8.4,
    seoScore: 96,
  },
  {
    url: '/noise-cancelling-headphones',
    title: 'Best Noise Cancelling Headphones 2024',
    traffic: 2156,
    keywords: 118,
    avgPosition: 7.1,
    ctr: 6.2,
    seoScore: 92,
  },
  {
    url: '/best-bluetooth-speakers',
    title: 'Top Bluetooth Speakers for Every Budget',
    traffic: 1842,
    keywords: 96,
    avgPosition: 8.3,
    ctr: 5.8,
    seoScore: 88,
  },
  {
    url: '/gaming-headset-guide',
    title: 'Ultimate Gaming Headset Buying Guide',
    traffic: 1624,
    keywords: 84,
    avgPosition: 9.2,
    ctr: 5.1,
    seoScore: 86,
  },
  {
    url: '/home-audio-setup',
    title: 'Complete Home Audio System Setup Guide',
    traffic: 1482,
    keywords: 72,
    avgPosition: 10.1,
    ctr: 4.6,
    seoScore: 82,
  },
];

// ─── KEYWORD PERFORMANCE ────────────────────────────────────────────
export const keywords = [
  { keyword: 'wireless earbuds', position: 4, volume: 33100, change: 3, intent: 'commercial' as const },
  { keyword: 'bluetooth headphones', position: 7, volume: 27100, change: 5, intent: 'commercial' as const },
  { keyword: 'noise cancelling earbuds', position: 9, volume: 18100, change: 2, intent: 'commercial' as const },
  { keyword: 'best wireless earbuds', position: 12, volume: 18100, change: 8, intent: 'informational' as const },
  { keyword: 'gaming headset', position: 15, volume: 14200, change: -2, intent: 'commercial' as const },
  { keyword: 'portable bluetooth speaker', position: 18, volume: 12400, change: 6, intent: 'commercial' as const },
  { keyword: 'earbuds under $100', position: 22, volume: 8900, change: 4, intent: 'transactional' as const },
  { keyword: 'audiophile headphones', position: 28, volume: 6200, change: -1, intent: 'informational' as const },
];

// ─── COMPETITORS ────────────────────────────────────────────────────
export const competitors = [
  { name: 'SoundTech', visibility: 78.4, keywords: 1242, traffic: '54.2K', authority: 72 },
  { name: 'AudioPro', visibility: 72.1, keywords: 1084, traffic: '48.6K', authority: 68 },
  { name: 'EchoGear', visibility: 65.8, keywords: 942, traffic: '42.1K', authority: 64 },
  { name: 'Acme Store', visibility: 72.4, keywords: 958, traffic: '48.2K', authority: 71, isUser: true },
];

// ─── RECENT ACTIVITY ────────────────────────────────────────────────
export const recentActivity = [
  { id: '1', action: 'Added 42 new internal links', timestamp: '2 hours ago', type: 'improvement' },
  { id: '2', action: 'Fixed 8 broken redirects', timestamp: '5 hours ago', type: 'fix' },
  { id: '3', action: 'Resolved 12 canonical conflicts', timestamp: '1 day ago', type: 'fix' },
  { id: '4', action: 'Added alt text to 156 product images', timestamp: '2 days ago', type: 'improvement' },
  { id: '5', action: 'Created 3 new pages for target keywords', timestamp: '3 days ago', type: 'improvement' },
  { id: '6', action: 'Updated 24 meta descriptions', timestamp: '4 days ago', type: 'update' },
];

// ─── RECOMMENDED ACTIONS ────────────────────────────────────────────
export const recommendedActions = [
  {
    id: 'action-1',
    title: 'Fix canonical conflicts',
    pages: 22,
    severity: 'critical',
    effort: 'Low',
    area: 'Canonicals & Duplicates',
  },
  {
    id: 'action-2',
    title: 'Resolve duplicate titles',
    pages: 16,
    severity: 'high',
    effort: 'Low',
    area: 'Title Tags',
  },
  {
    id: 'action-3',
    title: 'Add missing image alt text',
    pages: 428,
    severity: 'medium',
    effort: 'Medium',
    area: 'Image Alt Text',
  },
  {
    id: 'action-4',
    title: 'Fix broken internal links',
    pages: 18,
    severity: 'high',
    effort: 'Low',
    area: 'Internal Links & 404s',
  },
  {
    id: 'action-5',
    title: 'Add missing meta descriptions',
    pages: 38,
    severity: 'high',
    effort: 'Low',
    area: 'Meta Descriptions',
  },
  {
    id: 'action-6',
    title: 'Resolve schema validation errors',
    pages: 18,
    severity: 'medium',
    effort: 'Medium',
    area: 'Schema / JSON-LD',
  },
];

// ─── SEO AREAS GRID (FOR DASHBOARD) ──────────────────────────────────
export const seoAreas = [
  {
    key: 'title-tags' as SeoSubPillarKey,
    title: 'Title Tags',
    description: 'Optimize page titles for relevance and click-through performance.',
    score: 94,
    status: 'excellent',
    issueCount: 70,
    lastAnalyzed: 'Today, 10:42 AM',
  },
  {
    key: 'meta-descriptions' as SeoSubPillarKey,
    title: 'Meta Descriptions',
    description: 'Craft compelling meta descriptions to improve CTR and search visibility.',
    score: 89,
    status: 'good',
    issueCount: 138,
    lastAnalyzed: 'Today, 10:42 AM',
  },
  {
    key: 'schema' as SeoSubPillarKey,
    title: 'Schema / JSON-LD',
    description: 'Implement structured data for rich snippets and enhanced indexing.',
    score: 93,
    status: 'excellent',
    issueCount: 162,
    lastAnalyzed: 'Today, 10:42 AM',
  },
  {
    key: 'image-alt-text' as SeoSubPillarKey,
    title: 'Image Alt Text',
    description: 'Add descriptive alt text for better accessibility and image SEO.',
    score: 87,
    status: 'good',
    issueCount: 628,
    lastAnalyzed: 'Today, 10:42 AM',
  },
  {
    key: 'canonicals' as SeoSubPillarKey,
    title: 'Canonicals & Duplicates',
    description: 'Prevent duplicate content issues with proper canonical implementation.',
    score: 92,
    status: 'excellent',
    issueCount: 82,
    lastAnalyzed: 'Today, 10:42 AM',
  },
  {
    key: 'handles-redirects' as SeoSubPillarKey,
    title: 'Handles & Redirects',
    description: 'Maintain clean URLs and proper redirect chains for SEO health.',
    score: 90,
    status: 'excellent',
    issueCount: 44,
    lastAnalyzed: 'Today, 10:42 AM',
  },
  {
    key: 'sitemap' as SeoSubPillarKey,
    title: 'Sitemap & Indexability',
    description: 'Ensure all important pages are indexed by search engines.',
    score: 95,
    status: 'excellent',
    issueCount: 70,
    lastAnalyzed: 'Today, 10:42 AM',
  },
  {
    key: 'internal-links' as SeoSubPillarKey,
    title: 'Internal Links & 404s',
    description: 'Optimize internal linking structure and fix broken links.',
    score: 86,
    status: 'good',
    issueCount: 61,
    lastAnalyzed: 'Today, 10:42 AM',
  },
];
