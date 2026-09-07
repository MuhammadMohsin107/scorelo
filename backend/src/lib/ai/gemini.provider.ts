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
import {
  FIX_SYSTEM_PROMPT,
  MAX_FIX_OUTPUT_TOKENS,
  MAX_OUTPUT_TOKENS,
  SOURCE_TEXT_LIMIT,
  SYSTEM_PROMPT,
  buildFixMessage,
  buildUserMessage,
  parseJson,
  validateProposals,
  validateRecommendation,
} from './prompt.js';

/**
 * ─── Google Gemini provider ──────────────────────────────────────────
 * The second implementation of AiProvider, added exactly as provider.ts anticipated: one file
 * beside openai.provider.ts, with no change to the audit engine, the services or the API.
 *
 * WHAT IS SHARED AND WHAT IS NOT. The prompts, the validation and the JSON parsing live in
 * prompt.js and are used by BOTH providers — a recommendation must be held to the same rules
 * whichever vendor wrote it, and duplicating the system prompt would let the two drift into
 * giving different advice for the same finding. Only the transport differs, and that is all this
 * file contains.
 *
 * SECURITY: the key is read from the server environment at call time and travels only in the
 * `x-goog-api-key` header — never in the URL, where it would land in proxy and access logs. It is
 * never logged, never returned, and never reaches the browser.
 *
 * STRUCTURED OUTPUT: `responseMimeType: application/json` plus `responseSchema` is Gemini's
 * equivalent of OpenAI's strict json_schema. The response is still validated after parsing — a
 * provider promising a shape is not the same as receiving it.
 */

/** Hard ceiling on a single call, matching the OpenAI provider: this sits in a request path. */
const TIMEOUT_MS = 20_000;

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Gemini's schema dialect: uppercase type names, no `additionalProperties`, and `enum` carried on
 * the string type. Shapes match the OpenAI schemas field for field so both providers return the
 * same object.
 */
const RECOMMENDATION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    recommendation: { type: 'STRING', description: 'The improved recommendation, 1-3 sentences.' },
    whyItMatters: { type: 'STRING', description: 'The business consequence, 1-2 sentences.' },
    suggestedAction: { type: 'STRING', description: 'One concrete next step the merchant can take.' },
    confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
  },
  required: ['recommendation', 'whyItMatters', 'suggestedAction', 'confidence'],
};

const FIX_SCHEMA = {
  type: 'OBJECT',
  properties: {
    proposals: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          ref: { type: 'STRING', description: 'The resource ref, echoed back exactly.' },
          proposedValue: { type: 'STRING', description: 'The replacement value, plain text, within the stated character range.' },
          reason: { type: 'STRING', description: 'One short sentence explaining the change.' },
        },
        required: ['ref', 'proposedValue', 'reason'],
      },
    },
  },
  required: ['proposals'],
};

/** Maps an HTTP status to the caller-facing reason. Mirrors the OpenAI provider's mapping so the
 * two vendors produce the same operator-visible vocabulary. */
function reasonFor(status: number): AiFailureReason {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  // Google reports an exhausted free-tier quota as 429 too; 402 is included for completeness.
  if (status === 402) return 'quota';
  return 'server';
}

/**
 * The single HTTP path to Gemini. Both capabilities go through it so the timeout, the abort
 * signal, the "never keep an upstream error body" rule and the failure classification exist once.
 */
async function generate(
  systemPrompt: string,
  userMessage: string,
  responseSchema: unknown,
  maxTokens: number,
): Promise<{ ok: true; content: string } | { ok: false; reason: AiFailureReason; detail: string }> {
  const apiKey = env.geminiApiKey;
  if (!apiKey) return { ok: false, reason: 'disabled', detail: 'no API key configured' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${API_ROOT}/${encodeURIComponent(env.geminiModel)}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        // Gemini carries the system prompt in its own field rather than as a message role.
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema,
          maxOutputTokens: maxTokens,
          // Low but non-zero: consistent phrasing across runs without being robotic.
          temperature: 0.3,
        },
      }),
    });

    if (!response.ok) {
      // The body may echo request details; only the status is kept, so nothing from an upstream
      // error can leak into logs or to a customer.
      return { ok: false, reason: reasonFor(response.status), detail: `HTTP ${response.status}` };
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
      promptFeedback?: { blockReason?: string };
    };

    // A safety block returns 200 with no candidate. Reported as its own case rather than as an
    // empty completion, because the fix for it is different.
    if (payload.promptFeedback?.blockReason) {
      return { ok: false, reason: 'invalid_response', detail: `blocked: ${payload.promptFeedback.blockReason}` };
    }

    const candidate = payload.candidates?.[0];
    const content = candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';

    // MAX_TOKENS with an empty body is the failure mode a thinking-heavy model produces: the
    // budget is spent before any answer is written. Named explicitly so an operator sees the
    // cause instead of a mystery empty completion.
    if (!content) {
      const detail = candidate?.finishReason === 'MAX_TOKENS'
        ? 'output token budget was exhausted before any content was produced'
        : 'empty completion';
      return { ok: false, reason: 'invalid_response', detail };
    }

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

export const geminiProvider: AiProvider = {
  name: 'gemini',

  async enhance(context: RecommendationContext): Promise<AiResult> {
    const response = await generate(SYSTEM_PROMPT, buildUserMessage(context), RECOMMENDATION_SCHEMA, MAX_OUTPUT_TOKENS);
    if (!response.ok) return response;

    const parsed = parseJson(response.content);
    if (parsed === null) return { ok: false, reason: 'invalid_response', detail: 'completion was not valid JSON' };

    const recommendation: AiRecommendation | null = validateRecommendation(parsed);
    if (!recommendation) return { ok: false, reason: 'invalid_response', detail: 'completion failed validation' };

    return { ok: true, recommendation, model: env.geminiModel };
  },

  async planFix(context: FixPlanContext): Promise<AiFixResult> {
    if (context.targets.length === 0) {
      return { ok: false, reason: 'invalid_response', detail: 'no targets supplied' };
    }

    const message = buildFixMessage({
      ...context,
      targets: context.targets.map((target) => ({ ...target, sourceText: target.sourceText.slice(0, SOURCE_TEXT_LIMIT) })),
    });

    const response = await generate(FIX_SYSTEM_PROMPT, message, FIX_SCHEMA, MAX_FIX_OUTPUT_TOKENS);
    if (!response.ok) return response;

    const parsed = parseJson(response.content);
    if (parsed === null) return { ok: false, reason: 'invalid_response', detail: 'completion was not valid JSON' };

    const proposals = validateProposals(parsed);
    if (!proposals) return { ok: false, reason: 'invalid_response', detail: 'completion did not contain a proposals array' };
    if (proposals.length === 0) return { ok: false, reason: 'invalid_response', detail: 'completion contained no usable proposals' };

    return { ok: true, proposals, model: env.geminiModel };
  },
};
