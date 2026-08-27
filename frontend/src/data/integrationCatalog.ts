// ─── Integration structural metadata ─────────────────────────────────
// Provider names, descriptions and "data received" chips are a static
// catalog — the backend schema deliberately only persists connection
// STATE (status/accountDetail/lastSyncedAt/notice), see
// backend/src/db/schema.ts's integrations table comment. Same pattern
// as pillarMeta.ts.

export interface IntegrationCatalogEntry {
  provider: string;
  group: string;
  name: string;
  description: string;
  data: string[];
  /**
   * Whether a real connector exists for this provider today.
   *
   * Only Shopify has one. The rest are listed so the roadmap is visible, but they must not offer
   * a Connect button: there is nothing behind it, and a button that flips a status column without
   * authorizing anything is a false claim about the merchant's data.
   */
  available: boolean;
}

export const integrationCatalog: Record<string, IntegrationCatalogEntry> = {
  shopify: {
    provider: 'shopify',
    group: 'Store',
    name: 'Shopify',
    description: 'Products, collections, pages, blogs and theme context for every audit pillar.',
    // Must describe what the granted scopes actually permit. This previously advertised "Orders
    // and inventory", which Scorelo neither requests nor reads — read_orders is protected
    // customer data and is deliberately not part of the scope set.
    data: ['Products and collections', 'Pages, blogs and policies', 'SEO fields and metafields'],
    available: true,
  },
  'search-console': {
    provider: 'search-console',
    group: 'Analytics',
    name: 'Google Search Console',
    description: 'Search visibility, queries, clicks, impressions, and index coverage.',
    data: ['Search queries', 'Clicks and impressions', 'CTR and average position'],
    available: false,
  },
  analytics: {
    provider: 'analytics',
    group: 'Analytics',
    name: 'Google Analytics',
    description: 'Traffic, engagement, conversion and acquisition context for audits.',
    data: ['Sessions and landing pages', 'Engagement signals', 'Conversion events'],
    available: false,
  },
  pagespeed: {
    provider: 'pagespeed',
    group: 'Performance',
    name: 'PageSpeed Insights',
    description: 'Field and lab performance signals for Core Web Vitals analysis.',
    data: ['LCP, INP and CLS', 'Mobile and desktop results', 'Template performance'],
    available: false,
  },
  clarity: {
    provider: 'clarity',
    group: 'Analytics',
    name: 'Microsoft Clarity',
    description: 'Session insights that help explain friction in conversion journeys.',
    data: ['Session recordings', 'Heatmaps', 'Rage-click signals'],
    available: false,
  },
  'merchant-center': {
    provider: 'merchant-center',
    group: 'AI / Discovery',
    name: 'Google Merchant Center',
    description: 'Product feed context for shopping surfaces and AI discovery readiness.',
    data: ['Product feed status', 'Availability and price', 'Identifier coverage'],
    available: false,
  },
};

export function catalogEntryFor(provider: string): IntegrationCatalogEntry {
  return integrationCatalog[provider] ?? {
    provider, group: 'Other', name: provider, description: 'Connected data source.', data: [], available: false,
  };
}
