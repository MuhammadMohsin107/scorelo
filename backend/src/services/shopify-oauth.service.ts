import { createHmac, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { insertReturning } from '../db/returning.js';
import { integrations, shopifyConnections, stores } from '../db/schema.js';
import { env, shopifyConfigured } from '../config/env.js';
import { ApiError } from '../middleware/error.js';
import { decryptToken, encryptToken } from '../lib/crypto.js';
import { signShopifyState, verifyShopifyState } from '../lib/jwt.js';
import { ShopifyClient } from '../audit-engine/store-data/shopify-client.js';
import { fetchShopIdentity } from '../audit-engine/store-data/shopify.queries.js';
import { registerAppUninstalledWebhook } from './shopify-webhook.service.js';

/**
 * ─── Access scopes ───────────────────────────────────────────────────
 * Minimum set required by the data Scorelo actually reads. Every entry below is justified by a
 * resource the provider fetches; nothing is requested "just in case", because each extra scope
 * is a permission the merchant must grant and a question Shopify asks at app review.
 *
 *   read_products     Product + Collection objects: title, descriptionHtml, seo{title,description},
 *                     media alt text, metafields. Feeds SEO (title tags, meta descriptions, image
 *                     alt text), Content (product/collection descriptions, metafields) and CRO.
 *   read_content      Page, Blog and Article objects. Feeds SEO (page titles/meta) and Content
 *                     (blog freshness, media richness). Also implicitly grants
 *                     read_online_store_pages, so that scope is NOT requested separately.
 *   read_themes       Online store theme data. Feeds Speed (theme weight, app bloat).
 *   read_metaobjects  Metaobject instances. Feeds Content (metafields/metaobjects) and
 *                     AI Discovery (structured answerable content).
 *
 * Deliberately NOT requested:
 *   read_orders, read_customers — Protected Customer Data. They force a Level 2 approval review
 *     with extra security obligations, and until approved Shopify redacts the fields anyway. No
 *     Scorelo check reads an order or a customer.
 *   read_product_listings, read_shipping, read_locations, read_price_rules, read_discounts,
 *   read_translations — no code path reads any of them.
 *
 * Changing this list changes what Shopify asks the merchant to approve. Existing connections keep
 * the scope string they were granted (stored per-connection), so a widened list only takes effect
 * for merchants who reconnect.
 */
const SCOPES = ['read_products', 'read_content', 'read_themes', 'read_metaobjects'].join(',');

/** Renew an expiring access token this many ms BEFORE it actually expires, so a long audit run
 * cannot have its token die mid-flight. */
const REFRESH_SKEW_MS = 5 * 60 * 1000;

type ShopifyConnection = typeof shopifyConnections.$inferSelect;

interface TokenResponse {
  accessToken: string;
  scope: string;
  /** Null for a legacy non-expiring token; Shopify omits these fields when `expiring` is unset. */
  accessTokenExpiresAt: Date | null;
  refreshToken: string | null;
  refreshTokenExpiresAt: Date | null;
}

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

/** Shared shape for both grants against POST /admin/oauth/access_token. Shopify documents this
 * endpoint as form-encoded; the response is JSON either way. */
async function postTokenRequest(shop: string, body: Record<string, string>, failureCode: string): Promise<TokenResponse> {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(body).toString(),
  });

  // Never include the response body in the error: on some failures Shopify echoes back request
  // parameters, and this request carries the client secret.
  if (!response.ok) throw new ApiError(502, 'Shopify rejected the OAuth token request', failureCode);

  const parsed = (await response.json()) as {
    access_token?: string;
    scope?: string;
    expires_in?: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
  };

  if (!parsed.access_token) throw new ApiError(502, 'Shopify returned no access token', failureCode);

  const now = Date.now();
  const seconds = (value: number | undefined) => (typeof value === 'number' && Number.isFinite(value) ? new Date(now + value * 1000) : null);

  return {
    accessToken: parsed.access_token,
    scope: parsed.scope ?? '',
    accessTokenExpiresAt: seconds(parsed.expires_in),
    refreshToken: parsed.refresh_token ?? null,
    refreshTokenExpiresAt: seconds(parsed.refresh_token_expires_in),
  };
}

/** `expiring=1` asks Shopify for a 1-hour access token plus a 90-day refresh token, which public
 * apps must use for Admin API requests from 2027-01-01. */
async function exchangeCodeForToken(shop: string, code: string): Promise<TokenResponse> {
  return postTokenRequest(
    shop,
    { client_id: env.shopifyApiKey!, client_secret: env.shopifyApiSecret!, code, expiring: '1' },
    'SHOPIFY_TOKEN_EXCHANGE_FAILED',
  );
}

async function refreshAccessToken(shop: string, refreshToken: string): Promise<TokenResponse> {
  return postTokenRequest(
    shop,
    { client_id: env.shopifyApiKey!, client_secret: env.shopifyApiSecret!, grant_type: 'refresh_token', refresh_token: refreshToken },
    'SHOPIFY_TOKEN_REFRESH_FAILED',
  );
}

/** A NULL expiry means a legacy non-expiring token, which is valid indefinitely — it must not be
 * mistaken for "expired at epoch" and sent through a refresh it has no refresh token for. */
function needsRefresh(connection: ShopifyConnection, nowMs: number): boolean {
  if (!connection.accessTokenExpiresAt) return false;
  return connection.accessTokenExpiresAt.getTime() - REFRESH_SKEW_MS <= nowMs;
}

async function persistTokens(connectionId: number, tokens: TokenResponse) {
  await db
    .update(shopifyConnections)
    .set({
      accessTokenEncrypted: encryptToken(tokens.accessToken),
      refreshTokenEncrypted: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      ...(tokens.scope ? { scope: tokens.scope } : {}),
    })
    .where(eq(shopifyConnections.id, connectionId));
}

/**
 * Returns a usable access token for a connection, renewing it first if it is within the refresh
 * skew of expiry. The plaintext token is returned to the caller and never persisted, logged or
 * sent to a client.
 *
 * Throws SHOPIFY_REAUTH_REQUIRED when renewal is impossible (refresh token missing or itself
 * expired) — the merchant must reconnect, and the caller should surface that rather than retry.
 */
export async function getValidAccessToken(connection: ShopifyConnection): Promise<string> {
  const nowMs = Date.now();
  if (!needsRefresh(connection, nowMs)) return decryptToken(connection.accessTokenEncrypted);

  if (!connection.refreshTokenEncrypted || (connection.refreshTokenExpiresAt && connection.refreshTokenExpiresAt.getTime() <= nowMs)) {
    await markReauthRequired(connection);
    throw new ApiError(401, 'Shopify authorization has expired — reconnect the store to continue', 'SHOPIFY_REAUTH_REQUIRED');
  }

  let tokens: TokenResponse;
  try {
    tokens = await refreshAccessToken(connection.shopDomain, decryptToken(connection.refreshTokenEncrypted));
  } catch {
    // Shopify refused the refresh token (revoked, rotated, app uninstalled). Nothing to retry.
    await markReauthRequired(connection);
    throw new ApiError(401, 'Shopify authorization has expired — reconnect the store to continue', 'SHOPIFY_REAUTH_REQUIRED');
  }

  await persistTokens(connection.id, tokens);
  return tokens.accessToken;
}

async function markReauthRequired(connection: ShopifyConnection) {
  await db
    .update(integrations)
    .set({ status: 'needs_attention', notice: 'Shopify authorization expired. Reconnect the store to resume audits.' })
    .where(and(eq(integrations.storeId, connection.storeId), eq(integrations.provider, 'shopify')));
}

/**
 * Picks the store this install belongs to.
 *
 * Signup creates one placeholder store (platform 'Not connected') so the rest of the API has
 * something to resolve. The first Shopify install CLAIMS that placeholder; every later install by
 * the same user creates an ADDITIONAL store. The previous implementation always rewrote the
 * user's first store, so connecting a second shop destroyed the first shop's identity — audits
 * stayed attached to a store row that now described a different shop.
 */
async function resolveStoreForInstall(userId: number, shop: string, shopName: string): Promise<number> {
  const ownedStores = await db.select().from(stores).where(eq(stores.ownerId, userId));
  // 'Not connected' is exactly the platform value signup writes and the callback overwrites, so
  // it identifies an unclaimed placeholder and never a store already backed by a real shop.
  const placeholder = ownedStores.find((store) => store.platform === 'Not connected');

  if (placeholder) {
    await db.update(stores).set({ name: shopName, url: `https://${shop}`, platform: 'Shopify' }).where(eq(stores.id, placeholder.id));
    return placeholder.id;
  }

  const created = await insertReturning(stores, {
    ownerId: userId,
    workspaceName: shopName,
    name: shopName,
    url: `https://${shop}`,
    platform: 'Shopify',
    industry: 'Unspecified',
    country: 'Unspecified',
    timezone: '(UTC+00:00) UTC',
    currency: 'USD — US Dollar',
  });
  if (!created) throw new ApiError(500, 'Unable to create store for Shopify connection', 'STORE_CREATE_FAILED');
  return created.id;
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

  const tokens = await exchangeCodeForToken(shop, code);

  // Prove the token actually works, and take the shop's identity from Shopify rather than
  // inferring it from the domain. If this fails, the connection is NOT recorded — a store must
  // never be shown as "Connected" on the strength of a token we never successfully used.
  const client = new ShopifyClient({ shopDomain: shop, accessToken: tokens.accessToken });
  const identity = await fetchShopIdentity(client);

  const [existingConnection] = await db.select().from(shopifyConnections).where(eq(shopifyConnections.shopDomain, shop)).limit(1);

  let storeId: number;
  if (existingConnection) {
    // The shop_domain unique index means one myshopify domain maps to exactly one store. If that
    // store belongs to someone else, this is a different Scorelo account trying to attach a shop
    // that is already claimed — refuse rather than silently hand over, or silently do nothing.
    const [owningStore] = await db.select().from(stores).where(eq(stores.id, existingConnection.storeId)).limit(1);
    if (!owningStore || owningStore.ownerId !== statePayload.sub) {
      throw new ApiError(409, 'This Shopify store is already connected to a different Scorelo account', 'SHOPIFY_SHOP_ALREADY_CLAIMED');
    }
    storeId = existingConnection.storeId;
    await db
      .update(shopifyConnections)
      .set({
        accessTokenEncrypted: encryptToken(tokens.accessToken),
        refreshTokenEncrypted: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
        scope: tokens.scope,
        shopGid: identity.gid,
        uninstalledAt: null,
      })
      .where(eq(shopifyConnections.id, existingConnection.id));
  } else {
    storeId = await resolveStoreForInstall(statePayload.sub, shop, identity.name);
    await db.insert(shopifyConnections).values({
      storeId,
      shopDomain: shop,
      accessTokenEncrypted: encryptToken(tokens.accessToken),
      refreshTokenEncrypted: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      scope: tokens.scope,
      shopGid: identity.gid,
    });
  }

  await db
    .insert(integrations)
    .values({ storeId, provider: 'shopify', status: 'connected', accountDetail: shop, lastSyncedAt: null })
    // MySQL's equivalent of ON CONFLICT DO UPDATE. It keys off any unique index the insert
    // violates, which here is integrations_store_provider_idx (store_id, provider) — the same
    // target the Postgres form named explicitly.
    //
    // lastSyncedAt is deliberately NOT stamped here: authorizing is not syncing, and stamping it
    // would show "Last synced: just now" for a store whose data has never been read.
    .onDuplicateKeyUpdate({
      set: { status: 'connected', accountDetail: shop, notice: null },
    });

  // Best-effort, and intentionally after the connection is committed: losing the webhook is
  // recoverable, losing a successful install because a subscription call failed is not.
  await registerAppUninstalledWebhook(client, shop);

  console.log(`[scorelo-api] shopify: installation completed for ${shop} (store ${storeId})`);
  return { shopDomain: shop, storeId };
}

/**
 * Revokes Scorelo's side of the connection. Historical audits are deliberately preserved — they
 * are the merchant's own analysis history, and deleting them is a data-retention decision, not a
 * side effect of disconnecting.
 */
export async function disconnectShopify(storeId: number): Promise<void> {
  const [connection] = await db
    .select()
    .from(shopifyConnections)
    .where(and(eq(shopifyConnections.storeId, storeId), isNull(shopifyConnections.uninstalledAt)))
    .limit(1);

  if (connection) {
    // The token row is dropped entirely rather than flagged: once disconnected we have no reason
    // to keep a live Admin API credential for that shop.
    await db.delete(shopifyConnections).where(eq(shopifyConnections.id, connection.id));
    console.log(`[scorelo-api] shopify: store disconnected (store ${storeId})`);
  }

  await db
    .update(integrations)
    .set({ status: 'not_connected', accountDetail: null, lastSyncedAt: null, notice: null })
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, 'shopify')));
}
