import { api } from '../lib/api';
import type { IntegrationRow } from './api.types';
import { catalogEntryFor, integrationCatalog } from './integrationCatalog';

export type IntegrationDisplayStatus = 'Connected' | 'Needs Attention' | 'Not Connected';

export interface IntegrationRecord {
  id: string;
  group: string;
  name: string;
  description: string;
  status: IntegrationDisplayStatus;
  detail: string;
  lastSynced: string;
  data: string[];
  notice?: string;
  /** False when no connector exists yet — the UI must not offer a Connect action. */
  available: boolean;
}

const statusToDisplay: Record<IntegrationRow['status'], IntegrationDisplayStatus> = {
  connected: 'Connected',
  needs_attention: 'Needs Attention',
  not_connected: 'Not Connected',
};

function formatLastSynced(isoDate: string | null): string {
  if (!isoDate) return 'Never synced';
  return new Date(isoDate).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function toIntegrationRecord(row: IntegrationRow): IntegrationRecord {
  const catalog = catalogEntryFor(row.provider);
  return {
    id: row.provider,
    group: catalog.group,
    name: catalog.name,
    description: catalog.description,
    status: statusToDisplay[row.status],
    detail: row.accountDetail ?? (row.status === 'not_connected' ? 'No account connected' : 'Connected account'),
    lastSynced: formatLastSynced(row.lastSyncedAt),
    data: catalog.data,
    notice: row.notice ?? undefined,
    available: catalog.available,
  };
}

/**
 * Lists every provider in the catalog, overlaid with whatever connection state the backend holds.
 *
 * The previous version listed ONLY the rows the API returned. Since a row is created the first
 * time a provider is actually connected, a new account saw an empty Integrations page and an
 * empty "Add an integration" drawer — which is why the drawer only ever showed "More providers
 * can be added when their connector is available". A provider with no row is simply not
 * connected yet, which is exactly what the catalog entry now renders.
 */
export async function fetchIntegrations(): Promise<IntegrationRecord[]> {
  const rows = await api.get<IntegrationRow[]>('/integrations');
  const byProvider = new Map(rows.map((row) => [row.provider, row]));

  return Object.values(integrationCatalog).map((catalog) => {
    const row = byProvider.get(catalog.provider);
    if (row) return toIntegrationRecord(row);

    return {
      id: catalog.provider,
      group: catalog.group,
      name: catalog.name,
      description: catalog.description,
      status: 'Not Connected' as const,
      detail: 'No account connected',
      lastSynced: 'Never synced',
      data: catalog.data,
      available: catalog.available,
    };
  });
}
