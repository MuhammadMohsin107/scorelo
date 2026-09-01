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

export type FixableField = 'seo.title' | 'seo.description';

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
  },
  'seo.description': {
    field: 'seo.description',
    subPillar: 'meta-descriptions',
    label: 'SEO meta description',
    minLength: 70,
    maxLength: 160,
    resourceTypes: FIXABLE_RESOURCE_TYPES,
    guidance: 'A search-result description of 70-160 characters that summarises this specific page in plain sentences.',
  },
};

/** Which field, if any, a finding's sub-pillar can be fixed through. */
export function fieldForSubPillar(subPillar: string): FieldRule | null {
  return Object.values(FIELD_RULES).find((rule) => rule.subPillar === subPillar) ?? null;
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
