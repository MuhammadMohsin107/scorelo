
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
  /** Kill switch that works even when a key is present — set to 'false' to stop all AI calls. */
  aiRecommendationsEnabled: process.env.AI_RECOMMENDATIONS_ENABLED !== 'false',
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
} as const;

/** Whether storefront crawling should be attempted at all. */
export function crawlConfigured(): boolean {
  return env.crawlEnabled && env.crawlMaxPages > 0;
}

/**
 * True only when AI enhancement should actually be attempted. Both a key AND the flag are
 * required, so an operator can disable spend instantly without removing credentials.
 */
export function aiConfigured(): boolean {
  return Boolean(env.openaiApiKey) && env.aiRecommendationsEnabled;
}

export function shopifyConfigured(): boolean {
  return Boolean(env.shopifyApiKey && env.shopifyApiSecret && env.backendUrl && env.tokenEncryptionKey);
}

export const isDev = env.nodeEnv !== 'production';
