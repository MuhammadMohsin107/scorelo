import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { updateReturning } from '../db/returning.js';
import { aiFixProposals, audits, findings, stores } from '../db/schema.js';
import { aiConfigured, env } from '../config/env.js';
import { ApiError } from '../middleware/error.js';
import { openAiProvider } from '../lib/ai/openai.provider.js';
import type { AiProvider, FixTarget } from '../lib/ai/provider.js';
import {
  FIELD_RULES,
  fieldForSubPillar,
  parseResourceRef,
  validateProposedValue,
  type FieldRule,
  type FixableField,
  type FixableResourceType,
} from '../lib/ai/fix-policy.js';
import { getFinding, updateFindingStatus } from './finding.service.js';
import { getCurrentStoreId } from './store.service.js';

/**
 * ─── AI Fix Planner ──────────────────────────────────────────────────
 *
 *   Finding → AI proposal → validation → preview → human approval → existing fix engine
 *
 * The model's only role is the second step. It receives audit facts and returns text; it never
 * reaches Shopify, never reaches the database, and nothing it returns is trusted. Every proposal
 * is re-derived against the audit's own record of which resources are affected, re-checked
 * against the allow-list in fix-policy.ts, and then parked in `ai_fix_proposals` as a SUGGESTION.
 * Only an explicit approval moves it forward, and approval routes through the same
 * `finding.service` entry points the manual flow uses — there is no second fix engine here.
 *
 * WHERE THE PIPELINE CURRENTLY STOPS
 * The existing fix engine records a finding's resolution; it does not write to Shopify, and the
 * app holds only read scopes (see shopify-oauth.service.ts). So an approved proposal is marked
 * `approved`, the finding is moved through the manual engine, and the proposed value is held
 * ready. Writing it back to Shopify needs write scopes and a store-mutation path that does not
 * exist yet — so this service does not pretend to have applied anything it has not.
 */

const provider: AiProvider = openAiProvider;

/** Resources sent to the model in one request. Bounds cost and keeps the completion inside its
 * token budget; a finding affecting more than this is proposed for in batches. */
const MAX_TARGETS_PER_REQUEST = 15;

/** Evidence-row statuses that mean "nothing to fix here". Everything else is a candidate. */
const HEALTHY_STATUS = 'Healthy';

/**
 * `Duplicate` is deliberately fixable while the deterministic engine offers nothing for it:
 * recommend.ts returns null because any de-duplicating suffix it invented would be arbitrary copy
 * the merchant never wrote. A model working from the resource's OWN name can do better than an
 * arbitrary suffix, which is precisely the case where AI adds something the rules cannot.
 */

interface EvidenceRow {
  id?: unknown;
  status?: unknown;
  cells?: Record<string, unknown>;
  current?: { label?: unknown; value?: unknown; meta?: unknown };
  suggested?: { label?: unknown; value?: unknown; meta?: unknown };
}

export interface FixProposalView {
  id: number;
  findingId: number;
  resourceType: string;
  resourceId: string;
  field: string;
  currentValue: string;
  proposedValue: string;
  /** The deterministic engine's suggestion, when it had one — the fallback if AI is declined. */
  deterministicValue: string | null;
  reason: string;
  status: string;
  statusDetail: string | null;
  model: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface PlanFixesResult {
  findingId: number;
  /** True only when AI produced at least one valid proposal. */
  planned: boolean;
  proposals: FixProposalView[];
  /** Targets the audit found but that produced no usable proposal, with the reason. */
  skipped: Array<{ resourceType: string; resourceId: string; reason: string }>;
  model: string | null;
  /** Present when planning did not happen at all. Coarse and non-technical by design. */
  unavailableReason?: 'disabled' | 'unavailable' | 'not_fixable' | 'nothing_to_fix';
}

function toView(row: typeof aiFixProposals.$inferSelect): FixProposalView {
  return {
    id: row.id,
    findingId: row.findingId,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    field: row.field,
    currentValue: row.currentValue,
    proposedValue: row.proposedValue,
    deterministicValue: row.deterministicValue ?? null,
    reason: row.reason,
    status: row.status,
    statusDetail: row.statusDetail ?? null,
    model: row.aiModel ?? null,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
  };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Derives the fixable resources from the finding's OWN evidence rows.
 *
 * This is the authorization anchor for "the resource belongs to this store". Evidence rows were
 * written by the audit from that store's snapshot, so a resource named here provably came from
 * the caller's store. A resourceId supplied by the model — or by a caller — that is not in this
 * set is rejected, which is what makes it impossible to aim a proposal at another tenant's
 * catalogue or at a resource the audit never examined.
 */
function extractTargets(finding: typeof findings.$inferSelect, rule: FieldRule): Array<FixTarget & { resourceType: FixableResourceType; resourceId: string }> {
  const rows = Array.isArray(finding.evidenceRows) ? (finding.evidenceRows as EvidenceRow[]) : [];
  const targets: Array<FixTarget & { resourceType: FixableResourceType; resourceId: string }> = [];

  for (const row of rows) {
    if (text(row?.status) === HEALTHY_STATUS) continue;
    const ref = parseResourceRef(row?.id);
    if (!ref) continue;
    if (!rule.resourceTypes.includes(ref.resourceType)) continue;

    const currentValue = text(row?.current?.value);
    const deterministicSuggestion = text(row?.suggested?.value) || null;
    // The row's own cells carry the resource's identity; `url` is a storefront address the
    // merchant already sees in this table, and the model needs something to name the thing by.
    const title = text(row?.cells?.title) || currentValue || text(row?.cells?.url);

    targets.push({
      ref: `${ref.resourceType}:${ref.resourceId}`,
      resourceType: ref.resourceType,
      resourceId: ref.resourceId,
      title,
      currentValue,
      deterministicSuggestion,
      // The deterministic suggestion for a description IS an excerpt of the page's own copy, so
      // it doubles as the source material. Nothing external is fetched to build this.
      sourceText: deterministicSuggestion ?? currentValue,
    });
  }

  return targets;
}

async function storeNameFor(storeId: number): Promise<string | null> {
  const [row] = await db.select({ name: stores.name }).from(stores).where(eq(stores.id, storeId)).limit(1);
  return row?.name ?? null;
}

/** The finding's store, resolved through the audit it belongs to. */
async function storeIdForFinding(findingId: number): Promise<number | null> {
  const [row] = await db
    .select({ storeId: audits.storeId })
    .from(findings)
    .innerJoin(audits, eq(findings.auditId, audits.id))
    .where(eq(findings.id, findingId))
    .limit(1);
  return row?.storeId ?? null;
}

/**
 * Generates AI fix proposals for one finding.
 *
 * Tenancy is enforced by delegating the lookup to `getFinding`, which resolves the caller's own
 * store and 404s otherwise — the same guard the manual flow uses. Nothing is applied here.
 */
export async function planAiFixes(
  userId: number,
  findingId: number,
  options: { storeId?: number; resourceIds?: string[]; limit?: number } = {},
): Promise<PlanFixesResult> {
  // Throws 404 unless this finding belongs to a store the caller owns.
  const finding = await getFinding(userId, findingId, options.storeId);

  const rule = fieldForSubPillar(finding.subPillar);
  if (!rule) {
    return {
      findingId,
      planned: false,
      proposals: [],
      skipped: [],
      model: null,
      unavailableReason: 'not_fixable',
    };
  }

  let targets = extractTargets(finding, rule);

  // A caller may narrow to specific resources (the bulk UI selecting rows). Anything outside the
  // audit's own evidence is silently absent rather than fetched — see extractTargets().
  if (options.resourceIds?.length) {
    const wanted = new Set(options.resourceIds);
    targets = targets.filter((target) => wanted.has(target.ref));
  }

  if (targets.length === 0) {
    return { findingId, planned: false, proposals: [], skipped: [], model: null, unavailableReason: 'nothing_to_fix' };
  }

  const batch = targets.slice(0, Math.min(options.limit ?? MAX_TARGETS_PER_REQUEST, MAX_TARGETS_PER_REQUEST));

  if (!aiConfigured()) {
    return {
      findingId,
      planned: false,
      proposals: [],
      skipped: [],
      model: null,
      unavailableReason: !env.aiRecommendationsEnabled ? 'disabled' : 'unavailable',
    };
  }

  const storeId = (await storeIdForFinding(findingId)) ?? (await getCurrentStoreId(userId, options.storeId));

  const result = await provider.planFix({
    findingTitle: finding.title,
    problem: finding.problem,
    field: rule.field,
    fieldLabel: rule.label,
    minLength: rule.minLength,
    maxLength: rule.maxLength,
    guidance: rule.guidance,
    storeName: await storeNameFor(storeId),
    targets: batch.map(({ ref, resourceType, title, currentValue, deterministicSuggestion, sourceText }) => ({
      ref, resourceType, title, currentValue, deterministicSuggestion, sourceText,
    })),
  });

  if (!result.ok) {
    // Reason is recorded for operators; the caller is told only that AI was unavailable, and the
    // deterministic suggestion on each evidence row remains usable exactly as before.
    console.warn(`[scorelo-ai] fix planning unavailable for finding ${findingId}: ${result.reason} (${result.detail})`);
    return { findingId, planned: false, proposals: [], skipped: [], model: null, unavailableReason: 'unavailable' };
  }

  // ── Validation: nothing the model returned is trusted past this line ──
  const byRef = new Map(batch.map((target) => [target.ref, target]));
  const accepted: Array<typeof aiFixProposals.$inferInsert> = [];
  const skipped: PlanFixesResult['skipped'] = [];

  for (const proposal of result.proposals) {
    const target = byRef.get(proposal.ref);
    if (!target) {
      // A ref we never sent. The model either hallucinated a resource or echoed one back wrong;
      // either way it is not something this finding is entitled to touch.
      skipped.push({ resourceType: 'unknown', resourceId: proposal.ref, reason: 'The suggestion referred to a resource this finding does not cover.' });
      continue;
    }

    const check = validateProposedValue(rule, proposal.proposedValue, target.currentValue);
    if (!check.ok) {
      skipped.push({ resourceType: target.resourceType, resourceId: target.resourceId, reason: check.detail });
      continue;
    }

    accepted.push({
      findingId,
      storeId,
      resourceType: target.resourceType,
      resourceId: target.resourceId,
      field: rule.field,
      currentValue: target.currentValue,
      proposedValue: check.value,
      reason: proposal.reason || 'Rewritten to meet the required length using the resource\'s own wording.',
      deterministicValue: target.deterministicSuggestion,
      status: 'proposed',
      aiModel: result.model,
    });
  }

  if (accepted.length === 0) {
    return { findingId, planned: false, proposals: [], skipped, model: result.model, unavailableReason: 'unavailable' };
  }

  // Re-planning supersedes the previous suggestion for the same target rather than stacking rows
  // the merchant would have to disambiguate. A proposal already decided on is left alone.
  await db.delete(aiFixProposals).where(and(
    eq(aiFixProposals.findingId, findingId),
    eq(aiFixProposals.status, 'proposed'),
    inArray(aiFixProposals.resourceId, accepted.map((row) => row.resourceId)),
  ));
  await db.insert(aiFixProposals).values(accepted);

  const stored = await db
    .select()
    .from(aiFixProposals)
    .where(and(eq(aiFixProposals.findingId, findingId), eq(aiFixProposals.status, 'proposed')));

  console.log(`[scorelo-ai] planned ${accepted.length} fix proposal(s) for finding ${findingId} with ${result.model} (${skipped.length} rejected by validation)`);

  return {
    findingId,
    planned: true,
    proposals: stored.map(toView),
    skipped,
    model: result.model,
  };
}

/** The preview: every proposal recorded for a finding, current-value beside proposed-value. */
export async function listFixProposals(userId: number, findingId: number, storeId?: number): Promise<FixProposalView[]> {
  // Tenancy first — this 404s unless the finding belongs to the caller.
  await getFinding(userId, findingId, storeId);
  const rows = await db.select().from(aiFixProposals).where(eq(aiFixProposals.findingId, findingId));
  return rows.map(toView);
}

/**
 * Approves or rejects one proposal.
 *
 * Approval re-runs the full validation rather than trusting what was stored: the row was written
 * from a model response, it has been sitting in a table since, and the value is about to be
 * treated as authorised. Re-checking costs nothing and removes any window in which a row that
 * would fail today could be approved because it passed when it was written.
 */
export async function decideFixProposal(
  userId: number,
  proposalId: number,
  decision: 'approve' | 'reject',
  options: { storeId?: number } = {},
): Promise<FixProposalView> {
  const resolvedStoreId = await getCurrentStoreId(userId, options.storeId);

  const [proposal] = await db
    .select()
    .from(aiFixProposals)
    .where(and(eq(aiFixProposals.id, proposalId), eq(aiFixProposals.storeId, resolvedStoreId)))
    .limit(1);
  if (!proposal) throw new ApiError(404, 'Fix proposal not found', 'FIX_PROPOSAL_NOT_FOUND');

  if (proposal.status !== 'proposed') {
    throw new ApiError(409, `This proposal has already been ${proposal.status}`, 'FIX_PROPOSAL_ALREADY_DECIDED');
  }

  const now = new Date();

  if (decision === 'reject') {
    const [updated] = await updateReturning(
      aiFixProposals,
      { status: 'rejected', decidedAt: now, decidedBy: userId },
      eq(aiFixProposals.id, proposalId),
    );
    return toView(updated!);
  }

  // ── Re-validate at the moment of approval ──
  const rule = FIELD_RULES[proposal.field as FixableField];
  if (!rule) {
    const [updated] = await updateReturning(
      aiFixProposals,
      { status: 'failed', statusDetail: 'This proposal targets a field Scorelo no longer allows to be changed.', decidedAt: now, decidedBy: userId },
      eq(aiFixProposals.id, proposalId),
    );
    throw new ApiError(422, toView(updated!).statusDetail ?? 'Invalid proposal', 'FIX_PROPOSAL_INVALID');
  }

  const check = validateProposedValue(rule, proposal.proposedValue, proposal.currentValue);
  if (!check.ok) {
    const [updated] = await updateReturning(
      aiFixProposals,
      { status: 'failed', statusDetail: check.detail, decidedAt: now, decidedBy: userId },
      eq(aiFixProposals.id, proposalId),
    );
    throw new ApiError(422, toView(updated!).statusDetail ?? check.detail, 'FIX_PROPOSAL_INVALID');
  }

  // ── Hand off to the EXISTING fix engine ──
  // Same entry point the manual flow uses, so tenancy, status transitions and the audit trail
  // behave identically whether a fix came from a person or from a model.
  await updateFindingStatus(userId, proposal.findingId, { status: 'resolved' }, options.storeId);

  const [updated] = await updateReturning(
    aiFixProposals,
    {
      status: 'approved',
      decidedAt: now,
      decidedBy: userId,
      // Stated plainly rather than reported as applied: Scorelo holds read-only Shopify scopes,
      // so no value has been written to the store. Claiming otherwise would be a lie the merchant
      // would discover on the next audit.
      statusDetail: 'Approved. Scorelo currently holds read-only Shopify access, so this value has not been written to your store — the finding has been marked resolved and the approved value is recorded here.',
    },
    eq(aiFixProposals.id, proposalId),
  );

  console.log(`[scorelo-ai] proposal ${proposalId} approved by user ${userId} for finding ${proposal.findingId}`);
  return toView(updated!);
}

export interface BulkDecisionResult {
  approved: FixProposalView[];
  rejected: FixProposalView[];
  /** Proposals that could not be actioned, each with the reason — a partial success is reported
   * as one, never rounded up to "done" or down to a failure. */
  failed: Array<{ proposalId: number; reason: string }>;
}

/**
 * Applies a set of decisions from one preview screen.
 *
 * Each proposal is decided independently: one value that no longer validates must not discard
 * the merchant's decisions about the others. The caller gets back exactly what happened to each.
 */
export async function decideFixProposals(
  userId: number,
  input: { approve?: number[]; reject?: number[] },
  options: { storeId?: number } = {},
): Promise<BulkDecisionResult> {
  const result: BulkDecisionResult = { approved: [], rejected: [], failed: [] };

  for (const proposalId of input.reject ?? []) {
    try {
      result.rejected.push(await decideFixProposal(userId, proposalId, 'reject', options));
    } catch (error) {
      result.failed.push({ proposalId, reason: error instanceof ApiError ? error.message : 'Could not reject this proposal.' });
    }
  }

  for (const proposalId of input.approve ?? []) {
    try {
      result.approved.push(await decideFixProposal(userId, proposalId, 'approve', options));
    } catch (error) {
      result.failed.push({ proposalId, reason: error instanceof ApiError ? error.message : 'Could not approve this proposal.' });
    }
  }

  return result;
}

/**
 * Bulk preparation for the future Fix Center selection UI.
 *
 * Deliberately sequential and capped: each finding is one model call, and a merchant selecting
 * fifty rows must not be able to fire fifty concurrent requests at OpenAI. One finding failing
 * never stops the rest — it comes back with its own reason, exactly as the single-finding path
 * would report it.
 */
export async function planAiFixesForFindings(
  userId: number,
  findingIds: number[],
  options: { storeId?: number } = {},
): Promise<PlanFixesResult[]> {
  const results: PlanFixesResult[] = [];
  for (const findingId of findingIds) {
    try {
      results.push(await planAiFixes(userId, findingId, options));
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) throw error;
      console.warn(`[scorelo-ai] bulk planning skipped finding ${findingId}: ${error instanceof Error ? error.message : 'unknown error'}`);
      results.push({ findingId, planned: false, proposals: [], skipped: [], model: null, unavailableReason: 'unavailable' });
    }
  }
  return results;
}

/** Whether AI fix planning can be attempted at all, and which fields it covers. Capability only —
 * never the key. */
export function aiFixStatus(): { enabled: boolean; model: string | null; fixableSubPillars: string[] } {
  return {
    enabled: aiConfigured(),
    model: aiConfigured() ? env.openaiModel : null,
    fixableSubPillars: Object.values(FIELD_RULES).map((rule) => rule.subPillar),
  };
}
