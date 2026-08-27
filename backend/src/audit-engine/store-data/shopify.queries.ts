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
  media: { nodes: GqlMediaImage[] } | null;
  metafields: { nodes: GqlMetafield[] } | null;
}

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
