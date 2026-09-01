import { env } from '../../config/env.js';
import type {
  AiFixResult,
  AiFailureReason,
  AiProvider,
  AiRecommendation,
  AiResult,
  FixPlanContext,
  RecommendationContext,
} from './provider.js';

/**
 * ─── OpenAI provider ─────────────────────────────────────────────────
 * Hand-rolled over fetch, matching how ShopifyClient talks to Shopify — no SDK dependency, and
 * full control over the timeout, which matters because this call sits in a request path.
 *
 * SECURITY: the key is read from the server environment at call time and travels only in the
 * Authorization header. It is never logged, never returned, never placed in an error message,
 * and never reaches the browser (the frontend calls Scorelo, Scorelo calls OpenAI).
 *
 * STRUCTURED OUTPUT: `json_schema` with `strict: true` makes the model return exactly the four
 * fields, so parsing cannot drift. The response is still validated after parsing — a provider
 * promising a shape is not the same as receiving it.
 */

/** Hard ceiling on a single call. Audits and Fix Center both run in a request, so a hung model
 * call must never hold a connection open. */
const TIMEOUT_MS = 20_000;

/** Bounds the response, which bounds cost. Four short prose fields need far less than this. */
const MAX_OUTPUT_TOKENS = 600;

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

const SYSTEM_PROMPT = `You are Scorelo's e-commerce optimization assistant. Scorelo audits Shopify stores across SEO, Content, Speed, CRO and AI Discovery, and has ALREADY detected the issue described in the user message and ALREADY produced a deterministic recommendation.

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

const RESPONSE_SCHEMA = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'scorelo_recommendation',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['recommendation', 'whyItMatters', 'suggestedAction', 'confidence'],
      properties: {
        recommendation: { type: 'string', description: 'The improved recommendation, 1-3 sentences.' },
        whyItMatters: { type: 'string', description: 'The business consequence, 1-2 sentences.' },
        suggestedAction: { type: 'string', description: 'One concrete next step the merchant can take.' },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
    },
  },
};

/** Strips anything that could be rendered as markup, then bounds length. Defence in depth: the
 * prompt forbids markup, but the model is not a trust boundary. */
function sanitize(value: unknown, max = 1200): string {
  if (typeof value !== 'string') return '';
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function validate(parsed: unknown): AiRecommendation | null {
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

/** Maps an HTTP status to the caller-facing reason. All of them end in the same place —
 * deterministic fallback — but the distinction matters in logs and for quota alerting. */
function reasonFor(status: number): AiFailureReason {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  if (status === 402) return 'quota';
  return 'server';
}

function buildUserMessage(context: RecommendationContext): string {
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

// ─── Fix planning ────────────────────────────────────────────────────

/** Fix planning returns one object per resource, so its budget scales with the batch. Held well
 * below what a full batch needs so a runaway completion is cut off rather than billed. */
const MAX_FIX_OUTPUT_TOKENS = 2_000;

/** Body copy handed to the model per resource. Enough to write a description from, small enough
 * that a batch of long product pages cannot inflate the prompt without bound. */
const SOURCE_TEXT_LIMIT = 600;

const FIX_SYSTEM_PROMPT = `You are Scorelo's e-commerce optimization assistant. Scorelo has ALREADY audited a Shopify store, found a specific problem, and identified the exact resources affected.

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

const FIX_RESPONSE_SCHEMA = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'scorelo_fix_proposals',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['proposals'],
      properties: {
        proposals: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['ref', 'proposedValue', 'reason'],
            properties: {
              ref: { type: 'string', description: 'The resource ref, echoed back exactly.' },
              proposedValue: { type: 'string', description: 'The replacement value, plain text, within the stated character range.' },
              reason: { type: 'string', description: 'One short sentence explaining the change.' },
            },
          },
        },
      },
    },
  },
};

function buildFixMessage(context: FixPlanContext): string {
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
function validateProposals(parsed: unknown): Array<{ ref: string; proposedValue: string; reason: string }> | null {
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

/**
 * The single HTTP path to OpenAI. Both capabilities go through it so the timeout, the abort
 * signal, the "never keep an upstream error body" rule and the failure classification exist once
 * — a second copy is a second place for the key handling to be got wrong.
 */
async function chatCompletion(
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  responseFormat: unknown,
  maxTokens: number,
): Promise<{ ok: true; content: string } | { ok: false; reason: AiFailureReason; detail: string }> {
  const apiKey = env.openaiApiKey;
  if (!apiKey) return { ok: false, reason: 'disabled', detail: 'no API key configured' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: env.openaiModel,
        max_completion_tokens: maxTokens,
        // Low but non-zero: consistent phrasing across runs without being robotic.
        temperature: 0.3,
        response_format: responseFormat,
        messages,
      }),
    });

    if (!response.ok) {
      // The body may echo request details; only the status is kept, never the response text,
      // so nothing from an upstream error can leak into logs or to a customer.
      return { ok: false, reason: reasonFor(response.status), detail: `HTTP ${response.status}` };
    }

    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return { ok: false, reason: 'invalid_response', detail: 'empty completion' };
    return { ok: true, content };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return {
      ok: false,
      reason: aborted ? 'timeout' : 'network',
      detail: aborted ? `timed out after ${TIMEOUT_MS}ms` : 'request failed',
    };
  } finally {
    clearTimeout(timer);
  }
}

function parseJson(content: string): unknown | null {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export const openAiProvider: AiProvider = {
  name: 'openai',

  async enhance(context: RecommendationContext): Promise<AiResult> {
    const response = await chatCompletion(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserMessage(context) },
      ],
      RESPONSE_SCHEMA,
      MAX_OUTPUT_TOKENS,
    );
    if (!response.ok) return response;

    const parsed = parseJson(response.content);
    if (parsed === null) return { ok: false, reason: 'invalid_response', detail: 'completion was not valid JSON' };

    const recommendation = validate(parsed);
    if (!recommendation) return { ok: false, reason: 'invalid_response', detail: 'completion failed validation' };

    return { ok: true, recommendation, model: env.openaiModel };
  },

  async planFix(context: FixPlanContext): Promise<AiFixResult> {
    if (context.targets.length === 0) {
      return { ok: false, reason: 'invalid_response', detail: 'no targets supplied' };
    }

    const response = await chatCompletion(
      [
        { role: 'system', content: FIX_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildFixMessage({
            ...context,
            targets: context.targets.map((target) => ({ ...target, sourceText: target.sourceText.slice(0, SOURCE_TEXT_LIMIT) })),
          }),
        },
      ],
      FIX_RESPONSE_SCHEMA,
      MAX_FIX_OUTPUT_TOKENS,
    );
    if (!response.ok) return response;

    const parsed = parseJson(response.content);
    if (parsed === null) return { ok: false, reason: 'invalid_response', detail: 'completion was not valid JSON' };

    const proposals = validateProposals(parsed);
    if (!proposals) return { ok: false, reason: 'invalid_response', detail: 'completion did not contain a proposals array' };
    if (proposals.length === 0) return { ok: false, reason: 'invalid_response', detail: 'completion contained no usable proposals' };

    return { ok: true, proposals, model: env.openaiModel };
  },
};
