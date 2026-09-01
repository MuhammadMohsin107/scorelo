import type { ShopifyClient } from './shopify-client.js';
import {
  ARTICLES_QUERY,
  COLLECTIONS_QUERY,
  PAGES_QUERY,
  POLICIES_QUERY,
  PRODUCTS_QUERY,
  fetchCatalogTotals, fetchShopIdentity,
  type ArticlesResponse,
  type CollectionsResponse,
  type GqlArticle,
  type GqlCollection,
  type GqlMediaImage,
  type GqlMetafield,
  type GqlPage,
  type GqlProduct,
  type GqlProductOption,
  type GqlProductVariant,
  type PagesResponse,
  type PoliciesResponse,
  type ProductsResponse,
  fetchTheme,
  fetchUrlRedirects,
} from './shopify.queries.js';
import { probeStorefront } from './storefront-probe.js';
import { StorefrontCrawler } from '../storefront/crawler.js';
import { buildCrawlTargets } from '../storefront/targets.js';
import { crawlConfigured, env } from '../../config/env.js';
import {
  StoreDataError,
  type SnapshotArticle,
  type SnapshotCollection,
  type SnapshotImage,
  type SnapshotPage,
  type SnapshotPolicy,
  type SnapshotPolicyAccess,
  type SnapshotProduct,
  type SnapshotProductOption,
  type SnapshotVariant,
  type StoreDataProvider,
  type StoreSnapshot,
} from './types.js';
import type { StorefrontCrawl } from '../storefront/types.js';

const COLLECTION_LIMIT = 250;
const PAGE_LIMIT = 250;
const ARTICLE_LIMIT = 250;

/** Every field below is treated as untrusted: Shopify shape changes, nulls and oversized
 * values must never crash the worker (master prompt: SHOPIFY DATA SAFETY). */
function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function nullableStr(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function num(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

/** GraphQL ids are gids (gid://shopify/Product/123). The numeric suffix is what merchants see in
 * admin URLs, so it is what evidence rows should reference. */
function id(gid: unknown): string {
  const raw = typeof gid === 'string' ? gid : '';
  if (!raw) return '';
  const tail = raw.split('/').pop();
  return tail && /^\d+$/.test(tail) ? tail : raw;
}

/** A `media` connection contains every media type; non-image nodes come back as empty objects
 * because the query only spreads MediaImage. Those are dropped, not emitted as broken rows. */
function normalizeMedia(raw: GqlMediaImage | null | undefined): SnapshotImage | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = str(raw.image?.url);
  if (!src) return null;
  return {
    id: id(raw.id),
    src,
    // Preserved exactly: null alt means "no attribute", '' means "present but empty".
    alt: typeof raw.alt === 'string' ? raw.alt : null,
    width: num(raw.image?.width),
    height: num(raw.image?.height),
  };
}

/** Option placeholders are preserved verbatim — `Title`/`Default Title` is the signal that a
 * product has no real options, and collapsing it here would hide it from the CRO check. */
function normalizeOptions(raw: GqlProductOption[] | null | undefined): SnapshotProductOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((option) => ({
    name: str(option?.name),
    values: Array.isArray(option?.values) ? option.values.filter((value): value is string => typeof value === 'string') : [],
  }));
}

function normalizeVariants(nodes: GqlProductVariant[] | null | undefined): SnapshotVariant[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((variant) => ({
    id: id(variant?.id),
    // '' is Shopify's way of saying "no SKU set"; both it and null mean absent to every check.
    sku: nullableStr(variant?.sku),
    barcode: nullableStr(variant?.barcode),
    // price arrives as a decimal string ("92.50"). num() handles that; a real 0 survives as 0.
    price: num(variant?.price),
    availableForSale: variant?.availableForSale === true,
  }));
}

function normalizeMetafields(nodes: GqlMetafield[] | null | undefined) {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((metafield) => ({
    namespace: str(metafield?.namespace),
    key: str(metafield?.key),
    type: str(metafield?.type),
    hasValue: metafield?.value !== null && metafield?.value !== undefined && String(metafield.value).trim().length > 0,
  }));
}

/**
 * Pages and Articles have no `seo` field — the online store stores their SEO overrides as
 * `global.title_tag` / `global.description_tag` metafields. Products and Collections expose
 * `seo` natively and do not go through here.
 */
function seoFromMetafields(nodes: GqlMetafield[] | null | undefined): { title: string | null; description: string | null } {
  const result = { title: null as string | null, description: null as string | null };
  if (!Array.isArray(nodes)) return result;
  for (const metafield of nodes) {
    if (str(metafield?.namespace) !== 'global') continue;
    if (str(metafield?.key) === 'title_tag') result.title = nullableStr(metafield?.value);
    if (str(metafield?.key) === 'description_tag') result.description = nullableStr(metafield?.value);
  }
  return result;
}

export class ShopifyStoreDataProvider implements StoreDataProvider {
  readonly kind = 'shopify';

  /**
   * Memory-safety ceiling for the full-catalogue fetch. 25k products x ~2KB normalized is
   * ~50MB in the worst case — acceptable for a single audit job. Catalogues beyond it are
   * fetched to the ceiling and reported TRUNCATED, never silently sampled.
   */
  static readonly PRODUCT_SAFETY_CEILING = 25_000;

  constructor(
    private readonly client: ShopifyClient,
    private readonly storeId: number,
    private readonly shopDomain: string,
    private readonly productLimit: number,
  ) {}

  async buildSnapshot(): Promise<StoreSnapshot> {
    const warnings: string[] = [];

    // Shop identity is the one genuinely required resource — without it we cannot even establish
    // which store this is, so a failure here is fatal rather than degraded.
    const identity = await fetchShopIdentity(this.client);

    // The merchant's real storefront origin. A store on a custom domain serves its pages from
    // that domain, so deriving URLs from the myshopify domain would point every evidence row and
    // every storefront check at the wrong host.
    const primaryUrl = (identity.primaryUrl ?? `https://${this.shopDomain}`).replace(/\/$/, '');

    // Catalogue totals are fetched FIRST so the product fetch can size itself to the real
    // catalogue instead of a fixed cap. Non-fatal by construction.
    const totals = await fetchCatalogTotals(this.client);

    // ── Effective product limit (removes the silent 2,000 cap) ──
    // `stores.page_limit` described a crawl budget, but it was being applied to the Admin
    // catalogue fetch, silently scoring 10,000-product stores on a 2,000-product sample. Admin
    // catalogue analysis now sizes itself to the store's ACTUAL product count, bounded only by a
    // memory-safety ceiling; anything beyond the ceiling is still reported as truncated, never
    // hidden. When the count is unreadable, the configured limit remains the fallback.
    const exactCount = totals.products?.exact ? totals.products.count : null;
    const effectiveProductLimit = exactCount !== null
      ? Math.min(Math.max(exactCount, this.productLimit), ShopifyStoreDataProvider.PRODUCT_SAFETY_CEILING)
      : totals.products
        ? Math.min(Math.max(totals.products.count, this.productLimit), ShopifyStoreDataProvider.PRODUCT_SAFETY_CEILING)
        : this.productLimit;

    const products = await this.safe('products', warnings, () => this.fetchProducts(primaryUrl, effectiveProductLimit));
    const collections = await this.safe('collections', warnings, () => this.fetchCollections(primaryUrl));
    const pages = await this.safe('pages', warnings, () => this.fetchPages(primaryUrl));
    const articles = await this.safe('articles', warnings, () => this.fetchArticles(primaryUrl));
    // Policies report their own availability (a denied scope is an expected state, not an error),
    // so they bypass safe() for the same reason redirects do — see fetchPolicies().
    const policies = await this.fetchPolicies();
    if (!policies.access.available) warnings.push(`policies: ${policies.access.detail}`);
    const theme = await this.safe('theme', warnings, () => fetchTheme(this.client));
    const storefront = await this.safe('storefront', warnings, () => probeStorefront(primaryUrl));
    // Redirects report their own availability (scope-denied is an expected state, not an error),
    // so they bypass safe(): a denial must reach the check as a REASON, not vanish as a warning.
    const redirects = await fetchUrlRedirects(this.client);

    const productList = products?.items ?? [];

    // ── Storefront crawl ──
    // Runs AFTER the Admin fetch because its targets are the merchant's own real resources, and
    // it is the last thing to run because nothing else depends on it: a crawl failure degrades
    // the crawl-based checks to `unavailable` and leaves every Admin check exactly as it was.
    const crawl = await this.safe('crawl', warnings, () => this.runCrawl({
      primaryUrl,
      products: productList,
      collections: collections?.items ?? [],
      pages: pages?.items ?? [],
      articles: articles?.items ?? [],
    }));
    if (crawl?.warnings.length) warnings.push(...crawl.warnings.map((warning) => `crawl: ${warning}`));

    return {
      storeId: this.storeId,
      capturedAt: new Date(),
      shop: {
        domain: this.shopDomain,
        primaryUrl,
        name: identity.name,
        email: identity.contactEmail,
        currency: identity.currencyCode,
        country: identity.country,
        timezone: identity.ianaTimezone,
        planName: identity.planName,
      },
      products: productList,
      collections: collections?.items ?? [],
      pages: pages?.items ?? [],
      articles: articles?.items ?? [],
      policies: policies.items,
      policyAccess: policies.access,
      theme: theme ?? null,
      storefront: storefront ?? null,
      redirects,
      crawl: crawl ?? null,
      coverage: {
        shop: true,
        products: products !== null,
        collections: collections !== null,
        pages: pages !== null,
        articles: articles !== null,
        policies: policies.access.available,
        // GraphQL returns metafields inline with each product, so coverage is no longer a
        // property of a sample — either the products query succeeded and every product carries
        // real metafield data, or it did not.
        metafields: products !== null && productList.some((product) => product.metafieldsAvailable),
        theme: theme !== null && theme !== undefined,
        storefront: storefront !== null && storefront !== undefined,
        // Rendered-page evidence exists only when a page was actually fetched AND parsed. A
        // password-gated or unreachable storefront is false here, which is what makes every
        // crawl-based check report "not measured" instead of scoring Shopify's password page.
        crawl: crawl?.available === true,
      },
      scope: {
        productLimit: effectiveProductLimit,
        productsAvailable: totals.products,
        collectionsAvailable: totals.collections,
        productsTruncated: products?.truncated ?? false,
        collectionsTruncated: collections?.truncated ?? false,
        pagesTruncated: pages?.truncated ?? false,
        articlesTruncated: articles?.truncated ?? false,
      },
      warnings,
    };
  }

  /**
   * Runs one resource fetch, converting a failure into `null` + a warning instead of
   * aborting the snapshot. A permanently-fatal auth error still propagates, because
   * continuing without credentials would only produce meaningless "unavailable" results.
   */
  private async safe<T>(resource: string, warnings: string[], task: () => Promise<T>): Promise<T | null> {
    try {
      return await task();
    } catch (error) {
      if (error instanceof StoreDataError && (error.code === 'TOKEN_REVOKED' || error.code === 'RATE_LIMITED')) {
        throw error;
      }
      warnings.push(`${resource}: ${error instanceof Error ? error.message : 'unknown error'}`);
      return null;
    }
  }

  /**
   * Crawls the merchant's own storefront for rendered-page evidence.
   *
   * Targets are derived from the Admin resources just fetched, so the crawl only ever visits
   * pages this store actually publishes. Returns null when crawling is switched off, which the
   * coverage flag turns into an honest "not measured" for every crawl-based check.
   */
  private async runCrawl(resources: {
    primaryUrl: string;
    products: SnapshotProduct[];
    collections: SnapshotCollection[];
    pages: SnapshotPage[];
    articles: SnapshotArticle[];
  }): Promise<StorefrontCrawl | null> {
    if (!crawlConfigured()) return null;

    const targets = buildCrawlTargets(
      {
        shop: { primaryUrl: resources.primaryUrl },
        products: resources.products,
        collections: resources.collections,
        pages: resources.pages,
        articles: resources.articles,
      } as StoreSnapshot,
      env.crawlMaxPages,
    );

    return new StorefrontCrawler(resources.primaryUrl).crawl(targets);
  }

  private async fetchProducts(primaryUrl: string, limit: number): Promise<{ items: SnapshotProduct[]; truncated: boolean }> {
    const { items: raw, truncated } = await this.client.paginate<GqlProduct, ProductsResponse>(
      PRODUCTS_QUERY,
      (data) => data.products,
      limit,
    );

    const items = raw.map((product): SnapshotProduct => {
      const handle = str(product.handle);
      const media = Array.isArray(product.media?.nodes) ? product.media.nodes : [];
      // `metafields` is a non-null connection in the schema, so its presence means we genuinely
      // read them. A missing connection means we could not look — "unknown", never "none".
      const metafieldsAvailable = Array.isArray(product.metafields?.nodes);
      const variants = normalizeVariants(product.variants?.nodes);
      const variantCount = num(product.variantsCount?.count) ?? variants.length;

      return {
        id: id(product.id),
        title: str(product.title),
        handle,
        // onlineStoreUrl is null for an unpublished product; the handle-derived URL is still the
        // address it would have, which is what a fix recommendation needs to name.
        url: nullableStr(product.onlineStoreUrl) ?? (handle ? `${primaryUrl}/products/${handle}` : primaryUrl),
        bodyHtml: str(product.descriptionHtml),
        productType: str(product.productType),
        vendor: str(product.vendor),
        tags: Array.isArray(product.tags) ? product.tags.filter((tag): tag is string => typeof tag === 'string') : [],
        status: str(product.status, 'ACTIVE').toLowerCase(),
        publishedAt: nullableStr(product.publishedAt),
        updatedAt: nullableStr(product.updatedAt),
        images: media.map(normalizeMedia).filter((image): image is SnapshotImage => image !== null),
        variantCount,
        options: normalizeOptions(product.options),
        variants,
        // Compared against the REPORTED total, not the sample length: a product with exactly
        // the sample limit is fully read, one with more is not.
        variantsTruncated: variantCount > variants.length,
        sellingPlanGroupCount: num(product.sellingPlanGroupCount) ?? 0,
        metafields: normalizeMetafields(product.metafields?.nodes),
        metafieldsAvailable,
        seoTitle: nullableStr(product.seo?.title),
        seoDescription: nullableStr(product.seo?.description),
      };
    });

    return { items, truncated };
  }

  private async fetchCollections(primaryUrl: string): Promise<{ items: SnapshotCollection[]; truncated: boolean }> {
    // One connection covers both manual and automated collections; the REST API split these
    // across custom_collections and smart_collections and needed two paginated walks.
    const { items: raw, truncated } = await this.client.paginate<GqlCollection, CollectionsResponse>(
      COLLECTIONS_QUERY,
      (data) => data.collections,
      COLLECTION_LIMIT,
    );

    const items = raw.map((collection): SnapshotCollection => {
      const handle = str(collection.handle);
      return {
        id: id(collection.id),
        title: str(collection.title),
        handle,
        url: handle ? `${primaryUrl}/collections/${handle}` : primaryUrl,
        bodyHtml: str(collection.descriptionHtml),
        productCount: num(collection.productsCount?.count),
        seoTitle: nullableStr(collection.seo?.title),
        seoDescription: nullableStr(collection.seo?.description),
      };
    });

    return { items, truncated };
  }

  private async fetchPages(primaryUrl: string): Promise<{ items: SnapshotPage[]; truncated: boolean }> {
    const { items: raw, truncated } = await this.client.paginate<GqlPage, PagesResponse>(
      PAGES_QUERY,
      (data) => data.pages,
      PAGE_LIMIT,
    );

    const items = raw.map((page): SnapshotPage => {
      const handle = str(page.handle);
      const seo = seoFromMetafields(page.metafields?.nodes);
      return {
        id: id(page.id),
        title: str(page.title),
        handle,
        url: handle ? `${primaryUrl}/pages/${handle}` : primaryUrl,
        bodyHtml: str(page.body),
        publishedAt: nullableStr(page.publishedAt),
        updatedAt: nullableStr(page.updatedAt),
        seoTitle: seo.title,
        seoDescription: seo.description,
      };
    });

    return { items, truncated };
  }

  private async fetchArticles(primaryUrl: string): Promise<{ items: SnapshotArticle[]; truncated: boolean }> {
    const { items: raw, truncated } = await this.client.paginate<GqlArticle, ArticlesResponse>(
      ARTICLES_QUERY,
      (data) => data.articles,
      ARTICLE_LIMIT,
    );

    const items = raw.map((article): SnapshotArticle => {
      const handle = str(article.handle);
      const blogHandle = str(article.blog?.handle, 'news');
      const seo = seoFromMetafields(article.metafields?.nodes);
      const image = article.image?.url
        ? {
            id: '',
            src: str(article.image.url),
            alt: typeof article.image.altText === 'string' ? article.image.altText : null,
            width: num(article.image.width),
            height: num(article.image.height),
          }
        : null;

      return {
        id: id(article.id),
        blogId: id(article.blog?.id),
        blogHandle,
        title: str(article.title),
        handle,
        url: handle ? `${primaryUrl}/blogs/${blogHandle}/${handle}` : primaryUrl,
        bodyHtml: str(article.body),
        publishedAt: nullableStr(article.publishedAt),
        updatedAt: nullableStr(article.updatedAt),
        image,
        seoTitle: seo.title,
        seoDescription: seo.description,
      };
    });

    return { items, truncated };
  }

  /**
   * Reads the shop's policies, reporting a denied scope as a REASON rather than an error.
   *
   * Like redirects, this bypasses safe(): `shopPolicies` sits behind `read_legal_policies`, so a
   * store connected before that scope was requested denies the field. That is an expected state
   * with an obvious fix, and it must reach the returns check as something it can explain — not
   * vanish into a warning that leaves the merchant with "could not read your policies".
   */
  private async fetchPolicies(): Promise<{ items: SnapshotPolicy[]; access: SnapshotPolicyAccess }> {
    let data: PoliciesResponse;
    try {
      data = await this.client.graphql<PoliciesResponse>(POLICIES_QUERY);
    } catch (error) {
      if (error instanceof StoreDataError && (error.code === 'TOKEN_REVOKED' || error.code === 'RATE_LIMITED')) {
        throw error;
      }
      const detail = error instanceof Error ? error.message : 'unknown error';
      return { items: [], access: { available: false, reason: /access denied/i.test(detail) ? 'scope' : 'error', detail } };
    }

    const raw = Array.isArray(data.shop?.shopPolicies) ? data.shop.shopPolicies : [];
    const items = raw.map((policy) => ({
      // ShopPolicyType is an enum (REFUND_POLICY, PRIVACY_POLICY, …); lower-cased it matches the
      // handle the REST API used, so downstream checks keying on 'refund_policy' still work.
      type: str(policy?.type).toLowerCase(),
      title: str(policy?.title),
      body: str(policy?.body),
      url: nullableStr(policy?.url),
    }));

    return { items, access: { available: true } };
  }
}
