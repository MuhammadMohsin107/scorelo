// ─── Normalized store snapshot ───────────────────────────────────────
// The single shape every audit check consumes. Checks must NEVER see a raw
// Shopify (or any other platform's) response — that is the whole point of this
// layer: adding a second platform later means adding one provider, not touching
// 33 checks. See store-data/index.ts for provider resolution.
//
// Fetch once -> normalize once -> reuse across all checks (master prompt: PERFORMANCE).

export interface SnapshotImage {
  id: string;
  src: string;
  /** null = attribute genuinely absent; '' = present but empty. The distinction matters
   * to the image-alt-text check, so it is preserved rather than collapsed. */
  alt: string | null;
  width: number | null;
  height: number | null;
}

export interface SnapshotProduct {
  id: string;
  title: string;
  handle: string;
  /** Storefront URL derived from the shop domain + handle. */
  url: string;
  bodyHtml: string;
  productType: string;
  vendor: string;
  tags: string[];
  status: string;
  publishedAt: string | null;
  updatedAt: string | null;
  images: SnapshotImage[];
  variantCount: number;
  /** Present only when the provider was granted the scope to read them; an empty array
   * with `metafieldsAvailable: false` means "unknown", not "none". */
  metafields: Array<{ namespace: string; key: string; type: string; hasValue: boolean }>;
  metafieldsAvailable: boolean;
  /** SEO overrides the merchant set in Shopify admin (global_title / global_description).
   * null means no override — the theme falls back to the product title/description. */
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface SnapshotCollection {
  id: string;
  title: string;
  handle: string;
  url: string;
  bodyHtml: string;
  productCount: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface SnapshotPage {
  id: string;
  title: string;
  handle: string;
  url: string;
  bodyHtml: string;
  publishedAt: string | null;
  updatedAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface SnapshotArticle {
  id: string;
  blogId: string;
  blogHandle: string;
  title: string;
  handle: string;
  url: string;
  bodyHtml: string;
  publishedAt: string | null;
  updatedAt: string | null;
  image: SnapshotImage | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface SnapshotPolicy {
  type: string;
  title: string;
  body: string;
  url: string | null;
}

export interface SnapshotShop {
  domain: string;
  /** The canonical public storefront origin, e.g. https://acme.myshopify.com */
  primaryUrl: string;
  name: string;
  email: string | null;
  currency: string | null;
  country: string | null;
  timezone: string | null;
  planName: string | null;
}

/** Which resource groups this snapshot actually contains. A check MUST consult this before
 * scoring: `false` means "we could not look", which is reported as `unavailable`, never as a
 * pass and never as a zero. This is what keeps "unknown" distinguishable from "healthy". */
export interface SnapshotCoverage {
  shop: boolean;
  products: boolean;
  collections: boolean;
  pages: boolean;
  articles: boolean;
  policies: boolean;
  metafields: boolean;
}

/** Scope limits genuinely applied while building the snapshot, surfaced in audit metadata
 * so a partially-scanned large store is never presented as a full scan. */
export interface SnapshotScope {
  productLimit: number;
  productsTruncated: boolean;
  collectionsTruncated: boolean;
  pagesTruncated: boolean;
  articlesTruncated: boolean;
}

export interface StoreSnapshot {
  storeId: number;
  capturedAt: Date;
  shop: SnapshotShop;
  products: SnapshotProduct[];
  collections: SnapshotCollection[];
  pages: SnapshotPage[];
  articles: SnapshotArticle[];
  policies: SnapshotPolicy[];
  coverage: SnapshotCoverage;
  scope: SnapshotScope;
  /** Non-fatal problems hit while building the snapshot (e.g. a scope-denied resource).
   * Recorded rather than thrown so one missing resource cannot kill an entire audit. */
  warnings: string[];
}

export interface StoreDataProvider {
  readonly kind: string;
  /** Builds the full normalized snapshot. May throw StoreDataError for fatal conditions
   * (revoked token, unreachable API); per-resource failures should degrade to coverage
   * flags + warnings instead. */
  buildSnapshot(): Promise<StoreSnapshot>;
}

export type StoreDataErrorCode =
  | 'NOT_CONNECTED'
  | 'TOKEN_REVOKED'
  | 'MISSING_SCOPES'
  | 'RATE_LIMITED'
  | 'API_UNAVAILABLE'
  | 'MALFORMED_RESPONSE';

export class StoreDataError extends Error {
  constructor(
    readonly code: StoreDataErrorCode,
    message: string,
    /** Transient errors are worth retrying; permanent ones (revoked token) are not. */
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'StoreDataError';
  }
}
