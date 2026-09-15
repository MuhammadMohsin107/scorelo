// ─── Sign in with Shopify (npm test) ─────────────────────────────────
// Covers the pieces that decide whether a Shopify sign-in may become a session: which flow a state
// belongs to, that a state and a grant can never stand in for each other, that a grant only works
// with the nonce of the browser that started it, that request bodies are validated without
// disturbing what Shopify signed, and the launch-query HMAC. None of these touch the database — a
// rejected grant is refused before any account is read.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { env } from '../config/env.js';
import {
  isShopifyLoginState,
  signShopifyLoginGrant,
  signShopifyLoginState,
  signShopifyState,
  verifyShopifyLoginGrant,
  verifyShopifyLoginState,
} from '../lib/jwt.js';
import type { RequestMetadata } from '../lib/requestMetadata.js';
import { ApiError } from '../middleware/error.js';
import { shopifyLoginLaunchSchema, shopifyLoginStartSchema } from '../schemas/shopify.schema.js';
import { completeShopifyLogin } from '../services/shopify-login.service.js';
import { verifyCallbackHmac } from '../services/shopify-oauth.service.js';

const NONCE = 'n'.repeat(43);
const OTHER_NONCE = 'm'.repeat(43);
const SHOP = 'my-store.myshopify.com';
const metadata: RequestMetadata = { ipAddress: null, userAgent: null };

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const isLoginRejection = (error: unknown) => error instanceof ApiError && error.code === 'SHOPIFY_LOGIN_INVALID';

describe('shopify sign-in tokens', () => {
  it('round-trips the shop and nonce hash through the OAuth state', () => {
    const state = verifyShopifyLoginState(signShopifyLoginState(SHOP, sha256(NONCE)));
    assert.deepEqual(state, { shop: SHOP, nonceHash: sha256(NONCE) });
  });

  it('tells a sign-in state apart from a connect-a-store state', () => {
    assert.equal(isShopifyLoginState(signShopifyLoginState(SHOP, sha256(NONCE))), true);
    assert.equal(isShopifyLoginState(signShopifyState(1, 1, SHOP)), false);
    assert.equal(isShopifyLoginState('not-a-token'), false);
  });

  it('never accepts a state where a grant is expected, or the reverse', () => {
    assert.throws(() => verifyShopifyLoginGrant(signShopifyLoginState(SHOP, sha256(NONCE))));
    assert.throws(() => verifyShopifyLoginState(signShopifyLoginGrant(7, sha256(NONCE))));
  });
});

describe('completeShopifyLogin', () => {
  it('refuses a grant presented with a different browser nonce', async () => {
    const grant = signShopifyLoginGrant(7, sha256(NONCE));
    await assert.rejects(completeShopifyLogin(grant, OTHER_NONCE, metadata), isLoginRejection);
  });

  it('refuses a forged grant', async () => {
    await assert.rejects(completeShopifyLogin('forged.grant.value', NONCE, metadata), isLoginRejection);
  });

  it('refuses a sign-in state presented as a grant', async () => {
    const state = signShopifyLoginState(SHOP, sha256(NONCE));
    await assert.rejects(completeShopifyLogin(state, NONCE, metadata), isLoginRejection);
  });
});

describe('shopify sign-in request schemas', () => {
  it('normalises a typed store address', () => {
    const parsed = shopifyLoginStartSchema.parse({ shop: '  My-Store.MYSHOPIFY.com ', nonce: NONCE });
    assert.equal(parsed.shop, SHOP);
  });

  it('refuses an address that is not a myshopify domain', () => {
    assert.equal(shopifyLoginStartSchema.safeParse({ shop: 'mystore.com', nonce: NONCE }).success, false);
  });

  it('refuses a nonce that is not a base64url token', () => {
    assert.equal(shopifyLoginStartSchema.safeParse({ shop: SHOP, nonce: 'short' }).success, false);
    assert.equal(shopifyLoginStartSchema.safeParse({ shop: SHOP, nonce: `${'a'.repeat(40)}/+=` }).success, false);
  });

  it('forwards a launch query exactly as Shopify sent it', () => {
    const launch = { shop: SHOP, hmac: 'abc123', host: 'YWRtaW4uc2hvcGlmeS5jb20=', timestamp: '1789454288', locale: 'en-GB' };
    assert.deepEqual(shopifyLoginLaunchSchema.parse({ launch, nonce: NONCE }).launch, launch);
  });
});

describe('launch query HMAC', { skip: env.shopifyApiSecret ? false : 'SHOPIFY_API_SECRET is not set' }, () => {
  const sign = (query: Record<string, string>) =>
    createHmac('sha256', env.shopifyApiSecret!)
      .update(
        Object.keys(query)
          .sort()
          .map((key) => `${key}=${query[key]}`)
          .join('&'),
      )
      .digest('hex');

  it('accepts the query Shopify signed', () => {
    const query = { host: 'YWRtaW4uc2hvcGlmeS5jb20vc3RvcmUvbXktc3RvcmU', shop: SHOP, timestamp: '1789454288' };
    assert.equal(verifyCallbackHmac({ ...query, hmac: sign(query) }), true);
  });

  it('rejects the same signature over a different shop', () => {
    const query = { host: 'YWRtaW4uc2hvcGlmeS5jb20vc3RvcmUvbXktc3RvcmU', shop: SHOP, timestamp: '1789454288' };
    assert.equal(verifyCallbackHmac({ ...query, shop: 'someone-else.myshopify.com', hmac: sign(query) }), false);
  });
});
