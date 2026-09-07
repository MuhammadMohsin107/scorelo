import type { AiRecommendation, FixPlanContext, RecommendationContext } from './provider.js';

/**
 * ─── Prompts and validation, shared by every provider ────────────────
 *
 * Moved out of openai.provider.ts when a second vendor arrived. What a model is TOLD and what it
 * is ALLOWED TO RETURN are properties of Scorelo, not of whoever serves the request: a
 * recommendation must read the same and be held to the same rules whether OpenAI or Gemini wrote
 * it. Leaving a copy in each provider would let the two drift into giving different advice for
 * the same finding, and only one of them would ever get fixed.
 *
 * Only TRANSPORT belongs in a provider file — the endpoint, the auth header, the response shape.
 */

/** Bounds the response, which bounds cost. Four short prose fields need far less than this. */
export const MAX_OUTPUT_TOKENS = 600;


export const SYSTEM_PROMPT = `You are Scorelo's e-commerce optimization assistant. Scorelo audits Shopify stores across SEO, Content, Speed, CRO and AI Discovery, and has ALREADY detected the issue described in the user message and ALREADY produced a deterministic recommendation.

Your only job is to rewrite that recommendation so a busy merchant can act on it. You are an editor, not an investigator.

Rules you must not break:
- Use ONLY the audit context supplied. It is the complete set of facts available to you.
- Never invent numbers, percentages, rankings, traffic, revenue, conversion rates, Core Web Vitals, or any measurement that is not in the context.
- Never claim to have inspected the store, called an API, run a test, or read anything yourself.
- Never state or imply that any change has been made. Nothing has been applied; you are advising.
- Never reference Google Search Console, Google Analytics, Merchant Center, or any tool Scorelo did not supply data from.
- Do not contradict the deterministic recommendation. Clarify, sharpen and make it concrete.
- If the context is too thin to say something specific, say plainly that more data is needed rather than guessing.
- Plain prose only. No HTML, no markdown, no code, no links, no scripts.
- Be concise: each field is 1-3 sentences.

confidence reflects how well the supplied context supports a specific recommendation: "high" when the context is precise and the action is unambiguous, "low" when you had to stay generic.`;

/** Strips anything that could be rendered as markup, then bounds length. Defence in depth: the
 * prompt forbids markup, but the model is not a trust boundary. */
export function sanitize(value: unknown, max = 1200): string {
  if (typeof value !== 'string') return '';
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function validateRecommendation(parsed: unknown): AiRecommendation | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const raw = parsed as Record<string, unknown>;
  const recommendation = sanitize(raw.recommendation);
  const whyItMatters = sanitize(raw.whyItMatters);
  const suggestedAction = sanitize(raw.suggestedAction);
  const confidence = raw.confidence;
  if (!recommendation || !whyItMatters || !suggestedAction) return null;
  if (confidence !== 'high' && confidence !== 'medium' && confidence !== 'low') return null;
  return { recommendation, whyItMatters, suggestedAction, confidence };
}

export function buildUserMessage(context: RecommendationContext): string {
  // Compact, labelled context. Evidence is capped so an unusual check cannot inflate the prompt.
  return [
    `Pillar: ${context.pillar} / ${context.subPillar}`,
    `Finding: ${context.findingTitle}`,
    `Severity: ${context.severity} (impact ${context.impact})`,
    `Affected: ${context.affectedCount} ${context.affectedLabel}`,
    context.storeName ? `Store: ${context.storeName}` : '',
    context.problem ? `What the audit observed: ${context.problem}` : '',
    `Why the audit flags it: ${context.why}`,
    `Deterministic recommendation to improve: ${context.deterministicRecommendation}`,
    context.evidence.length ? `Evidence recorded by the check:\n- ${context.evidence.slice(0, 6).join('\n- ')}` : '',
  ].filter(Boolean).join('\n');
}

/** Fix planning returns one object per resource, so its budget scales with the batch. Held well
 * below what a full batch needs so a runaway completion is cut off rather than billed. */
export const MAX_FIX_OUTPUT_TOKENS = 2_000;

/** Body copy handed to the model per resource. Enough to write a description from, small enough
 * that a batch of long product pages cannot inflate the prompt without bound. */
export const SOURCE_TEXT_LIMIT = 600;

export const FIX_SYSTEM_PROMPT = `You are Scorelo's e-commerce optimization assistant. Scorelo has ALREADY audited a Shopify store, found a specific problem, and identified the exact resources affected.

Your only job is to write a replacement value for ONE named field on each resource you are given. You are a copywriter working from supplied facts, not an investigator.

Rules you must not break:
- Return exactly one proposal per resource, echoing its ref back unchanged. Never invent a ref.
- Build every value from the resource's OWN supplied title and text. Do not introduce facts, numbers, prices, discounts, claims, dates or superlatives that are not in the context.
- Respect the stated character range exactly. A value outside it is rejected.
- Plain text on a single line. No HTML, no markdown, no quotes around the value, no emoji, no line breaks.
- Never use placeholder wording such as "Lorem ipsum", "Your brand here", "TBD" or bracketed slots.
- The value must be meaningfully different from the current value, and must still describe the same resource.
- "reason" is one short sentence saying what you changed and why, for a merchant to read while approving.

If a resource genuinely has too little information to write a defensible value, still return a proposal built only from its title — never pad it with invented detail.`;

export function buildFixMessage(context: FixPlanContext): string {
  const header = [
    `Finding: ${context.findingTitle}`,
    context.problem ? `What the audit observed: ${context.problem}` : '',
    context.storeName ? `Store: ${context.storeName}` : '',
    `Field to rewrite: ${context.fieldLabel} (${context.field})`,
    `Required length: ${context.minLength}-${context.maxLength} characters`,
    `What a good value looks like: ${context.guidance}`,
    '',
    `Rewrite the ${context.fieldLabel} for each of the following ${context.targets.length} resources:`,
  ].filter(Boolean).join('\n');

  const targets = context.targets.map((target, index) => [
    `${index + 1}. ref: ${target.ref}`,
    `   type: ${target.resourceType}`,
    `   name: ${target.title}`,
    `   current ${context.fieldLabel}: ${target.currentValue || '(empty)'}`,
    target.deterministicSuggestion ? `   Scorelo's own suggestion (improve on this): ${target.deterministicSuggestion}` : '',
    target.sourceText ? `   its own copy to draw from: ${target.sourceText}` : '',
  ].filter(Boolean).join('\n')).join('\n\n');

  return `${header}\n\n${targets}`;
}

/** Parses the proposals array. Shape only — the VALUES are judged by fix-policy.ts, which is the
 * single place that decides whether a proposal is acceptable. */
export function validateProposals(parsed: unknown): Array<{ ref: string; proposedValue: string; reason: string }> | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const raw = (parsed as { proposals?: unknown }).proposals;
  if (!Array.isArray(raw)) return null;

  const proposals: Array<{ ref: string; proposedValue: string; reason: string }> = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const ref = typeof record.ref === 'string' ? record.ref.trim() : '';
    const proposedValue = typeof record.proposedValue === 'string' ? record.proposedValue : '';
    if (!ref || !proposedValue) continue;
    proposals.push({ ref, proposedValue, reason: sanitize(record.reason, 300) });
  }
  return proposals;
}

/** Parses a completion body. Returns null rather than throwing: an unparseable answer is an
 * expected outcome for a generated value, not an exception. */
export function parseJson(content: string): unknown | null {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}
