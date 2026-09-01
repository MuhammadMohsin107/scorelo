/**
 * ─── AI provider contract ────────────────────────────────────────────
 * The seam between Scorelo and whichever model vendor is configured. The recommendation service
 * depends on THIS interface, never on OpenAI directly, so adding Anthropic later means adding
 * one file beside openai.provider.ts — no change to the audit engine, the service, or the API.
 *
 * A provider NEVER throws for an expected failure. Every outcome is a value, because the caller's
 * job is to fall back to the deterministic recommendation, not to handle exceptions.
 */

/** Exactly the audit context a recommendation needs. Deliberately narrow: no tokens, no
 * credentials, no customer data, no store access details — see buildContext() in the service. */
export interface RecommendationContext {
  pillar: string;
  subPillar: string;
  findingTitle: string;
  severity: string;
  impact: string;
  /** What the check observed, in its own words. */
  problem: string | null;
  /** Why the check considers it a problem. */
  why: string;
  /** The deterministic recommendation. AI improves THIS; it is the source of truth. */
  deterministicRecommendation: string;
  /** How many resources are affected, and what they are called. */
  affectedCount: number;
  affectedLabel: string;
  /** Short factual bullets the check recorded (counts, thresholds). Never raw customer data. */
  evidence: string[];
  /** Store type context only — the shop's display name. No domain, no token, no IDs. */
  storeName: string | null;
}

/** The structured shape a provider must return. Prose only — no HTML, no code, no markup. */
export interface AiRecommendation {
  recommendation: string;
  whyItMatters: string;
  suggestedAction: string;
  confidence: 'high' | 'medium' | 'low';
}

export type AiResult =
  | { ok: true; recommendation: AiRecommendation; model: string }
  /**
   * `reason` is an internal classification for logs and metrics. It is never shown to a customer:
   * the API reports only that AI enhancement was unavailable, and the deterministic
   * recommendation is returned in its place.
   */
  | { ok: false; reason: AiFailureReason; detail: string };

// ─── Fix planning ────────────────────────────────────────────────────
// A second, narrower capability on the same seam. `enhance` rewrites advice for a human to read;
// `planFix` proposes a concrete new value for ONE named field of ONE named resource.
//
// The model is a suggestion engine and nothing more. It is given the resources to work on and may
// only return values for those; it never learns a store domain, a token, or an id it could act
// on. Everything it returns is re-validated against fix-policy.ts before a human ever sees it,
// and a human must approve it before it reaches the fix engine.

/** One resource the planner may propose a value for, with the value it currently holds. */
export interface FixTarget {
  /** Opaque to the model — it echoes this back so proposals can be matched to resources. */
  ref: string;
  resourceType: string;
  /** The resource's own name, for context. Never a URL, id or domain. */
  title: string;
  currentValue: string;
  /** The deterministic engine's own suggestion, when it had one. The model improves on this
   * rather than starting from nothing — and its absence is itself informative. */
  deterministicSuggestion: string | null;
  /** Body copy the value should be derived from, already reduced to plain text and truncated. */
  sourceText: string;
}

export interface FixPlanContext {
  findingTitle: string;
  /** What the check observed, in its own words. */
  problem: string | null;
  field: string;
  fieldLabel: string;
  minLength: number;
  maxLength: number;
  /** The rule text from fix-policy.ts, so prompt and validator cannot drift apart. */
  guidance: string;
  storeName: string | null;
  targets: FixTarget[];
}

/** What the model returns per resource. Untrusted until fix-policy.ts has passed it. */
export interface AiFixProposal {
  ref: string;
  proposedValue: string;
  reason: string;
}

export type AiFixResult =
  | { ok: true; proposals: AiFixProposal[]; model: string }
  | { ok: false; reason: AiFailureReason; detail: string };

export type AiFailureReason = 'disabled' | 'timeout' | 'auth' | 'rate_limit' | 'quota' | 'server' | 'invalid_response' | 'network';

export interface AiProvider {
  readonly name: string;
  enhance(context: RecommendationContext): Promise<AiResult>;
  /** Proposes a new value per target. Like `enhance`, never throws for an expected failure —
   * the caller falls back to the deterministic suggestion. */
  planFix(context: FixPlanContext): Promise<AiFixResult>;
}
