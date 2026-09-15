import bcrypt from 'bcryptjs';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { integrations, shopifyConnections, stores, users } from '../db/schema.js';
import { ApiError } from '../middleware/error.js';
import { encryptToken } from '../lib/crypto.js';
import {
  signShopifyLoginGrant,
  signShopifyLoginState,
  verifyShopifyLoginGrant,
  verifyShopifyLoginState,
} from '../lib/jwt.js';
import type { RequestMetadata } from '../lib/requestMetadata.js';
import { ShopifyClient } from '../audit-engine/store-data/shopify-client.js';
import { fetchShopIdentity, fetchShopOwner, type ShopIdentity } from '../audit-engine/store-data/shopify.queries.js';
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  requireConfigured,
  verifyCallbackHmac,
  type TokenResponse,
} from './shopify-oauth.service.js';
import { registerAppUninstalledWebhook } from './shopify-webhook.service.js';
import { createNotification } from './notification.service.js';
import { completeExternalSignIn } from './auth.service.js';

/**
 * ─── Sign in with Shopify ────────────────────────────────────────────
 *
 * The shop IS the identity. A merchant proves who they are by approving Scorelo on Shopify's own
 * authorization screen, which Shopify only shows to someone signed in to that shop's admin. Scorelo
 * never sees or stores a password for this route.
 *
 *   start      the browser sends a shop (typed, or delivered signed by Shopify) and a nonce hash
 *   authorize  Shopify authenticates the merchant and redirects to the shared callback
 *   callback   the code is exchanged, the token proven against the Admin API, and the shop resolved
 *              to an account — the existing one, or a new one created from Shopify's own records
 *   complete   the starting browser redeems a two-minute grant with its raw nonce for a session
 *
 * WHICH ACCOUNT A SHOP OPENS. A shop Scorelo already holds a connection for signs in to the account
 * that owns that store — including a connection left behind by an uninstall, because reinstalling
 * the same shop is the same merchant coming back to the same audit history. A shop Scorelo has never
 * seen gets a new account.
 *
 * ACCOUNTS ARE NEVER LINKED BY EMAIL. A shop owner controls the email address on their shop, so
 * attaching a shop to whichever Scorelo account already uses that address would let anyone who can
 * edit a store's settings walk into someone else's account. That case is refused with a message
 * saying how to connect the store from the existing account instead.
 */

const SHOP_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

/** Matches SALT_ROUNDS in auth.service.ts. */
const SALT_ROUNDS = 12;

function hashNonce(nonce: string): string {
  return createHash('sha256').update(nonce).digest('hex');
}

/** The encrypted credential columns, shared by the insert and update paths so the two can never
 * store a token pair differently. */
function tokenColumns(tokens: TokenResponse) {
  return {
    accessTokenEncrypted: encryptToken(tokens.accessToken),
    refreshTokenEncrypted: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
    scope: tokens.scope,
  };
}

// ─── Start ───────────────────────────────────────────────────────────

/** The authorization URL for a shop the merchant typed on Scorelo's sign-in page. */
export function beginShopifyLogin(shop: string, nonce: string): string {
  requireConfigured();
  return buildAuthorizeUrl(shop, signShopifyLoginState(shop, hashNonce(nonce)));
}

/**
 * The authorization URL for a shop Shopify delivered — the merchant opened Scorelo from the App
 * Store or from the Apps list in their admin, so nothing was typed at all.
 *
 * The query is trusted only after its HMAC verifies. No freshness window is applied: replaying an
 * old launch link does nothing but show Shopify's own authorization screen again, which Shopify
 * still guards with the merchant's admin session.
 */
export function beginShopifyLaunch(launch: Record<string, string>, nonce: string): string {
  requireConfigured();
  if (!verifyCallbackHmac(launch)) {
    throw new ApiError(401, 'This link from Shopify could not be verified. Open Scorelo from your Shopify admin again.', 'SHOPIFY_HMAC_INVALID');
  }
  const shop = launch.shop;
  if (typeof shop !== 'string' || !SHOP_DOMAIN.test(shop)) {
    throw new ApiError(400, 'This link from Shopify did not name a store.', 'SHOPIFY_LAUNCH_INVALID');
  }
  return beginShopifyLogin(shop, nonce);
}

// ─── Callback ────────────────────────────────────────────────────────

/**
 * Completes Shopify's side of sign-in and returns the grant the frontend redeems.
 *
 * Nothing is recorded until the token has been exchanged AND used successfully against the Admin
 * API — the same rule the Integrations connect flow follows, so a shop is never attached to an
 * account on the strength of a token that was never proven to work.
 */
export async function handleShopifyLoginCallback(query: Record<string, unknown>): Promise<string> {
  requireConfigured();

  if (!verifyCallbackHmac(query)) throw new ApiError(401, 'Invalid Shopify OAuth signature', 'SHOPIFY_HMAC_INVALID');

  const shop = String(query.shop);
  const code = String(query.code);

  let state;
  try {
    state = verifyShopifyLoginState(String(query.state));
  } catch {
    throw new ApiError(401, 'Invalid or expired OAuth state', 'SHOPIFY_STATE_INVALID');
  }
  if (state.shop !== shop) throw new ApiError(401, 'OAuth state does not match shop', 'SHOPIFY_STATE_MISMATCH');

  const tokens = await exchangeCodeForToken(shop, code);
  const client = new ShopifyClient({ shopDomain: shop, accessToken: tokens.accessToken });
  const identity = await fetchShopIdentity(client);

  const [existing] = await db.select().from(shopifyConnections).where(eq(shopifyConnections.shopDomain, shop)).limit(1);
  const userId = existing
    ? await signInToExistingShop(existing, shop, tokens, identity, client)
    : await createAccountForShop(shop, tokens, identity, client);

  return signShopifyLoginGrant(userId, state.nonceHash);
}

async function signInToExistingShop(
  connection: typeof shopifyConnections.$inferSelect,
  shop: string,
  tokens: TokenResponse,
  identity: ShopIdentity,
  client: ShopifyClient,
): Promise<number> {
  const [store] = await db.select().from(stores).where(eq(stores.id, connection.storeId)).limit(1);
  // The foreign key makes this unreachable; refusing is still better than guessing an account.
  if (!store) throw new ApiError(409, 'This Shopify store could not be matched to a Scorelo account.', 'SHOPIFY_LOGIN_UNAVAILABLE');

  const reinstalled = connection.uninstalledAt !== null;

  // The token Shopify just issued is newer than the stored one and has been proven to work, so it
  // replaces it. That also recovers a connection whose authorization had expired.
  await db
    .update(shopifyConnections)
    .set({ ...tokenColumns(tokens), shopGid: identity.gid, uninstalledAt: null })
    .where(eq(shopifyConnections.id, connection.id));

  await db
    .insert(integrations)
    .values({ storeId: store.id, provider: 'shopify', status: 'connected', accountDetail: shop, lastSyncedAt: null })
    .onDuplicateKeyUpdate({ set: { status: 'connected', accountDetail: shop, notice: null } });

  if (reinstalled) {
    // Shopify drops webhook subscriptions on uninstall, so a reinstall has to register again.
    await registerAppUninstalledWebhook(client, shop);
    await createNotification({
      storeId: store.id,
      type: 'integration_alert',
      title: 'Shopify store reconnected',
      message: `Scorelo is connected to ${shop} again. Run a sync from Integrations to read your latest store data.`,
      tone: 'success',
    });
    console.log(`[scorelo-api] shopify: sign-in reinstalled ${shop} (store ${store.id})`);
  }

  return store.ownerId;
}

/**
 * Opens a Scorelo account for a shop Scorelo has never seen.
 *
 * Every value written comes from Shopify. What Shopify did not report is left as the schema's
 * explicit "Unspecified" rather than a plausible default, and the owner's name is left empty when
 * Shopify does not share it — the merchant can add it in Settings, and an empty name is honest
 * where a made-up one is not.
 *
 * The account has NO usable password. The hash is of 32 random bytes that are discarded immediately,
 * so no one knows it and the password form can never match it. The merchant signs in with Shopify,
 * or sets a password later through "Forgot password", which mails the address Shopify gave us.
 */
async function createAccountForShop(
  shop: string,
  tokens: TokenResponse,
  identity: ShopIdentity,
  client: ShopifyClient,
): Promise<number> {
  const owner = await fetchShopOwner(client);
  const email = (owner.email ?? identity.contactEmail)?.trim().toLowerCase() || null;

  if (!email) {
    throw new ApiError(422, 'Shopify did not share an email address for this store, so a Scorelo account cannot be created for it.', 'SHOPIFY_LOGIN_NO_EMAIL');
  }

  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (taken) {
    throw new ApiError(
      409,
      'A Scorelo account already uses this store’s email address. Sign in with your email and password, then connect the store from Integrations.',
      'SHOPIFY_LOGIN_EMAIL_TAKEN',
    );
  }

  const passwordHash = await bcrypt.hash(randomBytes(32).toString('base64url'), SALT_ROUNDS);

  // One transaction: an account without its store, or a store without its connection, is a
  // half-built signup nothing could ever display or repair.
  const { userId, storeId } = await db.transaction(async (tx) => {
    const [userHeader] = await tx.insert(users).values({ fullName: owner.name ?? '', email, passwordHash });
    const newUserId = userHeader.insertId;

    const [storeHeader] = await tx.insert(stores).values({
      ownerId: newUserId,
      workspaceName: identity.name,
      name: identity.name,
      // The same form handleShopifyCallback writes, so connecting and signing in agree on it.
      url: `https://${shop}`,
      platform: 'Shopify',
      // Not something Shopify knows. Guided setup asks for it.
      industry: 'Unspecified',
      country: identity.country ?? 'Unspecified',
      timezone: identity.ianaTimezone ?? 'Unspecified',
      currency: identity.currencyCode ?? 'Unspecified',
    });
    const newStoreId = storeHeader.insertId;

    await tx.insert(shopifyConnections).values({ storeId: newStoreId, shopDomain: shop, shopGid: identity.gid, ...tokenColumns(tokens) });
    await tx.insert(integrations).values({ storeId: newStoreId, provider: 'shopify', status: 'connected', accountDetail: shop, lastSyncedAt: null });

    return { userId: newUserId, storeId: newStoreId };
  });

  await createNotification({
    storeId,
    type: 'integration_alert',
    title: 'Shopify store connected',
    message: `Scorelo is now connected to ${shop}. Run a sync from Integrations to read your store data.`,
    tone: 'success',
  });

  // Best-effort and after commit, as in the connect flow: a missed subscription is recoverable, a
  // lost account is not.
  await registerAppUninstalledWebhook(client, shop);

  console.log(`[scorelo-api] shopify: sign-in created an account for ${shop} (user ${userId}, store ${storeId})`);
  return userId;
}

// ─── Complete ────────────────────────────────────────────────────────

/**
 * Exchanges the grant for a session — only in the browser that started the sign-in.
 *
 * Every failure is the same 401: an expired grant, a forged one and a nonce from another browser
 * are indistinguishable from outside.
 */
export async function completeShopifyLogin(grant: string, nonce: string, metadata: RequestMetadata) {
  const rejected = () =>
    new ApiError(401, 'This Shopify sign-in has expired. Please start again.', 'SHOPIFY_LOGIN_INVALID');

  let payload;
  try {
    payload = verifyShopifyLoginGrant(grant);
  } catch {
    throw rejected();
  }

  const expected = Buffer.from(payload.nonceHash, 'hex');
  const presented = createHash('sha256').update(nonce).digest();
  if (expected.length !== presented.length || !timingSafeEqual(expected, presented)) {
    console.warn(`[scorelo-auth] shopify sign-in rejected: nonce mismatch (user ${payload.sub})`);
    throw rejected();
  }

  return completeExternalSignIn(payload.sub, metadata);
}
