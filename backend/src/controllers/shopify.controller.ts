import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { ApiError } from '../middleware/error.js';
import { optionalStoreId, requireUserId } from '../lib/requestContext.js';
import { callbackQuerySchema } from '../schemas/shopify.schema.js';
import { buildInstallUrl, disconnectShopify, handleShopifyCallback } from '../services/shopify-oauth.service.js';
import { getShopifyStatus, syncShopifyStore } from '../services/shopify-sync.service.js';
import { getCurrentStoreId } from '../services/store.service.js';
import { handleAppUninstalled, handleCustomersDataRequest, handleCustomersRedact, handleShopRedact, verifyWebhookHmac } from '../services/shopify-webhook.service.js';

/**
 * Returns the Shopify authorization URL for the caller to navigate to.
 *
 * It returns JSON rather than a 302 on purpose. Scorelo authenticates with a bearer token in the
 * Authorization header, and a top-level browser navigation cannot send one — so a redirect
 * endpoint behind `authenticate` would 401 every merchant who clicked Connect. The client fetches
 * this with its token, then sets window.location to the returned URL.
 *
 * The URL is built server-side and carries a signed state nonce, so the client cannot influence
 * which user, which app or which scopes the authorization is for.
 */
export function getInstall(req: Request, res: Response) {
  const userId = requireUserId(req);
  const shop = String(req.query.shop);
  console.log(`[scorelo-api] shopify: installation started for ${shop} (user ${userId})`);
  res.json({ data: { url: buildInstallUrl(userId, shop) } });
}

/** Where the merchant's browser lands after the OAuth round trip, with an outcome the
 * Integrations page reads. `reason` is a stable code, never a raw error message. */
function frontendReturn(outcome: 'connected' | 'failed' | 'cancelled', reason?: string): string {
  const url = new URL('/integrations', env.frontendUrl);
  url.searchParams.set('shopify', outcome);
  if (reason) url.searchParams.set('reason', reason);
  return url.toString();
}

/**
 * Shopify redirects the merchant's BROWSER here, so every outcome has to end in a page rather
 * than a JSON error body. Failures redirect back to Integrations with a code the UI turns into
 * merchant-readable wording; nothing is marked connected unless handleShopifyCallback succeeded.
 */
export async function getCallback(req: Request, res: Response) {
  // The merchant declined the permission screen. Not an error — say so plainly.
  if (typeof req.query.error === 'string') {
    const cancelled = req.query.error === 'access_denied';
    console.log(`[scorelo-api] shopify: installation ${cancelled ? 'cancelled by merchant' : 'rejected'} (${req.query.error})`);
    return res.redirect(frontendReturn(cancelled ? 'cancelled' : 'failed', String(req.query.error)));
  }

  const parsed = callbackQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    console.warn('[scorelo-api] shopify: callback rejected — malformed query');
    return res.redirect(frontendReturn('failed', 'invalid_callback'));
  }

  try {
    await handleShopifyCallback(req.query as Record<string, unknown>);
    return res.redirect(frontendReturn('connected'));
  } catch (error) {
    const reason = error instanceof ApiError ? error.code ?? 'connect_failed' : 'connect_failed';
    console.warn(`[scorelo-api] shopify: installation failed — ${reason}`);
    return res.redirect(frontendReturn('failed', reason));
  }
}

/** Connection state for the current store. Contains no token, in any form. */
export async function getStatus(req: Request, res: Response) {
  const userId = requireUserId(req);
  res.json({ data: await getShopifyStatus(userId, optionalStoreId(req)) });
}

export async function postSync(req: Request, res: Response) {
  const userId = requireUserId(req);
  res.json({ data: await syncShopifyStore(userId, optionalStoreId(req)) });
}

export async function postDisconnect(req: Request, res: Response) {
  const userId = requireUserId(req);
  // Resolve through the tenancy seam so a caller can only ever disconnect their own store.
  const resolvedStoreId = await getCurrentStoreId(userId, optionalStoreId(req));
  await disconnectShopify(resolvedStoreId);
  res.json({ data: await getShopifyStatus(userId, resolvedStoreId) });
}

function verifyWebhookOrThrow(req: Request) {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  const shopDomain = req.headers['x-shopify-shop-domain'];
  if (!req.rawBody || typeof hmacHeader !== 'string' || !verifyWebhookHmac(req.rawBody, hmacHeader)) {
    throw new ApiError(401, 'Invalid Shopify webhook signature', 'SHOPIFY_WEBHOOK_HMAC_INVALID');
  }
  if (typeof shopDomain !== 'string') throw new ApiError(400, 'Missing shop domain header', 'SHOPIFY_WEBHOOK_MISSING_SHOP');
  return shopDomain;
}

export async function postWebhookAppUninstalled(req: Request, res: Response) {
  const shopDomain = verifyWebhookOrThrow(req);
  await handleAppUninstalled(shopDomain);
  res.status(200).send();
}

export async function postWebhookCustomersDataRequest(req: Request, res: Response) {
  const shopDomain = verifyWebhookOrThrow(req);
  await handleCustomersDataRequest(shopDomain);
  res.status(200).send();
}

export async function postWebhookCustomersRedact(req: Request, res: Response) {
  const shopDomain = verifyWebhookOrThrow(req);
  await handleCustomersRedact(shopDomain);
  res.status(200).send();
}

export async function postWebhookShopRedact(req: Request, res: Response) {
  const shopDomain = verifyWebhookOrThrow(req);
  await handleShopRedact(shopDomain);
  res.status(200).send();
}
