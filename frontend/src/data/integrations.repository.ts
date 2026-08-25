import { api } from '../lib/api';
import type { IntegrationRow } from './api.types';
import { catalogEntryFor } from './integrationCatalog';

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
}

const statusToDisplay: Record<IntegrationRow['status'], IntegrationDisplayStatus> = {
  connected: 'Connected',
  needs_attention: 'Needs Attention',
  not_connected: 'Not Connected',
};

const statusToApi: Record<IntegrationDisplayStatus, IntegrationRow['status']> = {
  Connected: 'connected',
  'Needs Attention': 'needs_attention',
  'Not Connected': 'not_connected',
};

function formatLastSynced(isoDate: string | null): string {
  if (!isoDate) return 'Not available';
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
  };
}

export async function fetchIntegrations(): Promise<IntegrationRecord[]> {
  const rows = await api.get<IntegrationRow[]>('/integrations');
  return rows.map(toIntegrationRecord);
}

export async function updateIntegrationStatus(provider: string, status: IntegrationDisplayStatus, patch: { notice?: string | null } = {}): Promise<IntegrationRecord> {
  const row = await api.patch<IntegrationRow>(`/integrations/${provider}`, { status: statusToApi[status], ...patch });
  return toIntegrationRecord(row);
}
