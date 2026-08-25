import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '30d';

interface AccessTokenPayload {
  sub: number;
  type: 'access';
}

interface RefreshTokenPayload {
  sub: number;
  type: 'refresh';
}

export function signAccessToken(userId: number): string {
  return jwt.sign({ sub: userId, type: 'access' } satisfies AccessTokenPayload, env.jwtAccessSecret, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

export function signRefreshToken(userId: number): string {
  return jwt.sign({ sub: userId, type: 'refresh' } satisfies RefreshTokenPayload, env.jwtRefreshSecret, {
    expiresIn: REFRESH_TOKEN_TTL,
  });
}

export function refreshTokenTtlMs(): number {
  return 30 * 24 * 60 * 60 * 1000;
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.jwtAccessSecret) as jwt.JwtPayload;
  if (payload.type !== 'access' || typeof payload.sub !== 'number') throw new Error('Not an access token');
  return payload as unknown as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, env.jwtRefreshSecret) as jwt.JwtPayload;
  if (payload.type !== 'refresh' || typeof payload.sub !== 'number') throw new Error('Not a refresh token');
  return payload as unknown as RefreshTokenPayload;
}

interface ShopifyStatePayload {
  sub: number;
  shop: string;
  type: 'shopify_state';
}

/** Short-lived signed nonce carrying the authenticated user's id through Shopify's OAuth redirect
 * (which is otherwise unauthenticated from Scorelo's perspective — Shopify only echoes it back). */
export function signShopifyState(userId: number, shop: string): string {
  return jwt.sign({ sub: userId, shop, type: 'shopify_state' } satisfies ShopifyStatePayload, env.jwtAccessSecret, { expiresIn: '10m' });
}

export function verifyShopifyState(token: string): ShopifyStatePayload {
  const payload = jwt.verify(token, env.jwtAccessSecret) as jwt.JwtPayload;
  if (payload.type !== 'shopify_state' || typeof payload.sub !== 'number' || typeof payload.shop !== 'string') {
    throw new Error('Not a shopify_state token');
  }
  return payload as unknown as ShopifyStatePayload;
}
