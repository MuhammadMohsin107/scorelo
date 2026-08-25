import { api } from '../lib/api';
import type { FindingRow } from './api.types';
import type { PillarKey } from './dashboard/dashboard.mock';
import { pillarMeta, subPillarLabel } from './pillarMeta';
import type { FixFinding, WorkflowStatus } from './workflows.mock';

function toFixFinding(finding: FindingRow): FixFinding {
  const pillar = finding.pillar as PillarKey;
  return {
    id: String(finding.id),
    title: finding.title,
    pillar,
    pillarLabel: pillarMeta[pillar].label,
    subPillar: subPillarLabel(pillar, finding.subPillar),
    severity: finding.severity,
    affected: finding.affectedCount,
    affectedLabel: finding.affectedLabel,
    impact: finding.impact as 'High' | 'Medium' | 'Low',
    status: finding.status,
    scoreLift: finding.scoreLift,
    why: finding.why,
    evidence: finding.evidence,
    recommendation: finding.recommendation,
    statusChangedAt: finding.statusChangedAt,
  };
}

/** Fetches every finding for the latest audit (Fix Center works across the full set, not just priority ones). */
export async function fetchFindings(): Promise<FixFinding[]> {
  const { items } = await api.get<{ items: FindingRow[] }>('/findings?limit=100');
  return items.map(toFixFinding);
}

export async function updateFindingStatus(id: string, status: WorkflowStatus): Promise<FixFinding> {
  const finding = await api.patch<FindingRow>(`/findings/${id}/status`, { status });
  return toFixFinding(finding);
}

export async function bulkUpdateFindingStatus(ids: string[], status: WorkflowStatus): Promise<FixFinding[]> {
  const updated = await api.post<FindingRow[]>('/findings/bulk-status', { ids: ids.map(Number), status });
  return updated.map(toFixFinding);
}
