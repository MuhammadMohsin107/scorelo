import { ShopifyClient } from './shopify-client.js';
import {
  StoreDataError,
  type SnapshotArticle,
  type SnapshotCollection,
  type SnapshotImage,
  type SnapshotPage,
  type SnapshotPolicy,
  type SnapshotProduct,
  type StoreDataProvider,
  type StoreSnapshot,
} from './types.js';

/** Per-product metafield reads are 1 request each, so they are sampled rather than exhaustive.
 * Products outside the sample carry metafieldsAvailable:false — "unknown", never "missing". */
const METAFIELD_SAMPLE_LIMIT = 50;
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

function id(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function normalizeImage(raw: unknown): SnapshotImage | null {
  if (!raw || typeof raw !== 'object') return null;
  const image = raw as Record<string, unknown>;
  const src = str(image.src);
  if (!src) return null;
  return {
    id: id(image.id),
    src,
    // Preserved exactly: undefined/null alt means "no attribute", '' means "present but empty".
    alt: typeof image.alt === 'string' ? image.alt : null,
    width: num(image.width),
    height: num(image.height),
  };
}

export class ShopifyStoreDataProvider implements StoreDataProvider {
  readonly kind = 'shopify';

  constructor(
    private readonly client: ShopifyClient,
    private readonly storeId: number,
    private readonly shopDomain: string,
    private readonly productLimit: number,
  ) {}

  async buildSnapshot(): Promise<StoreSnapshot> {
    const warnings: string[] = [];
    const primaryUrl = `https://${this.shopDomain}`;

    // The shop record is the one genuinely required resource — without it we cannot even
    // establish store identity, so a failure here is fatal rather than degraded.
    const shopResponse = await this.client.get<{ shop?: Record<string, unknown> }>('shop.json');
    const rawShop = shopResponse?.shop;
    if (!rawShop) {
      throw new StoreDataError('MALFORMED_RESPONSE', 'Shopify did not return a shop record', false);
    }

    const products = await this.safe('products', warnings, () => this.fetchProducts(primaryUrl));
    const collections = await this.safe('collections', warnings, () => this.fetchCollections(primaryUrl));
    const pages = await this.safe('pages', warnings, () => this.fetchPages(primaryUrl));
    const articles = await this.safe('articles', warnings, () => this.fetchArticles(primaryUrl));
    const policies = await this.safe('policies', warnings, () => this.fetchPolicies());

    const productList = products?.items ?? [];
    const metafieldsCovered = productList.some((product) => product.metafieldsAvailable);

    return {
      storeId: this.storeId,
      capturedAt: new Date(),
      shop: {
        domain: this.shopDomain,
        primaryUrl,
        name: str(rawShop.name, this.shopDomain),
        email: nullableStr(rawShop.email),
        currency: nullableStr(rawShop.currency),
        country: nullableStr(rawShop.country_name),
        timezone: nullableStr(rawShop.iana_timezone),
        planName: nullableStr(rawShop.plan_name),
      },
      products: productList,
      collections: collections?.items ?? [],
      pages: pages?.items ?? [],
      articles: articles?.items ?? [],
      policies: policies ?? [],
      coverage: {
        shop: true,
        products: products !== null,
        collections: collections !== null,
        pages: pages !== null,
        articles: articles !== null,
        policies: policies !== null,
        metafields: metafieldsCovered,
      },
      scope: {
        productLimit: this.productLimit,
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

  private async fetchProducts(primaryUrl: string): Promise<{ items: SnapshotProduct[]; truncated: boolean }> {
    const { items: raw, truncated } = await this.client.getPaginated<Record<string, unknown>>('products.json', 'products', this.productLimit);

    const products: SnapshotProduct[] = raw.map((product) => {
      const handle = str(product.handle);
      const images = Array.isArray(product.images)
        ? product.images.map(normalizeImage).filter((image): image is SnapshotImage => image !== null)
        : [];
      return {
        id: id(product.id),
        title: str(product.title),
        handle,
        url: handle ? `${primaryUrl}/products/${handle}` : primaryUrl,
        bodyHtml: str(product.body_html),
        productType: str(product.product_type),
        vendor: str(product.vendor),
        tags: typeof product.tags === 'string' ? product.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
        status: str(product.status, 'active'),
        publishedAt: nullableStr(product.published_at),
        updatedAt: nullableStr(product.updated_at),
        images,
        variantCount: Array.isArray(product.variants) ? product.variants.length : 0,
        metafields: [],
        metafieldsAvailable: false,
        seoTitle: null,
        seoDescription: null,
      };
    });

    await this.hydrateMetafieldSample(products);
    return { items: products, truncated };
  }

  /** Bounded metafield sample — also the source of merchant SEO overrides, which live as
   * `global/title_tag` and `global/description_tag` metafields rather than product columns. */
  private async hydrateMetafieldSample(products: SnapshotProduct[]): Promise<void> {
    for (const product of products.slice(0, METAFIELD_SAMPLE_LIMIT)) {
      if (!product.id) continue;
      try {
        const response = await this.client.get<{ metafields?: unknown }>(`products/${product.id}/metafields.json`);
        // A null response means 404 — we could not READ the metafields. That is "unknown",
        // and must not be recorded as "read successfully, found none", or a completeness
        // check would report every field as missing on a store we never actually inspected.
        if (response === null || !Array.isArray(response.metafields)) {
          product.metafieldsAvailable = false;
          continue;
        }
        const raw = response.metafields as Record<string, unknown>[];
        product.metafields = raw.map((metafield) => ({
          namespace: str(metafield.namespace),
          key: str(metafield.key),
          type: str(metafield.type),
          hasValue: metafield.value !== null && metafield.value !== undefined && String(metafield.value).trim().length > 0,
        }));
        for (const metafield of raw) {
          if (str(metafield.namespace) !== 'global') continue;
          if (str(metafield.key) === 'title_tag') product.seoTitle = nullableStr(metafield.value);
          if (str(metafield.key) === 'description_tag') product.seoDescription = nullableStr(metafield.value);
        }
        product.metafieldsAvailable = true;
      } catch {
        // Leave metafieldsAvailable false — the checks will report "unknown", not "missing".
        product.metafieldsAvailable = false;
      }
    }
  }

  private async fetchCollections(primaryUrl: string): Promise<{ items: SnapshotCollection[]; truncated: boolean }> {
    const normalize = (raw: Record<string, unknown>): SnapshotCollection => {
      const handle = str(raw.handle);
      return {
        id: id(raw.id),
        title: str(raw.title),
        handle,
        url: handle ? `${primaryUrl}/collections/${handle}` : primaryUrl,
        bodyHtml: str(raw.body_html),
        productCount: num(raw.products_count),
        seoTitle: null,
        seoDescription: null,
      };
    };

    // Shopify splits collections across two endpoints; a store may legitimately use either.
    const custom = await this.client.getPaginated<Record<string, unknown>>('custom_collections.json', 'custom_collections', COLLECTION_LIMIT);
    const smart = await this.client.getPaginated<Record<string, unknown>>('smart_collections.json', 'smart_collections', COLLECTION_LIMIT);

    return {
      items: [...custom.items.map(normalize), ...smart.items.map(normalize)],
      truncated: custom.truncated || smart.truncated,
    };
  }

  private async fetchPages(primaryUrl: string): Promise<{ items: SnapshotPage[]; truncated: boolean }> {
    const { items: raw, truncated } = await this.client.getPaginated<Record<string, unknown>>('pages.json', 'pages', PAGE_LIMIT);
    return {
      items: raw.map((page) => {
        const handle = str(page.handle);
        return {
          id: id(page.id),
          title: str(page.title),
          handle,
          url: handle ? `${primaryUrl}/pages/${handle}` : primaryUrl,
          bodyHtml: str(page.body_html),
          publishedAt: nullableStr(page.published_at),
          updatedAt: nullableStr(page.updated_at),
          seoTitle: null,
          seoDescription: null,
        };
      }),
      truncated,
    };
  }

  private async fetchArticles(primaryUrl: string): Promise<{ items: SnapshotArticle[]; truncated: boolean }> {
    const blogs = await this.client.getPaginated<Record<string, unknown>>('blogs.json', 'blogs', 50);
    const articles: SnapshotArticle[] = [];
    let truncated = blogs.truncated;

    for (const blog of blogs.items) {
      const blogId = id(blog.id);
      const blogHandle = str(blog.handle, 'news');
      if (!blogId) continue;
      const result = await this.client.getPaginated<Record<string, unknown>>(`blogs/${blogId}/articles.json`, 'articles', ARTICLE_LIMIT);
      truncated = truncated || result.truncated;
      for (const article of result.items) {
        const handle = str(article.handle);
        articles.push({
          id: id(article.id),
          blogId,
          blogHandle,
          title: str(article.title),
          handle,
          url: handle ? `${primaryUrl}/blogs/${blogHandle}/${handle}` : primaryUrl,
          bodyHtml: str(article.body_html),
          publishedAt: nullableStr(article.published_at),
          updatedAt: nullableStr(article.updated_at),
          image: normalizeImage(article.image),
          seoTitle: null,
          seoDescription: null,
        });
      }
    }

    return { items: articles, truncated };
  }

  private async fetchPolicies(): Promise<SnapshotPolicy[]> {
    const response = await this.client.get<{ policies?: unknown }>('policies.json');
    const raw = Array.isArray(response?.policies) ? (response.policies as Record<string, unknown>[]) : [];
    return raw.map((policy) => ({
      type: str(policy.handle),
      title: str(policy.title),
      body: str(policy.body),
      url: nullableStr(policy.url),
    }));
  }
}
