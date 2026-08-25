import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { ApiError } from '../middleware/error.js';
import { requireUserId } from '../lib/requestContext.js';
import { buildInstallUrl, handleShopifyCallback } from '../services/shopify-oauth.service.js';
import { handleAppUninstalled, handleCustomersDataRequest, handleCustomersRedact, handleShopRedact, verifyWebhookHmac } from '../services/shopify-webhook.service.js';

export function getInstall(req: Request, res: Response) {
  const userId = requireUserId(req);
  const shop = String(req.query.shop);
  const url = buildInstallUrl(userId, shop);
  res.redirect(url);
}

export async function getCallback(req: Request, res: Response) {
  const { storeId } = await handleShopifyCallback(req.query as Record<string, unknown>);
  const redirectBase = new URL('/settings/integrations', env.frontendUrl).toString();
  res.redirect(`${redirectBase}?shopify_connected=1&storeId=${storeId}`);
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
