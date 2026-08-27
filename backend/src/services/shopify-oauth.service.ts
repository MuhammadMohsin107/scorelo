import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { insertReturning } from '../db/returning.js';
import { integrations, shopifyConnections, stores } from '../db/schema.js';
import { env, shopifyConfigured } from '../config/env.js';
import { ApiError } from '../middleware/error.js';
import { encryptToken } from '../lib/crypto.js';
import { signShopifyState, verifyShopifyState } from '../lib/jwt.js';

// The full set of Admin API scopes every pillar's audit checks need (see backend-plan §5 /
// the approved implementation plan) — requested once at install so re-auth is never needed
// mid-audit-engine-build.
const SCOPES = [
  'read_products',
  'read_product_listings',
  'read_content',
  'read_themes',
  'read_online_store_pages',
  'read_online_store_navigation',
  'read_metaobjects',
  'read_orders',
  'read_customers',
  'read_shipping',
  'read_locations',
  'read_price_rules',
  'read_discounts',
  'read_translations',
].join(',');

function requireConfigured() {
  if (!shopifyConfigured()) {
    throw new ApiError(500, 'Shopify app is not configured on this server (missing SHOPIFY_API_KEY/SECRET/BACKEND_URL/TOKEN_ENCRYPTION_KEY)', 'SHOPIFY_NOT_CONFIGURED');
  }
}

export function buildInstallUrl(userId: number, shop: string): string {
  requireConfigured();
  const state = signShopifyState(userId, shop);
  const redirectUri = new URL('/api/shopify/callback', env.backendUrl).toString();
  const authorizeUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authorizeUrl.searchParams.set('client_id', env.shopifyApiKey!);
  authorizeUrl.searchParams.set('scope', SCOPES);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', state);
  return authorizeUrl.toString();
}

/** Shopify's documented OAuth-callback HMAC check: sort every param except hmac/signature,
 * join as key=value with '&', HMAC-SHA256 with the app secret, compare to the sent hmac. */
function verifyCallbackHmac(query: Record<string, unknown>): boolean {
  const { hmac, signature: _signature, ...rest } = query as Record<string, string>;
  if (!hmac) return false;
  const message = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${rest[key]}`)
    .join('&');
  const digest = createHmac('sha256', env.shopifyApiSecret!).update(message).digest('hex');
  const a = Buffer.from(digest, 'utf8');
  const b = Buffer.from(hmac, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

async function exchangeCodeForToken(shop: string, code: string): Promise<{ accessToken: string; scope: string }> {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: env.shopifyApiKey, client_secret: env.shopifyApiSecret, code }),
  });
  if (!response.ok) throw new ApiError(502, 'Shopify rejected the OAuth code exchange', 'SHOPIFY_TOKEN_EXCHANGE_FAILED');
  const body = (await response.json()) as { access_token: string; scope: string };
  return { accessToken: body.access_token, scope: body.scope };
}

export async function handleShopifyCallback(query: Record<string, unknown>): Promise<{ shopDomain: string; storeId: number }> {
  requireConfigured();

  if (!verifyCallbackHmac(query)) throw new ApiError(401, 'Invalid Shopify OAuth signature', 'SHOPIFY_HMAC_INVALID');

  const shop = String(query.shop);
  const code = String(query.code);
  const state = String(query.state);

  let statePayload;
  try {
    statePayload = verifyShopifyState(state);
  } catch {
    throw new ApiError(401, 'Invalid or expired OAuth state', 'SHOPIFY_STATE_INVALID');
  }
  if (statePayload.shop !== shop) throw new ApiError(401, 'OAuth state does not match shop', 'SHOPIFY_STATE_MISMATCH');

  const { accessToken, scope } = await exchangeCodeForToken(shop, code);
  const accessTokenEncrypted = encryptToken(accessToken);

  // Reuse the caller's existing default store (created at signup) the first time they connect;
  // a second `?shop=` install by the same user creates an additional store.
  const [existingConnection] = await db.select().from(shopifyConnections).where(eq(shopifyConnections.shopDomain, shop)).limit(1);

  let storeId: number;
  if (existingConnection) {
    storeId = existingConnection.storeId;
    await db
      .update(shopifyConnections)
      .set({ accessTokenEncrypted, scope, uninstalledAt: null })
      .where(eq(shopifyConnections.id, existingConnection.id));
  } else {
    const [userStores] = await db.select().from(stores).where(eq(stores.ownerId, statePayload.sub)).limit(1);
    if (userStores) {
      storeId = userStores.id;
      await db.update(stores).set({ name: shop, url: `https://${shop}`, platform: 'Shopify' }).where(eq(stores.id, storeId));
    } else {
      const created = await insertReturning(stores, {
        ownerId: statePayload.sub,
        workspaceName: shop,
        name: shop,
        url: `https://${shop}`,
        platform: 'Shopify',
        industry: 'Unspecified',
        country: 'Unspecified',
        timezone: '(UTC+00:00) UTC',
        currency: 'USD — US Dollar',
      });
      if (!created) throw new ApiError(500, 'Unable to create store for Shopify connection', 'STORE_CREATE_FAILED');
      storeId = created.id;
    }
    await db.insert(shopifyConnections).values({ storeId, shopDomain: shop, accessTokenEncrypted, scope });
  }

  await db
    .insert(integrations)
    .values({ storeId, provider: 'shopify', status: 'connected', accountDetail: shop, lastSyncedAt: new Date() })
    // MySQL's equivalent of ON CONFLICT DO UPDATE. It keys off any unique index the insert
    // violates, which here is integrations_store_provider_idx (store_id, provider) — the same
    // target the Postgres form named explicitly.
    .onDuplicateKeyUpdate({
      set: { status: 'connected', accountDetail: shop, lastSyncedAt: new Date(), notice: null },
    });

  return { shopDomain: shop, storeId };
}
