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
}

export const integrationCatalog: Record<string, IntegrationCatalogEntry> = {
  shopify: {
    provider: 'shopify',
    group: 'Store',
    name: 'Shopify',
    description: 'Store catalog, products, orders, theme and inventory context.',
    data: ['Products and collections', 'Orders and inventory', 'Theme and storefront URLs'],
  },
  'search-console': {
    provider: 'search-console',
    group: 'Analytics',
    name: 'Google Search Console',
    description: 'Search visibility, queries, clicks, impressions, and index coverage.',
    data: ['Search queries', 'Clicks and impressions', 'CTR and average position'],
  },
  analytics: {
    provider: 'analytics',
    group: 'Analytics',
    name: 'Google Analytics',
    description: 'Traffic, engagement, conversion and acquisition context for audits.',
    data: ['Sessions and landing pages', 'Engagement signals', 'Conversion events'],
  },
  pagespeed: {
    provider: 'pagespeed',
    group: 'Performance',
    name: 'PageSpeed Insights',
    description: 'Field and lab performance signals for Core Web Vitals analysis.',
    data: ['LCP, INP and CLS', 'Mobile and desktop results', 'Template performance'],
  },
  clarity: {
    provider: 'clarity',
    group: 'Analytics',
    name: 'Microsoft Clarity',
    description: 'Session insights that help explain friction in conversion journeys.',
    data: ['Session recordings', 'Heatmaps', 'Rage-click signals'],
  },
  'merchant-center': {
    provider: 'merchant-center',
    group: 'AI / Discovery',
    name: 'Google Merchant Center',
    description: 'Product feed context for shopping surfaces and AI discovery readiness.',
    data: ['Product feed status', 'Availability and price', 'Identifier coverage'],
  },
};

export function catalogEntryFor(provider: string): IntegrationCatalogEntry {
  return integrationCatalog[provider] ?? {
    provider, group: 'Other', name: provider, description: 'Connected data source.', data: [],
  };
}
