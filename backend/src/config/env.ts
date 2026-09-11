
import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    // Fail fast with the variable NAME only — never echo values.
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  databaseUrl: required('DATABASE_URL'),
  mockAuthEnabled: process.env.NODE_ENV !== 'production' && process.env.MOCK_AUTH === 'true',
  jwtAccessSecret: required('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  /**
   * Whether an unverified email address blocks login.
   *
   * DEFAULTS TO FALSE, and only the literal string 'true' enables it. Every existing account has
   * `email_verified_at = NULL` — nothing has ever written that column — so switching this on
   * locks out every current customer until they verify. It therefore stays off until SMTP is
   * configured and the whole flow has been exercised against real mail.
   *
   * The verification system itself runs regardless of this flag: signup still issues a code,
   * verify and resend still work. The flag governs one thing only — whether login refuses an
   * unverified account.
   */
  requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
  // Shopify app credentials — optional at startup (unlike the vars above) so the rest of the
  // API keeps working before a real Shopify Partner app is provisioned. Routes that need them
  // check shopifyConfigured() and fail with a clear 500 instead of crashing the whole server.
  shopifyApiKey: process.env.SHOPIFY_API_KEY,
  shopifyApiSecret: process.env.SHOPIFY_API_SECRET,
  // The BACKEND's own public base URL — Shopify calls back to `${backendUrl}/api/shopify/callback`
  // directly, so this must be where this API is actually reachable, not the frontend's URL.
  backendUrl: process.env.BACKEND_URL,
  // Where to send the browser after a successful connect — the frontend app.
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY,
  // ─── Google Search Console ──────────────────────────────────────────
  // OAuth client from the Google Cloud console. Optional at startup like the Shopify block above:
  // without it the API runs and every other route is unaffected, and the Integrations page shows
  // Search Console as unavailable rather than offering a Connect button that would fail.
  //
  // The redirect URI registered in Google Cloud must be exactly
  // `${BACKEND_URL}/api/google/callback` — Google matches it character for character, and a
  // mismatch is rejected at the consent screen before Scorelo is ever called.
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  // ─── SMTP ───────────────────────────────────────────────────────────
  // Optional at startup, like the Shopify block above: without it the API still runs and every
  // other route is unaffected. Only password-reset delivery depends on it, and that path reports
  // a server-side failure rather than pretending an email was sent. See lib/mailer.ts.
  smtpHost: process.env.SMTP_HOST,
  smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
  smtpUser: process.env.SMTP_USER,
  smtpPassword: process.env.SMTP_PASSWORD,
  /** Envelope sender, e.g. "Scorelo <no-reply@scorelo.app>". */
  smtpFrom: process.env.SMTP_FROM,
  // ─── AI recommendations (OPTIONAL enhancement) ──────────────────────
  // Scorelo's recommendations are produced deterministically by the audit checks. AI only ever
  // REWRITES an existing recommendation more helpfully; it never produces one from nothing and
  // never gates an audit. Missing key, disabled flag, or any provider failure simply means the
  // deterministic text stands. Same optional-at-startup shape as the Shopify and SMTP blocks.
  openaiApiKey: process.env.OPENAI_API_KEY,
  /** Cost-efficient default; override per environment. Never hard-code a model at a call site. */
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  /**
   * Which vendor serves AI requests: 'openai' (default) or 'gemini'.
   *
   * Defaults to openai so an existing deployment keeps working untouched. Setting AI_PROVIDER
   * alone is not enough — the chosen provider must also have its key, which is what
   * aiConfigured() checks.
   */
  aiProvider: (process.env.AI_PROVIDER ?? 'openai').trim().toLowerCase(),
  /**
   * Google AI Studio key for the Gemini provider (aistudio.google.com).
   *
   * `GEMINI_API_KEY` is accepted as an alias because that is the name Google's own examples use,
   * and an operator who copies one of those into .env should not have to discover that Scorelo
   * spells it differently.
   */
  geminiApiKey: process.env.AI_API_KEY ?? process.env.GEMINI_API_KEY,
  /**
   * Flash-Lite by default, and deliberately not a Gemini 3 model.
   *
   * Verified against a live key: gemini-flash-lite-latest returned valid structured JSON in about
   * a second, while gemini-3.6-flash spent its whole output budget on thinking tokens and came
   * back with a truncated body. Scorelo needs short, schema-shaped answers inside a request, which
   * is exactly what Flash-Lite is for.
   */
  geminiModel: process.env.AI_MODEL ?? 'gemini-flash-lite-latest',
  /** Kill switch that works even when a key is present — set to 'false' to stop all AI calls. */
  aiRecommendationsEnabled: process.env.AI_RECOMMENDATIONS_ENABLED !== 'false',
  /**
   * Ceiling on ONE call to the model, in milliseconds.
   *
   * Was a hard-coded 20s in each provider. Two things made that too tight: a cold first call can
   * genuinely take longer (observed against a live key), and there is no retry — one slow call is
   * reported to the merchant as "AI could not draft these right now". It also has to cover a
   * whole batch of fix proposals, which is larger now that the batch size is configurable.
   */
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 45_000),
  /**
   * How many resources ONE "Draft with AI" press may plan for.
   *
   * Bounded because every target costs prompt tokens, output tokens and latency inside a request.
   * The output budget is derived from this rather than fixed (see fixOutputTokens in prompt.ts),
   * so raising it cannot silently truncate the completion the way a flat budget would.
   */
  aiFixMaxTargets: Number(process.env.AI_FIX_MAX_TARGETS ?? 25),
  /**
   * How many evidence rows each sub-pillar persists on an audit.
   *
   * EVERY page is still analyzed and scored — this caps only the per-row table stored as JSON and
   * rendered in the evidence table, which is also the set the merchant can select for bulk fixes.
   * At 50 a store with 103 flagged pages could only ever see and act on half of them.
   */
  auditEvidenceRowLimit: Number(process.env.AUDIT_EVIDENCE_ROW_LIMIT ?? 200),
  // ─── Storefront crawler ─────────────────────────────────────────────
  // Bounds on the one part of Scorelo that makes requests to a merchant's public storefront.
  // Every value is a safety limit rather than a tuning knob: the defaults are what a polite
  // crawler should do to a live shop that is also serving real customers.
  /** Hard ceiling on pages fetched per audit, across every page type. */
  crawlMaxPages: Number(process.env.CRAWL_MAX_PAGES ?? 40),
  /** Per-request timeout. A slow storefront must not hold an audit open. */
  crawlTimeoutMs: Number(process.env.CRAWL_TIMEOUT_MS ?? 12_000),
  /** Simultaneous in-flight requests to ONE merchant's storefront. */
  crawlConcurrency: Number(process.env.CRAWL_CONCURRENCY ?? 3),
  /** Identifies Scorelo to the merchant's logs and to Shopify. Keep the contact URL. */
  crawlUserAgent: process.env.CRAWL_USER_AGENT ?? 'ScoreloAuditBot/1.0 (+https://scorelo.app/bot)',
  /**
   * Optional storefront password for a shop still behind Shopify's "Restrict access" gate.
   *
   * A gated storefront serves the password screen for EVERY url with HTTP 200, so without this a
   * crawl of a development store can measure nothing — and, worse, would read the password page
   * as though it were the merchant's own markup. Supplying it lets Scorelo authenticate once and
   * crawl the real pages. Never logged, never returned by the API.
   */
  crawlStorefrontPassword: process.env.CRAWL_STOREFRONT_PASSWORD,
  /** Set to 'false' to stop all storefront crawling without touching anything else. */
  crawlEnabled: process.env.CRAWL_ENABLED !== 'false',
  // ─── Scheduled re-analysis ──────────────────────────────────────────
  // Per-store scheduling lives in the database (`stores.auto_analysis`, `analysis_frequency`) and
  // is the merchant's to set in Settings. These are the OPERATOR's controls over the sweep that
  // acts on it — how often to look, how much to start at once, and a switch to stop it entirely.
  /** Kill switch for the whole scheduler. Per-store preferences are untouched while it is off. */
  autoAnalysisEnabled: process.env.AUTO_ANALYSIS_ENABLED !== 'false',
  /** How often to look for stores whose interval has elapsed. Not how often a store is analysed —
   * that is the store's own frequency, and a sweep starts nothing when nothing is due. */
  autoAnalysisIntervalMs: Number(process.env.AUTO_ANALYSIS_INTERVAL_MS ?? 30 * 60_000),
  /** Delay before the FIRST sweep after boot, so a redeploy does not trigger a round of audits. */
  autoAnalysisStartDelayMs: Number(process.env.AUTO_ANALYSIS_START_DELAY_MS ?? 5 * 60_000),
  /** Ceiling on runs queued per sweep, so a backlog is worked through over several ticks instead
   * of hitting many storefronts at once. */
  autoAnalysisMaxPerSweep: Number(process.env.AUTO_ANALYSIS_MAX_PER_SWEEP ?? 3),
} as const;

/** Whether storefront crawling should be attempted at all. */
export function crawlConfigured(): boolean {
  return env.crawlEnabled && env.crawlMaxPages > 0;
}

/** The key belonging to the selected provider, or undefined when it is not configured. */
export function aiProviderKey(): string | undefined {
  return env.aiProvider === 'gemini' ? env.geminiApiKey : env.openaiApiKey;
}

/** The model the selected provider will use. Surfaced to the UI; never the key. */
export function aiModelName(): string {
  return env.aiProvider === 'gemini' ? env.geminiModel : env.openaiModel;
}

/**
 * True only when AI enhancement should actually be attempted. Both a key AND the flag are
 * required, so an operator can disable spend instantly without removing credentials.
 *
 * The key checked is the SELECTED provider's: setting AI_PROVIDER=gemini while only an OpenAI key
 * is present must read as "not configured" rather than quietly calling the wrong vendor.
 */
export function aiConfigured(): boolean {
  return Boolean(aiProviderKey()) && env.aiRecommendationsEnabled;
}

export function shopifyConfigured(): boolean {
  return Boolean(env.shopifyApiKey && env.shopifyApiSecret && env.backendUrl && env.tokenEncryptionKey);
}

/**
 * Whether Google Search Console can be offered at all.
 *
 * `tokenEncryptionKey` is part of it because the refresh token Google returns is a long-lived
 * credential to a merchant's search data — storing it without encryption at rest is not a
 * degraded mode worth having, so the integration is hidden rather than offered insecurely.
 *
 * `backendUrl` is required because the OAuth redirect URI is derived from it and Google matches
 * it exactly; guessing a default here would produce a consent screen that always fails.
 */
export function googleConfigured(): boolean {
  return Boolean(env.googleClientId && env.googleClientSecret && env.backendUrl && env.tokenEncryptionKey);
}

export const isDev = env.nodeEnv !== 'production';
