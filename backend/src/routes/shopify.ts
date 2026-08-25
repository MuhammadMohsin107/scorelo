import { Router } from 'express';
import {
  getCallback,
  getInstall,
  postWebhookAppUninstalled,
  postWebhookCustomersDataRequest,
  postWebhookCustomersRedact,
  postWebhookShopRedact,
} from '../controllers/shopify.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { callbackQuerySchema, installQuerySchema } from '../schemas/shopify.schema.js';

export const shopifyRouter = Router();

// Install must be authenticated (it signs the caller's user id into the OAuth state).
shopifyRouter.get('/install', authenticate, validateRequest({ query: installQuerySchema }), asyncHandler(getInstall));
// Callback is hit directly by Shopify's redirect — no Scorelo session exists yet; the signed
// state param (not a cookie/header) is what proves which Scorelo user is connecting.
shopifyRouter.get('/callback', validateRequest({ query: callbackQuerySchema }), asyncHandler(getCallback));

// Webhooks are authenticated via per-request HMAC (verifyWebhookOrThrow), not a user session.
shopifyRouter.post('/webhooks/app-uninstalled', asyncHandler(postWebhookAppUninstalled));
shopifyRouter.post('/webhooks/customers-data-request', asyncHandler(postWebhookCustomersDataRequest));
shopifyRouter.post('/webhooks/customers-redact', asyncHandler(postWebhookCustomersRedact));
shopifyRouter.post('/webhooks/shop-redact', asyncHandler(postWebhookShopRedact));
