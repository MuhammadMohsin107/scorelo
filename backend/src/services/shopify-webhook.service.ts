import { createHmac, timingSafeEqual } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { integrations, shopifyConnections } from '../db/schema.js';
import { env } from '../config/env.js';
import type { ShopifyClient } from '../audit-engine/store-data/shopify-client.js';

const WEBHOOK_SUBSCRIPTION_CREATE = `
  mutation ScoreloRegisterWebhook($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
      webhookSubscription { id }
      userErrors { field message }
    }
  }
`;

interface WebhookCreateResponse {
  webhookSubscriptionCreate: {
    webhookSubscription: { id: string | null } | null;
    userErrors: Array<{ field: string[] | null; message: string | null }> | null;
  } | null;
}

/**
 * Subscribes the shop to `app/uninstalled` so Scorelo learns about an uninstall instead of
 * discovering it the next time an audit fails with a revoked token.
 *
 * Registration is deliberately best-effort: a failure here must not undo an otherwise successful
 * install. The consequence of it failing is a stale "Connected" badge until the next audit run
 * detects the dead token, which is recoverable; refusing the whole connection is not.
 *
 * The three GDPR webhooks (customers/data_request, customers/redact, shop/redact) are configured
 * in the Partner Dashboard, not through this API, so they are not registered here.
 */
export async function registerAppUninstalledWebhook(client: ShopifyClient, shopDomain: string): Promise<void> {
  if (!env.backendUrl) return;
  const callbackUrl = new URL('/api/shopify/webhooks/app-uninstalled', env.backendUrl).toString();

  try {
    const data = await client.graphql<WebhookCreateResponse>(WEBHOOK_SUBSCRIPTION_CREATE, {
      topic: 'APP_UNINSTALLED',
      webhookSubscription: { callbackUrl, format: 'JSON' },
    });

    const userErrors = data.webhookSubscriptionCreate?.userErrors ?? [];
    if (userErrors.length > 0) {
      // Re-installing an app that is already subscribed reports "address has already been taken".
      // That is the desired end state, not a failure.
      const messages = userErrors.map((error) => error.message ?? '').join('; ');
      if (/already been taken/i.test(messages)) return;
      console.warn(`[scorelo-api] shopify: app/uninstalled webhook not registered for ${shopDomain} — ${messages}`);
      return;
    }

    console.log(`[scorelo-api] shopify: app/uninstalled webhook registered for ${shopDomain}`);
  } catch (error) {
    console.warn(`[scorelo-api] shopify: app/uninstalled webhook registration failed for ${shopDomain} — ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

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

  // Scoped to the shopify row. Without the provider predicate this marked EVERY integration on
  // the store disconnected, so uninstalling the Shopify app also reported Search Console,
  // Analytics and PageSpeed as disconnected when nothing had changed about them.
  await db
    .update(integrations)
    .set({ status: 'not_connected', notice: 'App was uninstalled from Shopify admin.' })
    .where(and(eq(integrations.storeId, connection.storeId), eq(integrations.provider, 'shopify')));

  console.log(`[scorelo-api] shopify: webhook app/uninstalled processed for ${shopDomain}`);
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

/**
 * GDPR mandatory webhook, fires ~48h after uninstall. Hard-deletes the shop's OAuth connection,
 * which is where the access token lives — after this Scorelo holds no credential for the shop.
 *
 * Audits, findings and reports are deliberately NOT deleted: they hang off `stores`, not off this
 * row, and they are the merchant's own analysis history rather than Shopify customer data. Wiping
 * them is a data-retention decision, not a side effect of a redact webhook.
 */
export async function handleShopRedact(shopDomain: string) {
  const [connection] = await db.select().from(shopifyConnections).where(eq(shopifyConnections.shopDomain, shopDomain)).limit(1);
  if (!connection) return;
  await db.delete(shopifyConnections).where(eq(shopifyConnections.id, connection.id));
  console.log(`[scorelo-api] shopify: webhook shop/redact processed for ${shopDomain}`);
}

async function stampWebhook(shopDomain: string) {
  const [connection] = await db.select().from(shopifyConnections).where(eq(shopifyConnections.shopDomain, shopDomain)).limit(1);
  if (!connection) return;
  await db.update(shopifyConnections).set({ lastWebhookAt: new Date() }).where(eq(shopifyConnections.id, connection.id));
}
