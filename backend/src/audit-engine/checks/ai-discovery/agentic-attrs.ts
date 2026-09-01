import type { AuditCheck, SubPillarEvidenceRow, SubPillarFindingResult, SubPillarResult } from '../../types.js';
import { unavailableResult } from '../../types.js';
import { scoreSubPillar } from '../../scoring.js';
import type { SnapshotProduct, StoreSnapshot } from '../../store-data/types.js';
import { wordCount } from '../shared/html.js';
import { formatCount, takeEvidenceSample } from '../seo/page-inventory.js';
import { CRITICAL, HEALTHY, NEEDS_WORK, coveragePct, isDefaultOption, type RowStatus } from '../shared/status.js';

/**
 * ─── AI Discovery · Agentic commerce attributes ──────────────────────
 * Measures whether a product exposes the signals an AI agent needs to COMPLETE A PURCHASE on a
 * shopper's behalf, rather than merely find it.
 *
 * HOW THIS DIFFERS FROM THE FEED CHECK, WHICH READS THE SAME VARIANTS
 * `feed` asks whether the product can be exported and matched — identifiers, price, brand,
 * category. This asks the next question: once an agent has found it, can the agent act? Those
 * come apart in practice. A product with a perfect GTIN and price whose every variant is out of
 * stock is flawless in a feed and useless to an agent asked to buy it. A product whose variants
 * are distinguishable only by an unnamed placeholder is exportable but not selectable, because
 * the agent has no attribute on which to choose the right one.
 *
 * WHAT IS MEASURED, IN ORDER OF WHAT BLOCKS AN AGENT FIRST
 *   nothing purchasable   Every variant availableForSale=false. The agent cannot transact.
 *   unselectable variants Several variants, no named option to choose between them.
 *   no description        Nothing to answer "is this waterproof?" with, so the agent cannot
 *                         qualify the product against what the shopper actually asked for.
 *   no structured attrs   No vendor, product type, tags or metafields — nothing to reason over
 *                         beyond the title.
 *
 * SCOPE, STATED HONESTLY
 * This reads what `read_products` returns. Whether the storefront serves structured data
 * (Product JSON-LD with offers and availability) is what an agent hitting the page would parse,
 * and that needs the rendered HTML the storefront crawl would provide. Scorelo does not run that
 * crawl yet, so this check measures the attributes BEHIND the page and says so — it does not
 * claim to have inspected the markup.
 */

/** Below this a description is a fragment, not something an agent can answer questions from. */
const MIN_DESCRIPTION_WORDS = 20;

interface Assessment {
  status: RowStatus;
  issue: string;
  detail: string;
  recommendation: string;
}

function structuredAttributeCount(product: SnapshotProduct): number {
  let count = 0;
  if (product.vendor.trim()) count += 1;
  if (product.productType.trim()) count += 1;
  if (product.tags.length > 0) count += 1;
  if (product.metafields.some((metafield) => metafield.hasValue)) count += 1;
  return count;
}

function assess(product: SnapshotProduct): Assessment {
  const variants = product.variants;
  const realOptions = product.options.filter((option) => !isDefaultOption(option));
  const words = wordCount(product.bodyHtml);

  if (variants.length > 0 && variants.every((variant) => !variant.availableForSale)) {
    return {
      status: CRITICAL,
      issue: 'Nothing purchasable',
      detail: `All ${formatCount(variants.length)} variants are unavailable for sale`,
      recommendation: 'Restock, or unpublish the product — an agent asked to buy this cannot complete the order.',
    };
  }

  if (product.variantCount > 1 && realOptions.length === 0) {
    return {
      status: CRITICAL,
      issue: 'Variants an agent cannot choose between',
      detail: `${formatCount(product.variantCount)} variants with no named option`,
      recommendation: 'Add a real option (Size, Colour) so an agent has an attribute to select on.',
    };
  }

  if (words === 0) {
    return {
      status: NEEDS_WORK,
      issue: 'No description',
      detail: 'Product description is empty',
      recommendation: 'Write a description covering what the product is, what it is made of and who it is for.',
    };
  }

  if (words < MIN_DESCRIPTION_WORDS) {
    return {
      status: NEEDS_WORK,
      issue: 'Description too short to answer questions',
      detail: `${words} words`,
      recommendation: `Expand past ${MIN_DESCRIPTION_WORDS} words with the attributes shoppers ask about — materials, fit, compatibility, care.`,
    };
  }

  const attributes = structuredAttributeCount(product);
  if (attributes < 2) {
    return {
      status: NEEDS_WORK,
      issue: 'Almost no structured attributes',
      detail: `${attributes} of 4 attribute groups populated (brand, category, tags, metafields)`,
      recommendation: 'Fill in vendor, product type and tags so an agent can reason about this product beyond its title.',
    };
  }

  return {
    status: HEALTHY,
    issue: '',
    detail: `${formatCount(variants.filter((variant) => variant.availableForSale).length)} purchasable variants · ${attributes} of 4 attribute groups · ${words}-word description`,
    recommendation: '—',
  };
}

export const agenticAttrsCheck: AuditCheck = {
  id: 'ai-discovery.agentic-attrs',
  pillar: 'ai-discovery',
  subPillar: 'agentic-attrs',

  execute(snapshot: StoreSnapshot): SubPillarResult {
    if (!snapshot.coverage.products) {
      return unavailableResult('agentic-attrs', 'Scorelo could not read products from this store, so agent-readable attributes could not be checked.');
    }

    const products = snapshot.products;
    if (products.length === 0) {
      return unavailableResult('agentic-attrs', 'This store has no products, so there are no agent-readable attributes to assess.');
    }

    const rows: SubPillarEvidenceRow[] = [];
    const byIssue = new Map<string, SnapshotProduct[]>();
    let healthy = 0;

    for (const product of products) {
      const assessment = assess(product);
      if (assessment.status === HEALTHY) healthy += 1;
      else {
        const bucket = byIssue.get(assessment.issue) ?? [];
        bucket.push(product);
        byIssue.set(assessment.issue, bucket);
      }

      rows.push({
        id: `product:${product.id}`,
        status: assessment.status,
        facet: assessment.status,
        cells: {
          signal: product.title,
          detail: assessment.issue || 'Agent-readable',
          coverage: assessment.status === HEALTHY ? 100 : 0,
          status: assessment.status,
          recommendation: assessment.recommendation,
        },
        current: { label: 'Detected', value: assessment.detail, meta: product.url },
        suggested: { label: 'Recommendation', value: assessment.recommendation },
      });
    }

    const analyzed = products.length;
    const findings: SubPillarFindingResult[] = [];
    const lift = (count: number) => Math.round((count / analyzed) * 100);
    const bucket = (issue: string) => byIssue.get(issue) ?? [];

    const unpurchasable = bucket('Nothing purchasable');
    if (unpurchasable.length > 0) {
      findings.push({
        title: 'Products with no purchasable variant',
        severity: 'critical',
        affectedCount: unpurchasable.length,
        affectedLabel: 'products',
        impact: 'High',
        scoreLift: lift(unpurchasable.length),
        resolutionType: 'catalog',
        problem: `${formatCount(unpurchasable.length)} published products have every variant marked unavailable for sale.`,
        why: 'An AI shopping agent that surfaces one of these and is told to buy it hits a dead end at the last step. That failure is attributed to your store, and these products are still being crawled, indexed and recommended while none of them can be bought.',
        recommendation: 'Restock these products or unpublish them. A product that cannot be bought should not be discoverable as though it can.',
        evidence: [
          `${formatCount(unpurchasable.length)} of ${formatCount(analyzed)} products have no purchasable variant.`,
          ...unpurchasable.slice(0, 5).map((product) => `${product.title}: all ${formatCount(product.variants.length)} variants unavailable.`),
        ],
        evidenceRows: rows.filter((row) => row.cells.detail === 'Nothing purchasable').slice(0, 20),
        details: { issueType: CRITICAL, effort: 'Medium' },
      });
    }

    const unselectable = bucket('Variants an agent cannot choose between');
    if (unselectable.length > 0) {
      findings.push({
        title: 'Products whose variants have no attribute to select on',
        severity: 'high',
        affectedCount: unselectable.length,
        affectedLabel: 'products',
        impact: 'High',
        scoreLift: lift(unselectable.length),
        resolutionType: 'catalog',
        problem: `${formatCount(unselectable.length)} products have several variants but no option the merchant named.`,
        why: 'To buy the right variant an agent needs a named attribute to match the request against — "size large", "in black". With only an unnamed placeholder there is nothing to match, so the agent either guesses or gives up.',
        recommendation: 'Add a real option to each of these products so both shoppers and agents can identify which variant is which.',
        evidence: unselectable.slice(0, 5).map((product) => `${product.title}: ${formatCount(product.variantCount)} variants, no named option.`),
        evidenceRows: rows.filter((row) => row.cells.detail === 'Variants an agent cannot choose between').slice(0, 20),
        details: { issueType: CRITICAL, effort: 'Medium' },
      });
    }

    const thinDescription = [...bucket('No description'), ...bucket('Description too short to answer questions')];
    if (thinDescription.length > 0) {
      findings.push({
        title: 'Products with too little description for an agent to qualify',
        severity: 'medium',
        affectedCount: thinDescription.length,
        affectedLabel: 'products',
        impact: 'Medium',
        scoreLift: lift(thinDescription.length),
        resolutionType: 'content',
        problem: `${formatCount(thinDescription.length)} products have an empty description or fewer than ${MIN_DESCRIPTION_WORDS} words.`,
        why: 'Agents answer qualifying questions — is it waterproof, does it fit a 15-inch laptop, is it machine washable — from the description. With nothing to read, the product is dropped from any request more specific than its own title.',
        recommendation: `Write at least ${MIN_DESCRIPTION_WORDS} words per product covering materials, dimensions, compatibility and care.`,
        evidence: [
          `${formatCount(thinDescription.length)} of ${formatCount(analyzed)} products fall below ${MIN_DESCRIPTION_WORDS} words.`,
          ...thinDescription.slice(0, 5).map((product) => `${product.title}: ${wordCount(product.bodyHtml)} words.`),
        ],
        details: { issueType: NEEDS_WORK, effort: 'High' },
      });
    }

    const unstructured = bucket('Almost no structured attributes');
    if (unstructured.length > 0) {
      findings.push({
        title: 'Products with almost no structured attributes',
        severity: 'medium',
        affectedCount: unstructured.length,
        affectedLabel: 'products',
        impact: 'Medium',
        scoreLift: lift(unstructured.length),
        resolutionType: 'catalog',
        problem: `${formatCount(unstructured.length)} products populate fewer than two of the four attribute groups (brand, category, tags, metafields).`,
        why: 'Prose has to be interpreted; structured attributes can be filtered on directly. A product with neither brand nor category can only be retrieved by someone who already knows its name — which is the opposite of discovery.',
        recommendation: 'Set vendor and product type at minimum, then add tags and product metafields for the attributes shoppers filter by.',
        evidence: unstructured.slice(0, 5).map((product) => `${product.title}: ${structuredAttributeCount(product)} of 4 attribute groups populated.`),
        details: { issueType: NEEDS_WORK, effort: 'Medium' },
      });
    }

    const purchasable = products.filter((product) => product.variants.some((variant) => variant.availableForSale)).length;

    return {
      subPillar: 'agentic-attrs',
      status: 'ok',
      score: scoreSubPillar(analyzed, healthy, findings),
      analyzedCount: analyzed,
      healthyCount: healthy,
      details: {
        status: 'ok',
        summary: `${formatCount(healthy)} of ${formatCount(analyzed)} products expose what an AI agent needs to act — something in stock, variants it can tell apart, and enough description and structured attributes to qualify the product. This reads the catalogue behind the page; whether your theme also emits Product JSON-LD needs the storefront crawl, which Scorelo does not run yet.`,
        healthChip: `${((healthy / analyzed) * 100).toFixed(1)}% healthy`,
        contextLabel: 'Products with stock',
        contextValue: `${coveragePct(purchasable, analyzed)}%`,
        evidenceRows: takeEvidenceSample(rows, HEALTHY),
      },
      findings,
    };
  },
};
