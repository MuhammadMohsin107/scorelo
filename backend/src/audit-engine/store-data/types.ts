import type { StorefrontCrawl } from '../storefront/types.js';

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

/**
 * A product option as the merchant configured it ("Size" -> S/M/L).
 *
 * Shopify gives every product at least one option: a single-variant product carries the
 * synthetic `Title` option with the single value `Default Title`. That placeholder is preserved
 * here exactly as returned — recognising it is how the CRO options check distinguishes "this
 * product genuinely has no variants" from "this product has variants the shopper cannot tell
 * apart", and normalizing it away in the provider would destroy that signal.
 */
export interface SnapshotProductOption {
  name: string;
  values: string[];
}

/** The purchase-decision fields of one variant. Deliberately narrow: no inventory levels (that
 * needs `read_inventory`, which is not granted) and nothing customer-identifying. */
export interface SnapshotVariant {
  id: string;
  /** Merchant's own stock identifier. null = genuinely absent, never '' . */
  sku: string | null;
  /** GTIN/EAN/UPC — the identifier shopping feeds and AI agents match on. */
  barcode: string | null;
  /** Parsed from Shopify's decimal string. null when unreadable, 0 is a real (and broken) price. */
  price: number | null;
  availableForSale: boolean;
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
  /** Option definitions, including Shopify's synthetic `Title`/`Default Title` placeholder. */
  options: SnapshotProductOption[];
  /** Variants actually read, capped per product — see VARIANT_SAMPLE_LIMIT in the provider. */
  variants: SnapshotVariant[];
  /** True when the product has MORE variants than were read. A check must then describe its
   * result as covering the sample, never the whole product. */
  variantsTruncated: boolean;
  /** How many selling-plan (subscription / try-before-you-buy) groups this product belongs to.
   * 0 across the whole catalogue means no subscription programme exists to audit. */
  sellingPlanGroupCount: number;
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

// ─── Theme (Speed pillar) ────────────────────────────────────────────
// Read through `read_themes`, which is already granted. Checks stay pure: all Shopify calls
// happen in the provider, and Speed checks consume only this normalized shape.

export interface SnapshotThemeAsset {
  /** Theme-relative path, e.g. "assets/base.css". */
  filename: string;
  /** Size in bytes as reported by the Admin API. */
  size: number;
  contentType: string | null;
}

/** An app embed block from config/settings_data.json — the app-bloat signal that IS visible
 * through the Admin API (ScriptTag records would need `read_script_tags`, which is not granted,
 * and storefront-injected scripts need a crawl). */
export interface SnapshotAppEmbed {
  /** e.g. "shopify://apps/<app>/blocks/<block>/<id>" — the app segment names the app. */
  type: string;
  disabled: boolean;
}

export interface SnapshotTheme {
  name: string;
  /** Shopify Theme Store id — identifies a stock theme like Dawn. Null for custom themes. */
  themeStoreId: number | null;
  updatedAt: string | null;
  /** Every file under assets/ with its byte size. Bodies are deliberately NOT fetched here. */
  assets: SnapshotThemeAsset[];
  assetsTruncated: boolean;
  /** App embed blocks parsed from config/settings_data.json. Null = the file could not be read
   * or parsed, which is "unknown", never "no apps". */
  appEmbeds: SnapshotAppEmbed[] | null;
  /** External (absolute-URL) <script src> tags hardcoded in layout/theme.liquid — third-party
   * scripts that load on every page. Null = layout could not be read. */
  externalScripts: string[] | null;
}

// ─── Storefront reachability (crawl-dependent checks) ────────────────
// A handful of cheap, read-only HTTP probes performed once per snapshot. Checks that need
// rendered HTML consult this instead of fetching themselves, and a password-protected
// storefront is DETECTED here rather than discovered as a mystery failure inside every check.

export interface StorefrontProbe {
  status: number;
  /** True when the response redirected to /password — Shopify's storefront gate. */
  passwordGated: boolean;
  /** Body text, only captured for robots.txt (small and needed by the sitemap check). */
  body?: string;
}

export interface SnapshotStorefront {
  homepage: StorefrontProbe;
  robots: StorefrontProbe;
  sitemap: StorefrontProbe;
  /** True when ANY probe hit the password gate — the storefront is not publicly reachable. */
  passwordProtected: boolean;
}

// ─── URL redirects (handles-redirects check) ─────────────────────────
export type SnapshotRedirects =
  | { available: true; items: Array<{ path: string; target: string }>; truncated: boolean }
  /** 'scope' = urlRedirects was DENIED (needs read_online_store_navigation); 'error' = other. */
  | { available: false; reason: 'scope' | 'error'; detail: string };

/**
 * Why the shop's policies are absent, when they are.
 *
 * Distinguished from a plain coverage flag for the same reason redirects are: `shopPolicies` moved
 * behind its own `read_legal_policies` scope, so the overwhelmingly likely cause of a failure here
 * is a permission the merchant has not granted yet — not an outage. A check told only "no policies"
 * would report an unactionable "could not read"; told "scope", it can name the permission and what
 * granting it will do.
 */
export type SnapshotPolicyAccess =
  | { available: true }
  | { available: false; reason: 'scope' | 'error'; detail: string };

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
  theme: boolean;
  storefront: boolean;
  /** True only when the crawler fetched and parsed at least one rendered page. A check that
   * needs rendered HTML MUST consult this — Admin coverage says nothing about it. */
  crawl: boolean;
}

/** Scope limits genuinely applied while building the snapshot, surfaced in audit metadata
 * so a partially-scanned large store is never presented as a full scan. */
export interface SnapshotScope {
  productLimit: number;
  /**
   * How many products/collections the STORE actually has, so the UI can report
   * "analysed of available" instead of implying the analysed count is the whole catalogue.
   * null when the count could not be read. `exact: false` means Shopify reported AT_LEAST.
   */
  productsAvailable: { count: number; exact: boolean } | null;
  collectionsAvailable: { count: number; exact: boolean } | null;
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
  /** Why `policies` is empty, when it is. `{ available: true }` whenever the fetch succeeded. */
  policyAccess: SnapshotPolicyAccess;
  /** Null when the theme could not be read (coverage.theme false). */
  theme: SnapshotTheme | null;
  /** Null when the storefront probes could not run (coverage.storefront false). */
  storefront: SnapshotStorefront | null;
  redirects: SnapshotRedirects;
  /** Rendered-storefront evidence. Null when crawling was disabled or never attempted.
   * NEVER substitute Admin fields for this — see storefront/types.ts. */
  crawl: StorefrontCrawl | null;
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
