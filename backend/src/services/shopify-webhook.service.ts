import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { integrations, shopifyConnections } from '../db/schema.js';
import { env } from '../config/env.js';

/** Shopify webhook HMAC: base64 HMAC-SHA256 of the raw request body, using the app secret. */
export function verifyWebhookHmac(rawBody: Buffer, hmacHeader: string | undefined): boolean {
  if (!hmacHeader || !env.shopifyApiSecret) return false;
  const digest = createHmac('sha256', env.shopifyApiSecret).update(rawBody).digest('base64');
  const a = Buffer.from(digest, 'utf8');
  const b = Buffer.from(hmacHeader, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function handleAppUninstalled(shopDomain: string) {
  const [connection] = await db.select().from(shopifyConnections).where(eq(shopifyConnections.shopDomain, shopDomain)).limit(1);
  if (!connection) return;

  await db
    .update(shopifyConnections)
    .set({ uninstalledAt: new Date(), lastWebhookAt: new Date() })
    .where(eq(shopifyConnections.id, connection.id));

  await db
    .update(integrations)
    .set({ status: 'not_connected', notice: 'App was uninstalled from Shopify admin.' })
    .where(eq(integrations.storeId, connection.storeId));
}

/** GDPR mandatory webhook — Scorelo stores no customer PII beyond what audits reference, so
 * this is an acknowledgement + audit-trail stamp, not a data export. */
export async function handleCustomersDataRequest(shopDomain: string) {
  await stampWebhook(shopDomain);
}

/** GDPR mandatory webhook — no customer PII is retained, so there is nothing to redact per customer. */
export async function handleCustomersRedact(shopDomain: string) {
  await stampWebhook(shopDomain);
}

/** GDPR mandatory webhook, fires ~48h after uninstall — hard-deletes the shop's connection and,
 * via cascade, every audit/finding/etc. tied to that store. */
export async function handleShopRedact(shopDomain: string) {
  const [connection] = await db.select().from(shopifyConnections).where(eq(shopifyConnections.shopDomain, shopDomain)).limit(1);
  if (!connection) return;
  await db.delete(shopifyConnections).where(eq(shopifyConnections.id, connection.id));
}

async function stampWebhook(shopDomain: string) {
  const [connection] = await db.select().from(shopifyConnections).where(eq(shopifyConnections.shopDomain, shopDomain)).limit(1);
  if (!connection) return;
  await db.update(shopifyConnections).set({ lastWebhookAt: new Date() }).where(eq(shopifyConnections.id, connection.id));
}
