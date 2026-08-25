import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { shopifyConnections, stores } from '../../db/schema.js';
import { decryptToken } from '../../lib/crypto.js';
import { ShopifyClient } from './shopify-client.js';
import { ShopifyStoreDataProvider } from './shopify.provider.js';
import { StoreDataError, type StoreDataProvider } from './types.js';

export * from './types.js';

/** True when the store has a live (non-uninstalled) Shopify connection. Used by the audit
 * trigger to reject a run up-front instead of failing minutes later inside the worker. */
export async function hasStoreDataSource(storeId: number): Promise<boolean> {
  const [connection] = await db
    .select({ id: shopifyConnections.id })
    .from(shopifyConnections)
    .where(and(eq(shopifyConnections.storeId, storeId), isNull(shopifyConnections.uninstalledAt)))
    .limit(1);
  return Boolean(connection);
}

/**
 * Resolves the data provider for a store. Today only Shopify exists; adding another platform
 * means adding one provider here, not touching any check (master prompt C6).
 */
export async function resolveStoreDataProvider(storeId: number): Promise<StoreDataProvider> {
  const [store] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!store) throw new StoreDataError('NOT_CONNECTED', 'Store not found', false);

  const [connection] = await db
    .select()
    .from(shopifyConnections)
    .where(and(eq(shopifyConnections.storeId, storeId), isNull(shopifyConnections.uninstalledAt)))
    .limit(1);

  if (!connection) {
    throw new StoreDataError('NOT_CONNECTED', 'No connected Shopify store — connect a store before running an audit', false);
  }

  // Decrypted only here, held only for this run's lifetime, never logged or returned by any API.
  const accessToken = decryptToken(connection.accessTokenEncrypted);
  const client = new ShopifyClient({ shopDomain: connection.shopDomain, accessToken });

  return new ShopifyStoreDataProvider(client, storeId, connection.shopDomain, store.pageLimit);
}
