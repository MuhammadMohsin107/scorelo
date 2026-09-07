/**
 * ─── Fixable-field policy ────────────────────────────────────────────
 * The allow-list of fields an AI proposal is ever permitted to target, and the rules a proposed
 * value must satisfy.
 *
 * This module is the security boundary of the AI fix flow. The model never touches Shopify or the
 * database — it returns a suggestion, and NOTHING here trusts it. A proposal is accepted only if
 * it names a field on this list, for a resource the audit itself recorded, with a value that
 * passes the same constraints the deterministic check applies. Anything else is rejected with a
 * reason, and the deterministic recommendation stands unchanged.
 *
 * WHY AN ALLOW-LIST RATHER THAN A DENY-LIST
 * A deny-list is only as good as our imagination of what could go wrong. An allow-list means a
 * field that nobody has explicitly reasoned about is unreachable by construction — adding one is
 * a deliberate act with a validator attached, not an oversight.
 *
 * The list is deliberately small. `seo.title` and `seo.description` are metadata: bounded,
 * single-line, independently verifiable, and reversible. Body copy (`descriptionHtml`) is
 * excluded on purpose — it is unbounded HTML where a bad rewrite destroys merchant-authored
 * content, and the deterministic engine has no suggestion for it to be measured against.
 */

/** The resource kinds the audit's evidence rows identify, as `type:id` (see page-inventory.ts). */
export const FIXABLE_RESOURCE_TYPES = ['product', 'collection', 'page', 'article'] as const;
export type FixableResourceType = (typeof FIXABLE_RESOURCE_TYPES)[number];

export type FixableField = 'seo.title' | 'seo.description' | 'image.alt';

/**
 * Which engine produces the value for a field.
 *
 * 'template' means a deterministic generator can do it on its own (image alt text is built from
 * the merchant's own template plus the product's own fields, so a model adds cost and variance
 * without adding correctness). 'ai' means the value needs judgement no rule can encode.
 *
 * This is a property of the FIELD, not a runtime choice: it decides whether a fix can be offered
 * at all when no model is configured.
 */
export type FixGenerator = 'ai' | 'template';

export interface FieldRule {
  field: FixableField;
  /** Sub-pillar whose findings this field resolves. A proposal for any other is rejected. */
  subPillar: string;
  label: string;
  minLength: number;
  maxLength: number;
  resourceTypes: readonly FixableResourceType[];
  /** What the model is told to produce. Kept beside the bounds so they cannot drift apart. */
  guidance: string;
  generator: FixGenerator;
  /**
   * The Shopify access scope required to WRITE this field.
   *
   * Recorded per field rather than assumed globally: a connection authorized before write access
   * existed carries only read scopes, and offering it an Apply button would produce a 403 the
   * merchant cannot act on. The stored `shopify_connections.scope` string is the truth.
   */
  writeScope: string;
}

/**
 * Bounds are the SAME numbers the checks score against — title-tags.ts (30-60) and
 * meta-descriptions.ts (70-160). A proposal that passes here is a proposal that would move the
 * finding to healthy; one that does not would be applied only to fail the next audit.
 */
export const FIELD_RULES: Record<FixableField, FieldRule> = {
  'seo.title': {
    field: 'seo.title',
    subPillar: 'title-tags',
    label: 'SEO title',
    minLength: 30,
    maxLength: 60,
    resourceTypes: FIXABLE_RESOURCE_TYPES,
    guidance: 'A search-result title of 30-60 characters built from the resource\'s own words. Lead with the specific product or page name.',
    generator: 'ai',
    writeScope: 'write_products',
  },
  'seo.description': {
    field: 'seo.description',
    subPillar: 'meta-descriptions',
    label: 'SEO meta description',
    minLength: 70,
    maxLength: 160,
    resourceTypes: FIXABLE_RESOURCE_TYPES,
    guidance: 'A search-result description of 70-160 characters that summarises this specific page in plain sentences.',
    generator: 'ai',
    writeScope: 'write_products',
  },
  /**
   * Image alt text. 512 is Shopify's own limit on the field; 1 is the floor because a single
   * meaningful word beats nothing, and the merchant's template decides the real target length.
   *
   * Products only: collections carry no image in the Admin API, and an article's image is written
   * through a different mutation than a product's media, so it is not covered by this one rule.
   */
  'image.alt': {
    field: 'image.alt',
    subPillar: 'image-alt-text',
    label: 'Image alt text',
    minLength: 1,
    maxLength: 512,
    resourceTypes: ['product'],
    guidance: 'A short description of what the image actually shows, built from the product\'s own name and attributes.',
    generator: 'template',
    writeScope: 'write_products',
  },
};

/** Which field, if any, a finding's sub-pillar can be fixed through. */
export function fieldForSubPillar(subPillar: string): FieldRule | null {
  return Object.values(FIELD_RULES).find((rule) => rule.subPillar === subPillar) ?? null;
}

// ─── Fixability ──────────────────────────────────────────────────────
/**
 * How a finding can be resolved, answered from what Scorelo can PROVE rather than from what a
 * model believes.
 *
 * This is deliberately NOT an AI judgement. "Can this be written to the merchant's store?" is the
 * security boundary of the whole fix flow: it depends on the allow-list above, on the scopes the
 * merchant actually granted, and on whether a generator exists — three facts, all checkable. A
 * model asked the same question would sometimes say yes about a field nothing can write, and the
 * cost of that answer lands on a live storefront.
 *
 * AI's place is one step further in: once this says a field IS writable, a model proposes the
 * VALUE, and a human approves it.
 *
 *   auto      Scorelo can generate and write it without a model.
 *   ai        A model must draft the value; a human still approves it.
 *   needs_access  Writable in principle, but this connection lacks the scope — reconnect.
 *   manual    Nothing Scorelo can write. Theme edits, app settings, store configuration.
 */
export type Fixability = 'auto' | 'ai' | 'needs_access' | 'manual';

export interface FixabilityVerdict {
  fixability: Fixability;
  field: FixableField | null;
  /** Merchant-facing sentence. Never a raw code, never a promise Scorelo cannot keep. */
  reason: string;
  /** The scope to ask for when `needs_access`. */
  requiredScope: string | null;
}

/**
 * `resolutionType` is written by the check itself (content / catalog / theme / media / settings /
 * integration / apps), so it already records what KIND of work a finding needs. Anything outside
 * the Admin API's reach can be stated as manual without guessing.
 */
const UNWRITABLE_RESOLUTION_TYPES = new Set(['theme', 'apps', 'settings', 'integration']);

export function classifyFixability(input: {
  subPillar: string;
  resolutionType: string | null;
  /** Scopes on the store's live Shopify connection, as granted. */
  grantedScopes: readonly string[];
  /** Whether a model is configured and reachable. */
  aiAvailable: boolean;
}): FixabilityVerdict {
  const rule = fieldForSubPillar(input.subPillar);

  if (!rule) {
    const kind = input.resolutionType && UNWRITABLE_RESOLUTION_TYPES.has(input.resolutionType)
      ? `This is a ${input.resolutionType} change`
      : 'Scorelo has no writable field for this check yet';
    return {
      fixability: 'manual',
      field: null,
      reason: `${kind}, so it has to be made in Shopify. Scorelo shows what to change and where.`,
      requiredScope: null,
    };
  }

  if (!input.grantedScopes.includes(rule.writeScope)) {
    return {
      fixability: 'needs_access',
      field: rule.field,
      reason: `Scorelo can write this ${rule.label.toLowerCase()} once you reconnect your store and grant write access.`,
      requiredScope: rule.writeScope,
    };
  }

  if (rule.generator === 'template') {
    return {
      fixability: 'auto',
      field: rule.field,
      reason: `Scorelo can generate this ${rule.label.toLowerCase()} from your own template and apply it after you review it.`,
      requiredScope: null,
    };
  }

  if (!input.aiAvailable) {
    return {
      fixability: 'manual',
      field: rule.field,
      reason: `This ${rule.label.toLowerCase()} needs a written value, and no AI model is configured to draft one.`,
      requiredScope: null,
    };
  }

  return {
    fixability: 'ai',
    field: rule.field,
    reason: `Scorelo can draft this ${rule.label.toLowerCase()} for you to review, then apply the ones you approve.`,
    requiredScope: null,
  };
}

export function isFixableResourceType(value: string): value is FixableResourceType {
  return (FIXABLE_RESOURCE_TYPES as readonly string[]).includes(value);
}

/** Parses an evidence-row id of the form `product:123`. Returns null for anything else. */
export function parseResourceRef(raw: unknown): { resourceType: FixableResourceType; resourceId: string } | null {
  if (typeof raw !== 'string') return null;
  const separator = raw.indexOf(':');
  if (separator <= 0) return null;
  const resourceType = raw.slice(0, separator);
  const resourceId = raw.slice(separator + 1).trim();
  if (!isFixableResourceType(resourceType) || !resourceId) return null;
  return { resourceType, resourceId };
}

export type ValueRejection =
  | 'not_a_string'
  | 'empty'
  | 'too_short'
  | 'too_long'
  | 'contains_markup'
  | 'multiline'
  | 'unchanged'
  | 'placeholder';

export type ValueCheck = { ok: true; value: string } | { ok: false; reason: ValueRejection; detail: string };

/**
 * Wording a model reaches for when it has nothing real to say. Applying one would put a visible
 * placeholder on a live storefront, so it is rejected outright rather than shown for approval.
 *
 * The bracket and brace forms are their own alternatives rather than sharing the leading `\b`:
 * `[` and `{` are not word characters, so a leading word-boundary assertion never matches them
 * after a space — which silently let `Shirt [PRODUCT NAME]` through.
 *
 * The `x{3,8}` run is bounded at both ends so it matches a standalone `XXX` marker and not a
 * legitimate value that happens to contain a longer run of the letter.
 */
const PLACEHOLDER = /\b(lorem ipsum|tbd|insert your|your (product|brand|store) (name|here))\b|\bx{3,8}\b|\[[^\]]{2,}\]|\{\{[^}]*\}\}/i;

/**
 * Validates one proposed value against its field's rule.
 *
 * `current` is required, not optional: a proposal identical to what is already stored is not a
 * fix, and letting one through would mean an approval that changes nothing while reporting
 * success.
 */
export function validateProposedValue(rule: FieldRule, proposed: unknown, current: string): ValueCheck {
  if (typeof proposed !== 'string') return { ok: false, reason: 'not_a_string', detail: `${rule.label} must be text` };

  const value = proposed.replace(/\s+/g, ' ').trim();
  if (!value) return { ok: false, reason: 'empty', detail: `${rule.label} was empty` };

  // Checked against the RAW string: collapsing whitespace first would hide a value the model
  // formatted as several lines, which no meta tag can carry.
  if (/[\r\n]/.test(proposed)) return { ok: false, reason: 'multiline', detail: `${rule.label} must be a single line` };
  if (/<[^>]+>|&[a-z]+;|&#\d+;/i.test(value)) return { ok: false, reason: 'contains_markup', detail: `${rule.label} must be plain text, not markup` };
  // Length is checked before wording: it is the objective, measurable defect, and reporting a
  // 200-character value as "placeholder wording" would send the merchant after the wrong problem.
  if (value.length < rule.minLength) return { ok: false, reason: 'too_short', detail: `${rule.label} is ${value.length} characters, below the ${rule.minLength} minimum` };
  if (value.length > rule.maxLength) return { ok: false, reason: 'too_long', detail: `${rule.label} is ${value.length} characters, over the ${rule.maxLength} limit` };
  if (PLACEHOLDER.test(value)) return { ok: false, reason: 'placeholder', detail: `${rule.label} contained placeholder wording` };
  if (value === current.replace(/\s+/g, ' ').trim()) return { ok: false, reason: 'unchanged', detail: `${rule.label} is identical to the current value` };

  return { ok: true, value };
}
