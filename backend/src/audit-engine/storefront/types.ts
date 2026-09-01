// ─── Storefront crawl evidence ───────────────────────────────────────
// What a crawl-based check is allowed to reason about.
//
// THE RULE THIS FILE EXISTS TO ENFORCE: a check that asks "what does the rendered page contain?"
// must read it from here, never from the Admin snapshot. The Admin API knows what the merchant
// TYPED; only the storefront knows what the theme actually SERVED. A product whose Admin
// `seo.title` is perfect can still render a title the theme built from a different field, and a
// store whose Admin record lists no apps can still load six third-party scripts. Substituting one
// for the other produces a confident, wrong score — which is the single failure mode this whole
// separation is designed to make impossible.

/** Why a page could not be turned into evidence. Never collapsed into "failed" — the distinction
 * decides whether a check reports a real problem or reports that it could not look. */
export type CrawlFailureReason =
  | 'password_gated'
  | 'timeout'
  | 'dns'
  | 'connection'
  | 'ssl'
  | 'http_error'
  | 'not_html'
  | 'too_large'
  | 'redirect_loop'
  | 'blocked'
  | 'aborted';

export interface CrawlHeading {
  /** 1-6. */
  level: number;
  text: string;
}

export interface CrawlLink {
  /** Absolute, normalised, fragment stripped. */
  url: string;
  /** Raw href as authored, kept so evidence can quote what is actually in the markup. */
  href: string;
  text: string;
  internal: boolean;
  rel: string | null;
}

export interface CrawlImage {
  src: string;
  /** null = no alt ATTRIBUTE at all; '' = present but empty (decorative). The distinction is the
   * whole point of an alt-text check, so it is preserved exactly as authored. */
  alt: string | null;
  loading: string | null;
  width: string | null;
  height: string | null;
}

export interface CrawlScript {
  /** Absolute src, or null for an inline script. */
  src: string | null;
  /** Host of `src`, for third-party attribution. Null when inline or unparseable. */
  host: string | null;
  /** True when the host is not the storefront's own. */
  thirdParty: boolean;
  async: boolean;
  defer: boolean;
  /** Byte length of an inline script body; 0 for external. */
  inlineBytes: number;
}

/** One parsed JSON-LD block. `types` is flattened across @graph so a check can ask "is there a
 * Product?" without re-walking the structure. */
export interface CrawlJsonLd {
  /** Every @type found anywhere in this block, including inside @graph. */
  types: string[];
  /** Parsed value. Kept so a check can inspect required properties (offers, price, …). */
  data: unknown;
  /** Set when the block was present but could not be parsed — a real, reportable defect. */
  parseError: string | null;
}

/** A page Scorelo actually fetched and parsed. */
export interface CrawledPage {
  /** The URL Scorelo requested. */
  url: string;
  /** Where it ended up after redirects. */
  finalUrl: string;
  /** Which Shopify resource this page represents, for grouping evidence by page type. */
  pageType: 'home' | 'product' | 'collection' | 'page' | 'article' | 'other';
  /** The Admin resource id this URL was built from, when it came from the snapshot. */
  resourceId: string | null;
  status: number;
  redirectChain: string[];
  responseTimeMs: number;
  /** Transferred bytes of the HTML document itself. */
  bytes: number;

  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  /** Raw content of <meta name="robots">, lower-cased. */
  robots: string | null;
  /** True when the page asks not to be indexed. */
  noindex: boolean;

  headings: CrawlHeading[];
  links: CrawlLink[];
  images: CrawlImage[];
  scripts: CrawlScript[];
  jsonLd: CrawlJsonLd[];

  /** Visible text length, used as a crude content-presence signal. Not a quality judgement. */
  textLength: number;
  /** Lower-cased visible text, capped. Present so trust/locator checks can look for rendered
   * wording without every check re-deriving it from the HTML. */
  text: string;
}

export interface CrawlFailure {
  url: string;
  pageType: CrawledPage['pageType'];
  resourceId: string | null;
  reason: CrawlFailureReason;
  status: number;
  detail: string;
}

/** A non-HTML resource fetched verbatim (robots.txt, sitemap.xml, agents.md, llms.txt). */
export interface FetchedResource {
  url: string;
  finalUrl: string;
  status: number;
  /** Null when the fetch failed or the body was not captured. */
  body: string | null;
  contentType: string | null;
  /**
   * True when this response is Shopify's password screen rather than the resource.
   *
   * A gated storefront answers EVERY url with HTTP 200 and the password page, so `status === 200`
   * proves nothing on its own. Reporting agents.md as "present" because the gate returned 200
   * would be a fabricated result — this flag is what stops that.
   */
  passwordGated: boolean;
  reason: CrawlFailureReason | null;
}

/** Why a whole crawl produced nothing. Checks turn this into an honest `unavailable` reason. */
export type CrawlUnavailableReason =
  | 'disabled'
  | 'password_gated'
  | 'unreachable'
  | 'no_targets';

export interface StorefrontCrawl {
  origin: string;
  startedAt: Date;
  /** True when at least one HTML page was fetched and parsed. */
  available: boolean;
  /** Set only when `available` is false. */
  unavailableReason: CrawlUnavailableReason | null;
  /**
   * True when the storefront is behind Shopify's access gate and Scorelo could not get past it.
   * Every rendered-HTML check must report `unavailable` in this state — the password page is real
   * HTML, and analysing it would describe Shopify's markup, not the merchant's.
   */
  passwordGated: boolean;
  pages: CrawledPage[];
  failures: CrawlFailure[];
  robots: FetchedResource | null;
  sitemap: FetchedResource | null;
  /** Sitemaps referenced by robots.txt, or child sitemaps of a sitemap index. */
  sitemapUrls: string[];
  /** URLs listed across the sitemap(s) actually fetched. */
  sitemapEntries: string[];
  agentsMd: FetchedResource | null;
  llmsTxt: FetchedResource | null;
  /** Status of internal link targets Scorelo verified, keyed by absolute URL. */
  linkStatuses: Record<string, number>;
  /** Limits actually applied, so a partial crawl is never presented as exhaustive. */
  budget: { maxPages: number; concurrency: number; timeoutMs: number; pagesFetched: number; truncated: boolean };
  /** Non-fatal problems worth surfacing to an operator. Never contains credentials. */
  warnings: string[];
}
