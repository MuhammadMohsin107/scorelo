import { api } from '../lib/api';
import type { FindingRow } from './api.types';
import type { PillarKey } from './dashboard/dashboard.types';
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

interface FindingsPage {
  items: FindingRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/** The API caps `limit` at 100 (findingListQuerySchema), so one request cannot be assumed to
 * return everything. */
const PAGE_SIZE = 100;
/** Refuses to loop forever if the API ever reports an inconsistent totalPages. */
const MAX_PAGES = 50;

/**
 * Fetches EVERY finding for the latest audit — Fix Center works across the full set, not just the
 * priority ones.
 *
 * This previously issued a single `?limit=100` request and ignored the pagination block that came
 * back with it, so a store with more than 100 findings silently lost the remainder: the table,
 * the severity tiles and the bulk actions all operated on a truncated set with nothing on screen
 * to indicate it. Pages are now followed to completion.
 */
export async function fetchFindings(): Promise<FixFinding[]> {
  const first = await api.get<FindingsPage>(`/findings?limit=${PAGE_SIZE}&page=1`);
  const rows = [...first.items];

  const totalPages = Math.min(first.pagination?.totalPages ?? 1, MAX_PAGES);
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await api.get<FindingsPage>(`/findings?limit=${PAGE_SIZE}&page=${page}`);
    if (next.items.length === 0) break;
    rows.push(...next.items);
  }

  return rows.map(toFixFinding);
}

export async function updateFindingStatus(id: string, status: WorkflowStatus): Promise<FixFinding> {
  const finding = await api.patch<FindingRow>(`/findings/${id}/status`, { status });
  return toFixFinding(finding);
}

export async function bulkUpdateFindingStatus(ids: string[], status: WorkflowStatus): Promise<FixFinding[]> {
  const updated = await api.post<FindingRow[]>('/findings/bulk-status', { ids: ids.map(Number), status });
  return updated.map(toFixFinding);
}

// ─── Optional AI enhancement ─────────────────────────────────────────

export interface AiRecommendation {
  recommendation: string;
  whyItMatters: string;
  suggestedAction: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface AiRecommendationResult {
  findingId: number;
  /** The deterministic recommendation — always present, whatever happened with AI. */
  recommendation: string;
  enhanced: boolean;
  ai: AiRecommendation | null;
  model: string | null;
  generatedAt: string | null;
  cached: boolean;
  unavailableReason?: 'disabled' | 'unavailable';
}

/**
 * Requests an AI-enhanced version of one finding's recommendation.
 *
 * Explicitly user-triggered, never called on render: the backend caches the result on the
 * finding, so this is one model call per finding for the life of that audit. The response
 * always carries the deterministic recommendation, so a caller can render the result whether
 * or not AI was available.
 */
export function fetchAiRecommendation(findingId: string, force = false): Promise<AiRecommendationResult> {
  return api.post<AiRecommendationResult>(`/findings/${findingId}/ai-recommendation`, { force });
}

/** Whether the SERVER can attempt AI — used to hide the action rather than offer something that
 * is guaranteed to fail. Returns capability only; the API key never leaves the backend. */
export function fetchAiStatus(): Promise<{ enabled: boolean; model: string | null }> {
  return api.get<{ enabled: boolean; model: string | null }>('/findings/ai-status');
}
