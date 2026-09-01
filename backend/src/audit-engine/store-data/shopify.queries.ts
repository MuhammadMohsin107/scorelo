import type { Connection, ShopifyClient } from './shopify-client.js';
import { StoreDataError } from './types.js';

/**
 * ─── GraphQL Admin API documents ─────────────────────────────────────
 * Written against SHOPIFY_API_VERSION in shopify-client.ts. The REST Admin API these queries
 * replaced has been legacy since 2024-10-01, and public apps have had to be built exclusively
 * on GraphQL since 2025-04-01.
 *
 * Beyond compliance, GraphQL removes an N+1 that REST forced: `seo { title description }` and
 * `metafields` come back inline with each product, so the old "sample the first 50 products,
 * one extra request each, and mark the rest unknown" workaround is gone. Every product in the
 * snapshot now carries real SEO and metafield data.
 *
 * Field-name notes (all verified against the current schema):
 *   Product.images / Product.bodyHtml / Product.totalVariants are deprecated — use media,
 *     descriptionHtml and variantsCount { count }.
 *   Shop.email does not exist — the public contact address is Shop.contactEmail.
 *   Page and Article have NO `seo` field. Their SEO overrides live where the online store puts
 *     them: the `global.title_tag` / `global.description_tag` metafields.
 */

export interface GqlSeo {
  title: string | null;
  description: string | null;
}

/**
 * Variants read per product for the CRO and AI Discovery checks (identifiers, price, availability).
 *
 * Bounded for two reasons. Cost: the products page already requests 250 products with 20 media and
 * 25 metafields each, and every nested connection multiplies the calculated query cost — verified
 * against a live shop at this exact page size before being committed. Memory: the snapshot holds
 * the whole catalogue at once, up to PRODUCT_SAFETY_CEILING, so an unbounded variant list would
 * dominate it. Products with more variants than this are marked `variantsTruncated` rather than
 * silently scored on a partial read.
 */
const VARIANT_SAMPLE_LIMIT = 25;

export interface GqlMetafield {
  namespace: string | null;
  key: string | null;
  type: string | null;
  value: string | null;
}

export interface GqlMediaImage {
  id: string | null;
  alt: string | null;
  image: { url: string | null; width: number | null; height: number | null } | null;
}

export interface GqlProductOption {
  name: string | null;
  values: string[] | null;
}

export interface GqlProductVariant {
  id: string | null;
  sku: string | null;
  barcode: string | null;
  /** Money is serialized as a decimal STRING, never a number — see the theme-asset `size` bug. */
  price: string | null;
  availableForSale: boolean | null;
}

export interface GqlProduct {
  id: string | null;
  title: string | null;
  handle: string | null;
  descriptionHtml: string | null;
  productType: string | null;
  vendor: string | null;
  tags: string[] | null;
  status: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  onlineStoreUrl: string | null;
  seo: GqlSeo | null;
  variantsCount: { count: number | null } | null;
  options: GqlProductOption[] | null;
  /** A plain Int on Product, NOT a `Count` object — selecting `{ count }` on it is a schema error. */
  sellingPlanGroupCount: number | null;
  variants: { nodes: GqlProductVariant[] } | null;
  media: { nodes: GqlMediaImage[] } | null;
  metafields: { nodes: GqlMetafield[] } | null;
}

/** Exposed so the provider can flag a product whose variant list was cut short. */
export const PRODUCT_VARIANT_SAMPLE_LIMIT = VARIANT_SAMPLE_LIMIT;

export interface GqlCollection {
  id: string | null;
  title: string | null;
  handle: string | null;
  descriptionHtml: string | null;
  productsCount: { count: number | null } | null;
  seo: GqlSeo | null;
}

export interface GqlPage {
  id: string | null;
  title: string | null;
  handle: string | null;
  body: string | null;
  isPublished: boolean | null;
  publishedAt: string | null;
  updatedAt: string | null;
  metafields: { nodes: GqlMetafield[] } | null;
}

export interface GqlArticle {
  id: string | null;
  title: string | null;
  handle: string | null;
  body: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  image: { url: string | null; altText: string | null; width: number | null; height: number | null } | null;
  blog: { id: string | null; handle: string | null } | null;
  metafields: { nodes: GqlMetafield[] } | null;
}

export interface GqlPolicy {
  id: string | null;
  type: string | null;
  title: string | null;
  body: string | null;
  url: string | null;
}

/** Only the `global` namespace is requested for Page/Article: it is where the online store keeps
 * SEO overrides, and narrowing the namespace keeps the query's calculated cost down. */
const SEO_METAFIELDS = `metafields(first: 5, namespace: "global") { nodes { namespace key type value } }`;

const PAGE_INFO = `pageInfo { hasNextPage endCursor }`;

export const SHOP_IDENTITY_QUERY = `
  query ScoreloShopIdentity {
    shop {
      id
      name
      contactEmail
      myshopifyDomain
      currencyCode
      ianaTimezone
      plan { displayName }
      billingAddress { country }
      primaryDomain { url host }
    }
  }
`;

/**
 * Catalogue size, used to report analysed-vs-available coverage.
 *
 * Shopify returns `precision` alongside each count: EXACT, or AT_LEAST when the true total
 * exceeds what it will count cheaply. That distinction is preserved rather than dropped — telling
 * a merchant "2,000 of 10,000" when the real figure is "at least 10,000" would be a fabricated
 * denominator.
 */
export const CATALOG_TOTALS_QUERY = `
  query ScoreloCatalogTotals {
    productsCount { count precision }
    collectionsCount { count precision }
  }
`;

export const PRODUCTS_QUERY = `
  query ScoreloProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      ${PAGE_INFO}
      nodes {
        id
        title
        handle
        descriptionHtml
        productType
        vendor
        tags
        status
        publishedAt
        updatedAt
        onlineStoreUrl
        seo { title description }
        variantsCount { count }
        options { name values }
        sellingPlanGroupCount
        variants(first: ${VARIANT_SAMPLE_LIMIT}) {
          nodes { id sku barcode price availableForSale }
        }
        media(first: 20) {
          nodes {
            ... on MediaImage {
              id
              alt
              image { url width height }
            }
          }
        }
        metafields(first: 25) { nodes { namespace key type value } }
      }
    }
  }
`;

export const COLLECTIONS_QUERY = `
  query ScoreloCollections($first: Int!, $after: String) {
    collections(first: $first, after: $after) {
      ${PAGE_INFO}
      nodes {
        id
        title
        handle
        descriptionHtml
        productsCount { count }
        seo { title description }
      }
    }
  }
`;

export const PAGES_QUERY = `
  query ScoreloPages($first: Int!, $after: String) {
    pages(first: $first, after: $after) {
      ${PAGE_INFO}
      nodes {
        id
        title
        handle
        body
        isPublished
        publishedAt
        updatedAt
        ${SEO_METAFIELDS}
      }
    }
  }
`;

/**
 * The `articles` root query walks every blog's articles in one connection. The old REST provider
 * had to list blogs and then page each blog's articles separately, which meant a store with many
 * blogs paid one round trip per blog before it read a single article.
 */
export const ARTICLES_QUERY = `
  query ScoreloArticles($first: Int!, $after: String) {
    articles(first: $first, after: $after) {
      ${PAGE_INFO}
      nodes {
        id
        title
        handle
        body
        publishedAt
        updatedAt
        image { url altText width height }
        blog { id handle }
        ${SEO_METAFIELDS}
      }
    }
  }
`;

export const POLICIES_QUERY = `
  query ScoreloPolicies {
    shop {
      shopPolicies { id type title body url }
    }
  }
`;

export interface ShopIdentity {
  /** gid://shopify/Shop/123456 — stable across a myshopify domain rename. */
  gid: string;
  name: string;
  contactEmail: string | null;
  myshopifyDomain: string | null;
  currencyCode: string | null;
  ianaTimezone: string | null;
  country: string | null;
  planName: string | null;
  /** The merchant's real storefront origin — a custom domain when they have one. */
  primaryUrl: string | null;
}

interface ShopIdentityResponse {
  shop: {
    id: string | null;
    name: string | null;
    contactEmail: string | null;
    myshopifyDomain: string | null;
    currencyCode: string | null;
    ianaTimezone: string | null;
    plan: { displayName: string | null } | null;
    billingAddress: { country: string | null } | null;
    primaryDomain: { url: string | null; host: string | null } | null;
  } | null;
}

/**
 * Reads the shop's own identity. Used at two moments:
 *   1. right after the OAuth code exchange, to prove the token works before anything is recorded
 *      as "Connected" and to take the store's real name from Shopify instead of the domain;
 *   2. at the start of every snapshot, where store identity is the one non-optional resource.
 */
export async function fetchShopIdentity(client: ShopifyClient): Promise<ShopIdentity> {
  const data = await client.graphql<ShopIdentityResponse>(SHOP_IDENTITY_QUERY);
  const shop = data.shop;
  if (!shop || !shop.id) {
    throw new StoreDataError('MALFORMED_RESPONSE', 'Shopify did not return a shop record', false);
  }

  return {
    gid: shop.id,
    name: shop.name?.trim() || shop.myshopifyDomain || 'Shopify store',
    contactEmail: shop.contactEmail ?? null,
    myshopifyDomain: shop.myshopifyDomain ?? null,
    currencyCode: shop.currencyCode ?? null,
    ianaTimezone: shop.ianaTimezone ?? null,
    country: shop.billingAddress?.country ?? null,
    planName: shop.plan?.displayName ?? null,
    primaryUrl: shop.primaryDomain?.url ?? null,
  };
}

export type ProductsResponse = { products: Connection<GqlProduct> | null };
export type CollectionsResponse = { collections: Connection<GqlCollection> | null };
export type PagesResponse = { pages: Connection<GqlPage> | null };
export type ArticlesResponse = { articles: Connection<GqlArticle> | null };
export type PoliciesResponse = { shop: { shopPolicies: GqlPolicy[] | null } | null };

export interface CatalogTotals {
  products: { count: number; exact: boolean } | null;
  collections: { count: number; exact: boolean } | null;
}

interface CountNode { count?: number | null; precision?: string | null }
interface CatalogTotalsResponse { productsCount?: CountNode | null; collectionsCount?: CountNode | null }

function toTotal(node: CountNode | null | undefined): { count: number; exact: boolean } | null {
  if (!node || typeof node.count !== 'number') return null;
  return { count: node.count, exact: node.precision !== 'AT_LEAST' };
}

/** Reads catalogue totals. Never throws — coverage reporting must not be able to fail an audit. */
export async function fetchCatalogTotals(client: ShopifyClient): Promise<CatalogTotals> {
  try {
    const data = await client.graphql<CatalogTotalsResponse>(CATALOG_TOTALS_QUERY);
    return { products: toTotal(data.productsCount), collections: toTotal(data.collectionsCount) };
  } catch {
    return { products: null, collections: null };
  }
}

// ─── Theme (Speed pillar) ────────────────────────────────────────────

const THEME_MAIN_QUERY = `
  query ScoreloMainTheme {
    themes(first: 1, roles: [MAIN]) {
      nodes { id name role themeStoreId updatedAt }
    }
  }
`;

const THEME_FILES_QUERY = `
  query ScoreloThemeFiles($id: ID!, $after: String) {
    theme(id: $id) {
      files(first: 250, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { filename size contentType }
      }
    }
  }
`;

const THEME_NAMED_FILES_QUERY = `
  query ScoreloThemeNamedFiles($id: ID!, $names: [String!]!) {
    theme(id: $id) {
      files(filenames: $names, first: 5) {
        nodes { filename body { ... on OnlineStoreThemeFileBodyText { content } } }
      }
    }
  }
`;

interface ThemeFileNode { filename?: string | null; size?: number | string | null; contentType?: string | null }
interface ThemeNode { id: string; name?: string | null; themeStoreId?: number | null; updatedAt?: string | null }

export interface FetchedTheme {
  name: string;
  themeStoreId: number | null;
  updatedAt: string | null;
  assets: Array<{ filename: string; size: number; contentType: string | null }>;
  assetsTruncated: boolean;
  appEmbeds: Array<{ type: string; disabled: boolean }> | null;
  externalScripts: string[] | null;
}

/** Hard ceiling on file pages so a pathological theme cannot spin this forever. 8 pages ×
 * 250 files covers every real theme by a wide margin (Dawn ships ~350 files). */
const THEME_FILE_PAGE_LIMIT = 8;

/**
 * Reads the MAIN theme: file inventory (names + byte sizes only), the app embed blocks from
 * config/settings_data.json, and any hardcoded external <script src> in layout/theme.liquid.
 *
 * Bodies are fetched for exactly two named files; everything else is metadata, so this stays a
 * handful of cheap requests even for large themes.
 */
export async function fetchTheme(client: ShopifyClient): Promise<FetchedTheme | null> {
  const main = await client.graphql<{ themes?: { nodes?: ThemeNode[] } }>(THEME_MAIN_QUERY);
  const theme = main.themes?.nodes?.[0];
  if (!theme?.id) return null;

  const assets: FetchedTheme['assets'] = [];
  let after: string | null = null;
  let assetsTruncated = false;
  for (let page = 0; page < THEME_FILE_PAGE_LIMIT; page += 1) {
    const data: { theme?: { files?: { pageInfo?: { hasNextPage?: boolean; endCursor?: string | null }; nodes?: ThemeFileNode[] } } } =
      await client.graphql(THEME_FILES_QUERY, { id: theme.id, after });
    const files = data.theme?.files;
    for (const node of files?.nodes ?? []) {
      // `size` is an UnsignedInt64 scalar, which GraphQL serializes as a STRING ("63360"), not a
      // number. A typeof-number guard here silently discarded every file — coerce instead.
      const size = Number(node.size);
      if (!node.filename || !Number.isFinite(size)) continue;
      // Only assets/ carries the payload the Speed checks score; layout/sections/config are
      // server-side Liquid and never ship to the browser as-is.
      if (node.filename.startsWith('assets/')) {
        assets.push({ filename: node.filename, size, contentType: node.contentType ?? null });
      }
    }
    if (!files?.pageInfo?.hasNextPage) break;
    after = files.pageInfo.endCursor ?? null;
    if (page === THEME_FILE_PAGE_LIMIT - 1) assetsTruncated = true;
  }

  let appEmbeds: FetchedTheme['appEmbeds'] = null;
  let externalScripts: FetchedTheme['externalScripts'] = null;
  try {
    const named: { theme?: { files?: { nodes?: Array<{ filename?: string | null; body?: { content?: string | null } | null }> } } } =
      await client.graphql(THEME_NAMED_FILES_QUERY, { id: theme.id, names: ['config/settings_data.json', 'layout/theme.liquid'] });
    for (const node of named.theme?.files?.nodes ?? []) {
      const content = node.body?.content;
      if (!content) continue;
      if (node.filename === 'config/settings_data.json') {
        // Shopify writes this file with a leading /* ... */ banner — strip it before parsing.
        const parsed = JSON.parse(content.replace(/^\s*\/\*[\s\S]*?\*\//, '')) as { current?: unknown };
        const current = parsed.current;
        const blocks = current && typeof current === 'object' ? (current as { blocks?: Record<string, { type?: string; disabled?: boolean }> }).blocks ?? {} : {};
        appEmbeds = Object.values(blocks)
          .filter((block) => typeof block?.type === 'string')
          .map((block) => ({ type: block.type as string, disabled: Boolean(block.disabled) }));
      }
      if (node.filename === 'layout/theme.liquid') {
        // Only absolute URLs count: Liquid-served theme assets are already measured by size
        // above, while an absolute src is a third-party script loading on every page.
        const matches = content.match(/<script[^>]*\bsrc=["'](https?:\/\/[^"']+)["']/gi) ?? [];
        externalScripts = matches
          .map((tag) => tag.match(/src=["'](https?:\/\/[^"']+)["']/i)?.[1])
          .filter((src): src is string => Boolean(src));
      }
    }
  } catch {
    // Parsed extras are best-effort: null means "unknown", and the app-bloat check reports
    // exactly that rather than treating unknown as zero apps.
  }

  return {
    name: theme.name?.trim() || 'Main theme',
    themeStoreId: theme.themeStoreId ?? null,
    updatedAt: theme.updatedAt ?? null,
    assets,
    assetsTruncated,
    appEmbeds,
    externalScripts,
  };
}

// ─── URL redirects (handles-redirects) ───────────────────────────────

const URL_REDIRECTS_QUERY = `
  query ScoreloUrlRedirects($after: String) {
    urlRedirects(first: 250, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes { path target }
    }
  }
`;

export type FetchedRedirects =
  | { available: true; items: Array<{ path: string; target: string }>; truncated: boolean }
  | { available: false; reason: 'scope' | 'error'; detail: string };

const REDIRECT_PAGE_LIMIT = 8;

/**
 * Attempts to read the shop's URL redirects. `read_online_store_navigation` is NOT currently
 * granted, so on today's tokens this returns `{available:false, reason:'scope'}` — the
 * handles-redirects check turns that into an honest unavailable state naming the exact scope,
 * and the moment the scope is granted and the merchant re-authenticates, the same code path
 * starts returning real data with no further changes.
 */
export async function fetchUrlRedirects(client: ShopifyClient): Promise<FetchedRedirects> {
  const items: Array<{ path: string; target: string }> = [];
  let after: string | null = null;
  try {
    for (let page = 0; page < REDIRECT_PAGE_LIMIT; page += 1) {
      const data: { urlRedirects?: { pageInfo?: { hasNextPage?: boolean; endCursor?: string | null }; nodes?: Array<{ path?: string | null; target?: string | null }> } } =
        await client.graphql(URL_REDIRECTS_QUERY, { after });
      for (const node of data.urlRedirects?.nodes ?? []) {
        if (node.path && node.target) items.push({ path: node.path, target: node.target });
      }
      if (!data.urlRedirects?.pageInfo?.hasNextPage) return { available: true, items, truncated: false };
      after = data.urlRedirects.pageInfo.endCursor ?? null;
    }
    return { available: true, items, truncated: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    const isScope = /access denied/i.test(message);
    return { available: false, reason: isScope ? 'scope' : 'error', detail: message };
  }
}
