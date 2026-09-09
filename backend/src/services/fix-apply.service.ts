import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { aiFixProposals } from '../db/schema.js';
import { ApiError } from '../middleware/error.js';
import { resolveShopifyClient } from '../audit-engine/store-data/index.js';
import { StoreDataError } from '../audit-engine/store-data/types.js';
import type { ShopifyClient } from '../audit-engine/store-data/shopify-client.js';
import {
  FIELD_RULES,
  isFixableResourceType,
  validateProposedValue,
  type FixableField,
  type FixableResourceType,
} from '../lib/ai/fix-policy.js';
import { getFixContext } from './fixability.service.js';

/**
 * ─── Applying an approved fix to the merchant's store ────────────────
 *
 * THE STEP THAT WAS MISSING. Everything before this existed: the audit finds a gap, a value is
 * proposed, a human approves it, and the proposal lands in `ai_fix_proposals` with status
 * `approved`. Nothing then wrote it to Shopify, so `approved` was where the pipeline stopped and
 * the merchant's storefront never changed. The schema anticipated this — `applied` and `failed`
 * have always been valid statuses — but the engine that moves a row between them did not exist.
 *
 * ─── WHY AN APPLIED FIX ACTUALLY MOVES THE SCORE ─────────────────────
 * Because the field written here is the SAME field the audit reads back. That is not a hope, it is
 * a property of the mapping below:
 *
 *   product / collection   written: productUpdate / collectionUpdate `seo { description }`
 *                          read:    PRODUCTS_QUERY / COLLECTIONS_QUERY `seo { description }`
 *   page / article         written: `global.description_tag` metafield
 *                          read:    PAGES_QUERY / ARTICLES_QUERY metafields(namespace: "global")
 *
 * Page and Article genuinely have no `seo` field on their update inputs — verified against the
 * 2026-07 schema — which is exactly why shopify.provider.ts already reads their listing from the
 * `global` metafields. Writing anywhere else would produce a change the next audit could not see,
 * and a merchant staring at an unchanged score after a successful apply.
 *
 * The audit itself re-fetches live (`buildSnapshot()` has no cache) and the meta-description check
 * reads Admin API data rather than crawled HTML, so there is no CDN or theme delay between the
 * write and the next run seeing it.
 *
 * ─── WHAT THIS SERVICE REFUSES TO DO ─────────────────────────────────
 * Every write is bounded by the same allow-list the proposal passed on the way in, re-checked here
 * rather than trusted. A stored row is not evidence that it is still valid: the field rules may
 * have tightened, and a row could in principle be edited outside this flow. `validateProposedValue`
 * runs again immediately before the mutation, so a value that would not pass today is never sent to
 * a live storefront.
 */

/** One resource's outcome. Returned to the caller and mirrored into the proposal row. */
export interface ApplyResult {
  proposalId: number;
  status: 'applied' | 'failed' | 'skipped';
  /** Why it failed or was skipped. Never contains a credential or a raw API payload. */
  detail?: string;
}

export interface ApplySummary {
  applied: number;
  failed: number;
  skipped: number;
  results: ApplyResult[];
}

/** Shopify's `userErrors` shape, identical across the four mutations used here. */
interface UserError {
  field?: string[] | null;
  message?: string | null;
}

/**
 * The `global` namespace is where the online store keeps a Page's or Article's search listing.
 * `single_line_text_field` is the type Shopify's own SEO guide specifies; writing a different type
 * would store the value but leave the theme unable to render it.
 */
const SEO_METAFIELD_NAMESPACE = 'global';
const SEO_METAFIELD_TYPE = 'single_line_text_field';

/** Which `global` metafield key backs each SEO field on Pages and Articles. */
const METAFIELD_KEY: Partial<Record<FixableField, string>> = {
  'seo.title': 'title_tag',
  'seo.description': 'description_tag',
};

/** Which key of Shopify's `SEOInput` each field maps to on Products and Collections. */
const SEO_INPUT_KEY: Partial<Record<FixableField, 'title' | 'description'>> = {
  'seo.title': 'title',
  'seo.description': 'description',
};

const PRODUCT_MUTATION = `
  mutation ScoreloApplyProductSeo($id: ID!, $seo: SEOInput!) {
    productUpdate(product: { id: $id, seo: $seo }) {
      product { id }
      userErrors { field message }
    }
  }
`;

const COLLECTION_MUTATION = `
  mutation ScoreloApplyCollectionSeo($id: ID!, $seo: SEOInput!) {
    collectionUpdate(input: { id: $id, seo: $seo }) {
      collection { id }
      userErrors { field message }
    }
  }
`;

const PAGE_MUTATION = `
  mutation ScoreloApplyPageSeo($id: ID!, $metafields: [MetafieldInput!]) {
    pageUpdate(id: $id, page: { metafields: $metafields }) {
      page { id }
      userErrors { field message }
    }
  }
`;

const ARTICLE_MUTATION = `
  mutation ScoreloApplyArticleSeo($id: ID!, $metafields: [MetafieldInput!]) {
    articleUpdate(id: $id, article: { metafields: $metafields }) {
      article { id }
      userErrors { field message }
    }
  }
`;

/**
 * Writes ONE field to ONE resource, returning Shopify's own complaints rather than throwing them.
 *
 * `userErrors` is the half of a Shopify mutation that a transport-level check misses entirely: a
 * rejected value comes back as HTTP 200 with a populated `userErrors` array. Treating that as
 * success is the classic way an integration reports "applied" for a change that never happened,
 * which here would mean telling a merchant their SEO is fixed and then showing them an unchanged
 * score forever.
 */
async function writeField(
  client: ShopifyClient,
  resourceType: FixableResourceType,
  resourceId: string,
  field: FixableField,
  value: string,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  const seoKey = SEO_INPUT_KEY[field];
  const metafieldKey = METAFIELD_KEY[field];

  // image.alt is on the allow-list for PROPOSING but is not writable through any of the four
  // mutations here — product media alt text goes through a different path entirely. Refused
  // explicitly rather than silently no-oped, so a merchant is never told it was applied.
  if (!seoKey || !metafieldKey) {
    return { ok: false, detail: `Scorelo cannot yet write ${FIELD_RULES[field].label} to Shopify.` };
  }

  const metafields = [
    { namespace: SEO_METAFIELD_NAMESPACE, key: metafieldKey, value, type: SEO_METAFIELD_TYPE },
  ];

  // Only the ONE key being fixed is sent. Shopify leaves an omitted SEOInput key unchanged, so a
  // description fix cannot blank a title the merchant wrote.
  const plan = {
    product: { query: PRODUCT_MUTATION, variables: { id: resourceId, seo: { [seoKey]: value } }, root: 'productUpdate' },
    collection: { query: COLLECTION_MUTATION, variables: { id: resourceId, seo: { [seoKey]: value } }, root: 'collectionUpdate' },
    page: { query: PAGE_MUTATION, variables: { id: resourceId, metafields }, root: 'pageUpdate' },
    article: { query: ARTICLE_MUTATION, variables: { id: resourceId, metafields }, root: 'articleUpdate' },
  }[resourceType];

  try {
    const data = await client.graphql<Record<string, { userErrors?: UserError[] } | undefined>>(
      plan.query,
      plan.variables,
    );
    const errors = data?.[plan.root]?.userErrors ?? [];
    if (errors.length > 0) {
      // Shopify's own wording, truncated to the column. It describes the value, never a credential.
      const detail = errors.map((error) => error?.message).filter(Boolean).join('; ').slice(0, 500);
      return { ok: false, detail: detail || 'Shopify rejected the change.' };
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof StoreDataError) return { ok: false, detail: error.message };
    // The transport's message only — never the request body, which carries the access token.
    return { ok: false, detail: error instanceof Error ? error.message.slice(0, 500) : 'Unknown transport error' };
  }
}

/**
 * Applies approved proposals to the store, one resource at a time.
 *
 * SEQUENTIAL, NOT PARALLEL. Every write costs Shopify calculated points against a leaky bucket the
 * client already throttles for; firing a bulk apply concurrently is the fastest way to be
 * rate-limited into partial failure, which on a write path means a half-updated catalogue.
 *
 * PARTIAL SUCCESS IS A REAL OUTCOME and is reported as one. Each proposal's fate is recorded on its
 * own row, so a bulk apply that fails on three of twenty leaves seventeen genuinely applied and
 * three marked `failed` with Shopify's reason attached — rather than an all-or-nothing rollback
 * that would have to un-write changes the merchant may already want.
 *
 * @param storeId  Resolved from the authenticated request by the caller, never from a body.
 */
export async function applyApprovedProposals(
  storeId: number,
  fixes: Array<{ proposalId: number; value?: string }>,
  userId: number,
): Promise<ApplySummary> {
  const proposalIds = fixes.map((fix) => fix.proposalId);
  const overrideById = new Map(
    fixes.filter((fix) => typeof fix.value === 'string').map((fix) => [fix.proposalId, fix.value as string]),
  );
  // STORE ID IS PART OF THE PREDICATE, not a check performed after loading. A proposal belonging to
  // another store is not found at all, so this endpoint cannot be used to write to a catalogue the
  // caller does not own even with a valid proposal id.
  const rows = await db
    .select()
    .from(aiFixProposals)
    .where(and(eq(aiFixProposals.storeId, storeId), inArray(aiFixProposals.id, proposalIds)));

  if (rows.length === 0) {
    throw new ApiError(404, 'No approved fixes were found to apply.', 'NO_PROPOSALS');
  }

  // Checked ONCE, before any write: the scopes the merchant actually consented to. A store
  // connected before write access existed carries read-only scopes, and every proposal is skipped
  // with a reason the UI can act on rather than twenty identical Shopify 403s.
  const { grantedScopes } = await getFixContext(storeId);

  const results: ApplyResult[] = [];
  let client: ShopifyClient | null = null;

  for (const row of rows) {
    const field = row.field as FixableField;
    const rule = FIELD_RULES[field];

    if (!rule) {
      results.push({ proposalId: row.id, status: 'skipped', detail: 'Unknown field.' });
      continue;
    }

    // CLICKING APPLY IS THE APPROVAL, so a row still sitting at `proposed` is accepted here and
    // recorded as approved by this user below. Requiring a separate approve call first would add a
    // round-trip without adding a decision — the merchant already made it.
    //
    // `applied` is refused because it is already done; `rejected` because someone said no. Both
    // would be a second write for no change.
    if (row.status !== 'approved' && row.status !== 'proposed' && row.status !== 'failed') {
      results.push({ proposalId: row.id, status: 'skipped', detail: `Cannot apply a ${row.status} fix.` });
      continue;
    }

    if (!grantedScopes.includes(rule.writeScope)) {
      results.push({
        proposalId: row.id,
        status: 'skipped',
        detail: 'Reconnect your Shopify store to grant Scorelo permission to save changes.',
      });
      continue;
    }

    if (!isFixableResourceType(row.resourceType)) {
      results.push({ proposalId: row.id, status: 'skipped', detail: 'Unsupported resource type.' });
      continue;
    }

    // The merchant's edit wins over the model's draft when one was sent — that is the whole point
    // of an editable preview. It gets no weaker check than the generated text: the same rule, the
    // same bounds, one line below.
    const intended = overrideById.get(row.id) ?? row.proposedValue;

    // RE-VALIDATED IMMEDIATELY BEFORE THE WRITE. The row passed these rules when it was created,
    // but a stored value is not evidence that it still passes today — bounds may have tightened
    // since, and a hand-edited value has never been checked at all. This is the last gate before a
    // live storefront.
    const check = validateProposedValue(rule, intended, row.currentValue);
    if (!check.ok) {
      await markFailed(row.id, check.detail);
      results.push({ proposalId: row.id, status: 'failed', detail: check.detail });
      continue;
    }

    // Resolved lazily and once: a run where every proposal is skipped should not decrypt a token.
    if (!client) {
      try {
        client = await resolveShopifyClient(storeId);
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Could not reach Shopify.';
        throw new ApiError(502, detail, 'SHOPIFY_UNAVAILABLE');
      }
    }

    const outcome = await writeField(client, row.resourceType, row.resourceId, field, check.value);

    if (outcome.ok) {
      // `proposedValue` is overwritten with what was ACTUALLY written, so the row is a record of
      // the change rather than of the suggestion that preceded it. Without this, a merchant who
      // edited the draft would later read the model's original wording as though it were live.
      await db
        .update(aiFixProposals)
        .set({
          status: 'applied',
          statusDetail: null,
          proposedValue: check.value,
          decidedAt: new Date(),
          decidedBy: userId,
        })
        .where(eq(aiFixProposals.id, row.id));
      results.push({ proposalId: row.id, status: 'applied' });
      // The resource and the field, never the value — a log is read by more people than the
      // database is, and a proposed value can quote merchant copy.
      console.log(`[scorelo-fix] applied ${field} to ${row.resourceType} (store ${storeId})`);
    } else {
      await markFailed(row.id, outcome.detail);
      results.push({ proposalId: row.id, status: 'failed', detail: outcome.detail });
      console.warn(`[scorelo-fix] failed ${field} on ${row.resourceType} (store ${storeId}): ${outcome.detail}`);
    }
  }

  return {
    applied: results.filter((result) => result.status === 'applied').length,
    failed: results.filter((result) => result.status === 'failed').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    results,
  };
}

/** Records why a write did not happen, so the UI can show a reason instead of a silent failure. */
async function markFailed(proposalId: number, detail: string): Promise<void> {
  await db
    .update(aiFixProposals)
    .set({ status: 'failed', statusDetail: detail.slice(0, 500) })
    .where(eq(aiFixProposals.id, proposalId));
}
