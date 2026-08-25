import { StoreDataError } from './types.js';

export const SHOPIFY_API_VERSION = '2025-01';

/** Injectable so tests can drive pagination / 429 / malformed-response paths without network. */
export type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string> }) => Promise<Response>;

export interface ShopifyClientOptions {
  shopDomain: string;
  accessToken: string;
  fetchImpl?: FetchLike;
  /** Overridable so tests don't actually sleep through backoff. */
  sleepImpl?: (ms: number) => Promise<void>;
  maxRetries?: number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Parses the `<...>; rel="next"` entry out of Shopify's Link header (cursor pagination). */
export function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(',')) {
    const [urlPart, ...relParts] = part.split(';');
    if (!urlPart) continue;
    const rel = relParts.join(';');
    if (!/rel="?next"?/.test(rel)) continue;
    const match = urlPart.trim().match(/^<(.+)>$/);
    if (match?.[1]) return match[1];
  }
  return null;
}

export class ShopifyClient {
  private readonly shopDomain: string;
  private readonly accessToken: string;
  private readonly fetchImpl: FetchLike;
  private readonly sleepImpl: (ms: number) => Promise<void>;
  private readonly maxRetries: number;
  /** Serializes calls so we never burst past Shopify's leaky bucket. */
  private chain: Promise<unknown> = Promise.resolve();

  constructor(options: ShopifyClientOptions) {
    this.shopDomain = options.shopDomain;
    this.accessToken = options.accessToken;
    this.fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init));
    this.sleepImpl = options.sleepImpl ?? defaultSleep;
    this.maxRetries = options.maxRetries ?? 3;
  }

  private base(path: string): string {
    return `https://${this.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/${path}`;
  }

  /** All requests funnel through one promise chain: Shopify's REST limit is per-shop, so
   * issuing them serially (plus header-driven throttling) is what keeps us inside it. */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.chain.then(task, task);
    this.chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async requestOnce(url: string): Promise<Response> {
    let attempt = 0;
    for (;;) {
      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          method: 'GET',
          headers: { 'X-Shopify-Access-Token': this.accessToken, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        // Network-level failure (DNS, timeout, connection reset) — transient by nature.
        if (attempt >= this.maxRetries) {
          throw new StoreDataError('API_UNAVAILABLE', `Shopify request failed: ${error instanceof Error ? error.message : 'network error'}`, true);
        }
        attempt += 1;
        await this.sleepImpl(250 * 2 ** attempt);
        continue;
      }

      if (response.status === 429) {
        if (attempt >= this.maxRetries) {
          throw new StoreDataError('RATE_LIMITED', 'Shopify rate limit exceeded after retries', true);
        }
        const retryAfter = Number(response.headers.get('Retry-After') ?? '2');
        attempt += 1;
        await this.sleepImpl(Math.max(1000, retryAfter * 1000));
        continue;
      }

      if (response.status === 401) {
        throw new StoreDataError('TOKEN_REVOKED', 'Shopify access token is invalid or was revoked — the merchant must reconnect the store', false);
      }
      if (response.status === 403) {
        throw new StoreDataError('MISSING_SCOPES', 'Shopify denied access to this resource — the app is missing a required scope', false);
      }
      if (response.status >= 500) {
        if (attempt >= this.maxRetries) {
          throw new StoreDataError('API_UNAVAILABLE', `Shopify API error ${response.status}`, true);
        }
        attempt += 1;
        await this.sleepImpl(250 * 2 ** attempt);
        continue;
      }

      // Stay well inside the leaky bucket: if the shop's call budget is nearly spent, pause.
      const callLimit = response.headers.get('X-Shopify-Shop-Api-Call-Limit');
      if (callLimit) {
        const [used, cap] = callLimit.split('/').map(Number);
        if (Number.isFinite(used) && Number.isFinite(cap) && cap > 0 && used / cap > 0.8) {
          await this.sleepImpl(1000);
        }
      }

      return response;
    }
  }

  /** Single resource fetch. Returns null (never throws) for 404 so an absent optional
   * resource degrades into a coverage flag instead of failing the whole audit. */
  async get<T>(path: string): Promise<T | null> {
    return this.enqueue(async () => {
      const response = await this.requestOnce(this.base(path));
      if (response.status === 404) return null;
      if (!response.ok) throw new StoreDataError('API_UNAVAILABLE', `Shopify API error ${response.status}`, response.status >= 500);
      try {
        return (await response.json()) as T;
      } catch {
        throw new StoreDataError('MALFORMED_RESPONSE', `Shopify returned a non-JSON body for ${path}`, false);
      }
    });
  }

  /**
   * Cursor-paginated collection fetch. `limit` caps TOTAL items returned (scope control for
   * large stores); the caller learns whether it truncated via the returned flag rather than
   * silently receiving a partial list.
   */
  async getPaginated<T>(path: string, key: string, limit: number): Promise<{ items: T[]; truncated: boolean }> {
    const pageSize = Math.min(250, Math.max(1, limit));
    let url: string | null = this.base(`${path}${path.includes('?') ? '&' : '?'}limit=${pageSize}`);
    const items: T[] = [];

    while (url && items.length < limit) {
      const currentUrl: string = url;
      const { body, nextUrl } = await this.enqueue(async () => {
        const response = await this.requestOnce(currentUrl);
        if (response.status === 404) return { body: null, nextUrl: null };
        if (!response.ok) throw new StoreDataError('API_UNAVAILABLE', `Shopify API error ${response.status}`, response.status >= 500);
        let parsed: Record<string, unknown>;
        try {
          parsed = (await response.json()) as Record<string, unknown>;
        } catch {
          throw new StoreDataError('MALFORMED_RESPONSE', `Shopify returned a non-JSON body for ${path}`, false);
        }
        return { body: parsed, nextUrl: parseNextLink(response.headers.get('Link')) };
      });

      if (!body) break;
      const batch = body[key];
      // Defensive: a shape change or unexpected payload must not crash the worker.
      if (!Array.isArray(batch)) {
        throw new StoreDataError('MALFORMED_RESPONSE', `Shopify response for ${path} did not contain an array at "${key}"`, false);
      }
      items.push(...(batch as T[]));
      url = nextUrl;
    }

    return { items: items.slice(0, limit), truncated: items.length > limit || (items.length >= limit && url !== null) };
  }
}
