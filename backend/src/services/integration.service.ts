import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { updateReturning } from '../db/returning.js';
import { integrations } from '../db/schema.js';
import { ApiError } from '../middleware/error.js';
import type { UpdateIntegrationInput } from '../schemas/integration.schema.js';
import { getCurrentStoreId } from './store.service.js';

export async function listIntegrations(userId: number, storeId?: number) {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  return db.select().from(integrations).where(eq(integrations.storeId, resolvedStoreId)).orderBy(asc(integrations.provider));
}

export async function updateIntegration(userId: number, provider: string, input: UpdateIntegrationInput, storeId?: number) {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  // A connection event is a sync event — stamp it server-side so the client never invents a timestamp.
  const values = input.status === 'connected' ? { ...input, lastSyncedAt: new Date() } : input;
  const [updatedIntegration] = await updateReturning(
    integrations,
    values,
    and(eq(integrations.storeId, resolvedStoreId), eq(integrations.provider, provider)),
  );

  if (!updatedIntegration) throw new ApiError(404, 'Integration not found', 'INTEGRATION_NOT_FOUND');
  return updatedIntegration;
}
