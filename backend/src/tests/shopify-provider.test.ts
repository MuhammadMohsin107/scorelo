import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ShopifyClient } from '../audit-engine/store-data/shopify-client.js';
import { ShopifyStoreDataProvider } from '../audit-engine/store-data/shopify.provider.js';
import { StoreDataError } from '../audit-engine/store-data/types.js';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Routes a fake Shopify API from a path->body map; unlisted paths 404. */
function providerFor(routes: Record<string, unknown>, productLimit = 100) {
  const client = new ShopifyClient({
    shopDomain: 'test.myshopify.com',
    accessToken: 'token',
    sleepImpl: async () => {},
    maxRetries: 0,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname.replace('/admin/api/2025-01/', '');
      const match = Object.entries(routes).find(([route]) => path === route);
      if (!match) return jsonResponse({}, 404);
      if (match[1] instanceof Error) throw match[1];
      return jsonResponse(match[1]);
    },
  });
  return new ShopifyStoreDataProvider(client, 42, 'test.myshopify.com', productLimit);
}

const SHOP = { shop: { name: 'Acme', email: 'a@b.com', currency: 'USD', country_name: 'US', iana_timezone: 'UTC', plan_name: 'basic' } };

describe('ShopifyStoreDataProvider normalization', () => {
  it('builds a snapshot with normalized store identity', async () => {
    const snapshot = await providerFor({ 'shop.json': SHOP }).buildSnapshot();
    assert.equal(snapshot.storeId, 42);
    assert.equal(snapshot.shop.name, 'Acme');
    assert.equal(snapshot.shop.primaryUrl, 'https://test.myshopify.com');
    assert.equal(snapshot.coverage.shop, true);
  });

  it('fails fast when the shop record is absent — store identity is not optional', async () => {
    const error = await providerFor({ 'shop.json': { shop: null } }).buildSnapshot().catch((e) => e);
    assert.ok(error instanceof StoreDataError);
    assert.equal(error.code, 'MALFORMED_RESPONSE');
  });

  it('derives real storefront URLs from handles', async () => {
    const snapshot = await providerFor({
      'shop.json': SHOP,
      'products.json': { products: [{ id: 1, title: 'Mug', handle: 'mug' }] },
    }).buildSnapshot();
    assert.equal(snapshot.products[0].url, 'https://test.myshopify.com/products/mug');
  });

  it('survives null and missing product fields without crashing', async () => {
    const snapshot = await providerFor({
      'shop.json': SHOP,
      'products.json': {
        products: [
          { id: 1 }, // everything absent
          { id: 2, title: null, handle: null, body_html: null, tags: null, images: null, variants: null },
        ],
      },
    }).buildSnapshot();

    assert.equal(snapshot.products.length, 2);
    assert.equal(snapshot.products[0].title, '');
    assert.deepEqual(snapshot.products[1].tags, []);
    assert.deepEqual(snapshot.products[1].images, []);
    assert.equal(snapshot.products[1].variantCount, 0);
  });

  it('preserves the difference between a missing alt attribute and an empty one', async () => {
    const snapshot = await providerFor({
      'shop.json': SHOP,
      'products.json': {
        products: [{ id: 1, handle: 'p', images: [{ id: 9, src: 'https://cdn/a.jpg' }, { id: 10, src: 'https://cdn/b.jpg', alt: '' }] }],
      },
    }).buildSnapshot();

    // null = attribute absent, '' = present but blank. Collapsing these would make the
    // image-alt-text check unable to describe what is actually wrong.
    assert.equal(snapshot.products[0].images[0].alt, null);
    assert.equal(snapshot.products[0].images[1].alt, '');
  });

  it('drops images that have no usable src rather than emitting broken rows', async () => {
    const snapshot = await providerFor({
      'shop.json': SHOP,
      'products.json': { products: [{ id: 1, handle: 'p', images: [{ id: 1 }, null, 'nonsense', { id: 2, src: 'https://cdn/ok.jpg' }] }] },
    }).buildSnapshot();
    assert.equal(snapshot.products[0].images.length, 1);
    assert.equal(snapshot.products[0].images[0].src, 'https://cdn/ok.jpg');
  });

  it('marks metafields unavailable (not empty) when they cannot be read', async () => {
    const snapshot = await providerFor({
      'shop.json': SHOP,
      'products.json': { products: [{ id: 1, handle: 'p' }] },
      // no metafields route -> 404 -> unavailable
    }).buildSnapshot();

    assert.equal(snapshot.products[0].metafieldsAvailable, false);
    assert.equal(snapshot.coverage.metafields, false, 'must not claim coverage we do not have');
  });

  it('reads SEO overrides out of global metafields when available', async () => {
    const snapshot = await providerFor({
      'shop.json': SHOP,
      'products.json': { products: [{ id: 1, handle: 'p' }] },
      'products/1/metafields.json': {
        metafields: [
          { namespace: 'global', key: 'title_tag', type: 'single_line_text_field', value: 'Custom SEO title' },
          { namespace: 'global', key: 'description_tag', type: 'multi_line_text_field', value: 'Custom SEO description' },
        ],
      },
    }).buildSnapshot();

    assert.equal(snapshot.products[0].metafieldsAvailable, true);
    assert.equal(snapshot.products[0].seoTitle, 'Custom SEO title');
    assert.equal(snapshot.products[0].seoDescription, 'Custom SEO description');
    assert.equal(snapshot.coverage.metafields, true);
  });

  it('records a warning and degrades coverage when one resource group fails', async () => {
    const snapshot = await providerFor({
      'shop.json': SHOP,
      'products.json': { products: [{ id: 1, handle: 'p' }] },
      'custom_collections.json': new Error('boom'),
    }).buildSnapshot();

    // Products still captured; only collections degraded.
    assert.equal(snapshot.coverage.products, true);
    assert.equal(snapshot.coverage.collections, false);
    assert.ok(snapshot.warnings.some((w) => w.startsWith('collections:')));
  });

  it('propagates a revoked token instead of silently producing an empty snapshot', async () => {
    const client = new ShopifyClient({
      shopDomain: 'test.myshopify.com',
      accessToken: 'token',
      sleepImpl: async () => {},
      maxRetries: 0,
      fetchImpl: async (url) =>
        new URL(url).pathname.endsWith('shop.json') ? jsonResponse(SHOP) : jsonResponse({}, 401),
    });
    const provider = new ShopifyStoreDataProvider(client, 42, 'test.myshopify.com', 100);
    const error = await provider.buildSnapshot().catch((e) => e);
    assert.ok(error instanceof StoreDataError);
    assert.equal(error.code, 'TOKEN_REVOKED');
  });

  it('reports the applied scope limit so a partial scan is never presented as complete', async () => {
    const snapshot = await providerFor(
      { 'shop.json': SHOP, 'products.json': { products: [{ id: 1, handle: 'a' }, { id: 2, handle: 'b' }] } },
      1,
    ).buildSnapshot();

    assert.equal(snapshot.products.length, 1);
    assert.equal(snapshot.scope.productLimit, 1);
  });

  it('merges custom and smart collections into one normalized list', async () => {
    const snapshot = await providerFor({
      'shop.json': SHOP,
      'custom_collections.json': { custom_collections: [{ id: 1, title: 'Manual', handle: 'manual' }] },
      'smart_collections.json': { smart_collections: [{ id: 2, title: 'Auto', handle: 'auto' }] },
    }).buildSnapshot();

    assert.deepEqual(snapshot.collections.map((c) => c.handle).sort(), ['auto', 'manual']);
    assert.equal(snapshot.collections[0].url, 'https://test.myshopify.com/collections/manual');
  });

  it('walks blogs to collect articles with correct blog-scoped URLs', async () => {
    const snapshot = await providerFor({
      'shop.json': SHOP,
      'blogs.json': { blogs: [{ id: 7, handle: 'news' }] },
      'blogs/7/articles.json': { articles: [{ id: 70, title: 'Post', handle: 'post' }] },
    }).buildSnapshot();

    assert.equal(snapshot.articles.length, 1);
    assert.equal(snapshot.articles[0].url, 'https://test.myshopify.com/blogs/news/post');
  });
});
