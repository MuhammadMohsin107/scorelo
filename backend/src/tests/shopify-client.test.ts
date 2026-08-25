import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ShopifyClient, parseNextLink } from '../audit-engine/store-data/shopify-client.js';
import { StoreDataError } from '../audit-engine/store-data/types.js';

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

function client(fetchImpl: (url: string) => Promise<Response>, maxRetries = 2) {
  return new ShopifyClient({
    shopDomain: 'test.myshopify.com',
    accessToken: 'test-token',
    fetchImpl: (url) => fetchImpl(url),
    sleepImpl: async () => {}, // never actually sleep in tests
    maxRetries,
  });
}

describe('parseNextLink', () => {
  it('extracts the rel="next" URL', () => {
    const header = '<https://x.myshopify.com/admin/api/2025-01/products.json?page_info=abc>; rel="next"';
    assert.equal(parseNextLink(header), 'https://x.myshopify.com/admin/api/2025-01/products.json?page_info=abc');
  });

  it('ignores rel="previous" and returns null when there is no next page', () => {
    const header = '<https://x.myshopify.com/prev>; rel="previous"';
    assert.equal(parseNextLink(header), null);
    assert.equal(parseNextLink(null), null);
  });

  it('picks next out of a combined previous+next header', () => {
    const header = '<https://x/prev>; rel="previous", <https://x/next>; rel="next"';
    assert.equal(parseNextLink(header), 'https://x/next');
  });
});

describe('ShopifyClient error mapping', () => {
  it('maps 401 to a non-retryable TOKEN_REVOKED', async () => {
    const c = client(async () => jsonResponse({}, { status: 401 }));
    const error = await c.get('shop.json').catch((e) => e);
    assert.ok(error instanceof StoreDataError);
    assert.equal(error.code, 'TOKEN_REVOKED');
    assert.equal(error.retryable, false);
  });

  it('maps 403 to MISSING_SCOPES', async () => {
    const c = client(async () => jsonResponse({}, { status: 403 }));
    const error = await c.get('orders.json').catch((e) => e);
    assert.equal((error as StoreDataError).code, 'MISSING_SCOPES');
  });

  it('returns null for 404 so an absent resource does not fail the audit', async () => {
    const c = client(async () => jsonResponse({}, { status: 404 }));
    assert.equal(await c.get('policies.json'), null);
  });

  it('retries 5xx then surfaces a retryable API_UNAVAILABLE', async () => {
    let calls = 0;
    const c = client(async () => {
      calls += 1;
      return jsonResponse({}, { status: 500 });
    });
    const error = await c.get('shop.json').catch((e) => e);
    assert.equal((error as StoreDataError).code, 'API_UNAVAILABLE');
    assert.equal((error as StoreDataError).retryable, true);
    assert.equal(calls, 3, 'should attempt the initial call plus maxRetries');
  });

  it('recovers when a transient 500 is followed by success', async () => {
    let calls = 0;
    const c = client(async () => {
      calls += 1;
      return calls === 1 ? jsonResponse({}, { status: 500 }) : jsonResponse({ shop: { name: 'Acme' } });
    });
    const result = await c.get<{ shop: { name: string } }>('shop.json');
    assert.equal(result?.shop.name, 'Acme');
  });

  it('retries on 429 honouring Retry-After, then succeeds', async () => {
    let calls = 0;
    const c = client(async () => {
      calls += 1;
      return calls === 1 ? jsonResponse({}, { status: 429, headers: { 'Retry-After': '1' } }) : jsonResponse({ shop: { name: 'Acme' } });
    });
    const result = await c.get<{ shop: { name: string } }>('shop.json');
    assert.equal(result?.shop.name, 'Acme');
    assert.equal(calls, 2);
  });

  it('gives up on sustained 429 with a retryable RATE_LIMITED', async () => {
    const c = client(async () => jsonResponse({}, { status: 429 }));
    const error = await c.get('products.json').catch((e) => e);
    assert.equal((error as StoreDataError).code, 'RATE_LIMITED');
    assert.equal((error as StoreDataError).retryable, true);
  });

  it('maps a non-JSON body to MALFORMED_RESPONSE instead of crashing', async () => {
    const c = client(async () => new Response('<html>maintenance</html>', { status: 200 }));
    const error = await c.get('shop.json').catch((e) => e);
    assert.equal((error as StoreDataError).code, 'MALFORMED_RESPONSE');
  });

  it('retries network-level failures', async () => {
    let calls = 0;
    const c = client(async () => {
      calls += 1;
      if (calls < 2) throw new Error('ECONNRESET');
      return jsonResponse({ shop: { name: 'Acme' } });
    });
    const result = await c.get<{ shop: { name: string } }>('shop.json');
    assert.equal(result?.shop.name, 'Acme');
  });
});

describe('ShopifyClient pagination', () => {
  it('follows Link headers across pages', async () => {
    const c = client(async (url) => {
      if (url.includes('page_info=second')) {
        return jsonResponse({ products: [{ id: 3 }] });
      }
      return jsonResponse({ products: [{ id: 1 }, { id: 2 }] }, {
        headers: { Link: '<https://test.myshopify.com/admin/api/2025-01/products.json?page_info=second>; rel="next"' },
      });
    });
    const { items } = await c.getPaginated<{ id: number }>('products.json', 'products', 100);
    assert.deepEqual(items.map((p) => p.id), [1, 2, 3]);
  });

  it('stops at the scope limit and reports truncation honestly', async () => {
    const c = client(async () =>
      jsonResponse({ products: [{ id: 1 }, { id: 2 }] }, {
        headers: { Link: '<https://test.myshopify.com/admin/api/2025-01/products.json?page_info=next>; rel="next"' },
      }),
    );
    const { items, truncated } = await c.getPaginated<{ id: number }>('products.json', 'products', 2);
    assert.equal(items.length, 2);
    assert.equal(truncated, true, 'a store with more data than the limit must report truncated');
  });

  it('does not report truncation when everything fit', async () => {
    const c = client(async () => jsonResponse({ products: [{ id: 1 }] }));
    const { items, truncated } = await c.getPaginated<{ id: number }>('products.json', 'products', 50);
    assert.equal(items.length, 1);
    assert.equal(truncated, false);
  });

  it('rejects a response whose payload key is not an array', async () => {
    const c = client(async () => jsonResponse({ products: { unexpected: 'shape' } }));
    const error = await c.getPaginated('products.json', 'products', 10).catch((e) => e);
    assert.equal((error as StoreDataError).code, 'MALFORMED_RESPONSE');
  });

  it('treats a 404 collection as empty rather than an error', async () => {
    const c = client(async () => jsonResponse({}, { status: 404 }));
    const { items } = await c.getPaginated('pages.json', 'pages', 10);
    assert.deepEqual(items, []);
  });
});
