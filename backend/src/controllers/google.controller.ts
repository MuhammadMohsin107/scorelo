import type { Request, Response } from 'express';
import { env, googleConfigured } from '../config/env.js';
import { optionalStoreId, requireUserId } from '../lib/requestContext.js';
import { getCurrentStoreId } from '../services/store.service.js';
import { buildGoogleAuthUrl, disconnectGoogle, handleGoogleCallback } from '../services/google-oauth.service.js';
import {
  getSearchConsolePerformance,
  getSearchConsoleStatus,
  listSearchConsoleSites,
  selectSearchConsoleSite,
} from '../services/search-console.service.js';

/**
 * ─── Google Search Console endpoints ─────────────────────────────────
 *
 * Every handler except the callback resolves the store with getCurrentStoreId(), which scopes to
 * stores the caller owns — so a storeId in a query string can never point a connection, a property
 * selection or a data read at somebody else's store.
 *
 * The callback is the one unauthenticated route, by necessity: Google redirects a browser to it
 * and carries no Scorelo session. Its identity comes entirely from the signed `state`, which is
 * why that state is a JWT rather than a random string kept in memory.
 */

/** Returns the consent URL rather than redirecting, so the SPA controls the navigation. */
export async function getGoogleAuthUrl(req: Request, res: Response) {
  const userId = requireUserId(req);
  const storeId = await getCurrentStoreId(userId, optionalStoreId(req));
  res.json({ data: { url: buildGoogleAuthUrl(userId, storeId) } });
}

/**
 * Where Google sends the merchant's browser back to.
 *
 * ALWAYS REDIRECTS TO THE APP, success or failure. This is a browser navigation, not an API call —
 * returning JSON here would leave the merchant staring at a raw payload on a backend domain. The
 * outcome travels as a query parameter the Integrations page reads and then strips, which is the
 * same pattern the Shopify callback already uses.
 */
export async function getGoogleCallback(req: Request, res: Response) {
  const target = new URL(`${env.frontendUrl.replace(/\/+$/, '')}/integrations`);

  try {
    await handleGoogleCallback(req.query as Record<string, unknown>);
    target.searchParams.set('google', 'connected');
  } catch (error) {
    // The code, never the message: Google's text can name the account and the property, and this
    // lands in a URL the merchant's browser history keeps.
    const code = error instanceof Error && 'code' in error ? String((error as { code: unknown }).code) : 'GOOGLE_FAILED';
    target.searchParams.set('google', 'failed');
    target.searchParams.set('reason', code);
  }

  res.redirect(target.toString());
}

export async function getGoogleStatus(req: Request, res: Response) {
  const storeId = await getCurrentStoreId(requireUserId(req), optionalStoreId(req));
  res.json({ data: await getSearchConsoleStatus(storeId, googleConfigured()) });
}

/** The properties the connected Google account can read, for the merchant to choose from. */
export async function getGoogleSites(req: Request, res: Response) {
  const storeId = await getCurrentStoreId(requireUserId(req), optionalStoreId(req));
  res.json({ data: await listSearchConsoleSites(storeId) });
}

/** Records which property this store reports on. Verified against the account's own list. */
export async function postGoogleSite(req: Request, res: Response) {
  const storeId = await getCurrentStoreId(requireUserId(req), optionalStoreId(req));
  await selectSearchConsoleSite(storeId, req.body.siteUrl);
  res.json({ data: await getSearchConsoleStatus(storeId, googleConfigured()) });
}

/** Live search performance. Every number comes from Google in this request. */
export async function getGooglePerformance(req: Request, res: Response) {
  const storeId = await getCurrentStoreId(requireUserId(req), optionalStoreId(req));
  const days = typeof req.query.days === 'number' ? req.query.days : 28;
  res.json({ data: await getSearchConsolePerformance(storeId, days) });
}

export async function postGoogleDisconnect(req: Request, res: Response) {
  const storeId = await getCurrentStoreId(requireUserId(req), optionalStoreId(req));
  await disconnectGoogle(storeId);
  res.json({ data: await getSearchConsoleStatus(storeId, googleConfigured()) });
}
