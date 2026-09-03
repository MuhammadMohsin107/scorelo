// ─── Scorelo · MySQL schema ──────────────────────────────────────────
// Designed from the CURRENT frontend implementation only. Every table
// and column maps to a feature that exists in the UI today:
//
//   users         → Settings · Profile / Notifications / Appearance
//   stores        → Settings · Workspace & store / Analysis; dashboard header
//   audits        → "Last analyzed", score trend, Reports current-vs-previous
//   audit_scores  → Dashboard pillar rows, pillar dashboards, sub-pillar pages
//   findings      → Fix Center (mutable status), priority issues, sub-pillar findings
//   integrations  → Integrations page (mutable connection state)
//
// Deliberately excluded (UI-only, derived, or placeholder): evidence
// sample tables, recommended actions (derived from findings), reports
// (computed from audits), billing/plan, security/sessions, auth.
//
// ID strategy: auto-increment integer PKs — single-tenant internal data
// with no distributed-generation or external-exposure requirement.
//
// ─── MySQL notes (this schema targets MySQL 8 and MariaDB 10.5+) ──────
//
// varchar vs text: MySQL cannot index a TEXT column without a prefix length, so
// every column that appears in an index, unique constraint or foreign key is
// varchar. Free-form prose the UI only ever reads back whole stays text.
//
// datetime, not timestamp: MySQL's TIMESTAMP is bounded at 2038 and silently
// shifts values by the session time zone. DATETIME stores exactly what it is
// given; the connection pins time_zone to UTC (see client.ts) so every value
// written and read is UTC regardless of where the server thinks it is.
//
// json, not jsonb: MySQL has one JSON type. Values still round-trip as objects.
//
// Expression indexes are avoided entirely — MySQL 8 supports them, MariaDB does
// not. Where Postgres used one, a STORED generated column carries the expression
// and the index sits on that, which both engines support.

import {
  boolean,
  check,
  datetime,
  index,
  int,
  json,
  mysqlTable,
  text,
  tinyint,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

/** MySQL has no `now()` default on DATETIME via Drizzle's helper; this is the portable form. */
const now = sql`CURRENT_TIMESTAMP`;

// ─── users ───────────────────────────────────────────────────────────
// Single account today (no auth). Persisted by Settings → Profile,
// Notifications and Appearance, which already have a save workflow.
export const users = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  emailVerifiedAt: datetime('email_verified_at', { mode: 'date' }),
  refreshTokenHash: varchar('refresh_token_hash', { length: 255 }),
  refreshTokenExpiresAt: datetime('refresh_token_expires_at', { mode: 'date' }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(now),
  jobTitle: varchar('job_title', { length: 255 }),
  /**
   * A PROFILE LABEL, NOT A PERMISSION. Settings → Profile displays this next to the job title, it
   * defaults to 'Administrator' on every row, and no code has ever read it to make a decision.
   *
   * It is therefore unusable as an authorization input: treating it as one would grant platform
   * admin to every account that has ever been created. `is_platform_admin` below is the real
   * grant, and the two must never be conflated.
   */
  role: varchar('role', { length: 64 }).notNull().default('Administrator'),
  /**
   * Platform-operator access to the admin APIs under /api/admin. FALSE for every existing and
   * future account — there is no signup path, no API and no seed that sets it, so a grant is a
   * deliberate UPDATE run by an operator against MySQL.
   *
   * WHY A COLUMN AND NOT A JWT CLAIM: middleware/requireAdmin.ts re-reads this on every admin
   * request, so revoking the flag takes effect at the next call rather than whenever a
   * fifteen-minute access token happens to expire.
   */
  isPlatformAdmin: boolean('is_platform_admin').notNull().default(false),
  // Notifications (Settings → Notifications: six explicit toggles)
  notifyAnalysisComplete: boolean('notify_analysis_complete').notNull().default(true),
  notifyCriticalIssues: boolean('notify_critical_issues').notNull().default(true),
  notifyScoreChanges: boolean('notify_score_changes').notNull().default(true),
  notifyWeeklySummary: boolean('notify_weekly_summary').notNull().default(true),
  notifyIntegrationAlerts: boolean('notify_integration_alerts').notNull().default(true),
  notifyProductUpdates: boolean('notify_product_updates').notNull().default(false),
  // Appearance (Settings → Appearance)
  density: varchar('density', { length: 32 }).notNull().default('Comfortable'),
  reduceMotion: boolean('reduce_motion').notNull().default(false),
  /**
   * When the password was last changed. NULL for every account that predates this column, and it
   * stays NULL rather than being backfilled — "we do not know" is the truth for those accounts,
   * and stamping them with a made-up date would be exactly the fabrication the Security page
   * exists to stop showing. The UI renders "Not recorded" until a real change happens.
   *
   * Written by security.service.changePassword() and by a completed password reset.
   */
  passwordChangedAt: datetime('password_changed_at', { mode: 'date' }),
  /**
   * When email one-time-code 2FA was switched on. NULL means off, which is every account's
   * default — 2FA is opt-in and nothing enables it on a customer's behalf.
   *
   * There is no secret stored here. This is EMAIL 2FA: the second factor is control of the
   * verified inbox, which the account already proves through `email_verified_at`. An
   * authenticator-app secret would be a different mechanism needing its own encrypted column.
   */
  twoFactorEnabledAt: datetime('two_factor_enabled_at', { mode: 'date' }),
});

// ─── user_sessions ───────────────────────────────────────────────────
// One row per signed-in device. THIS is the authoritative refresh-credential store from Phase 2
// onward.
//
// WHY A TABLE: `users.refresh_token_hash` held exactly one value, overwritten by every login, so
// signing in anywhere silently ended the session everywhere else. A row per session is what makes
// "these are your devices", "sign this one out" and "sign out everywhere else" expressible at all.
//
// The legacy columns on `users` are deliberately NOT dropped — they stay for rollback. They are no
// longer read once this table is live, which means a refresh token issued before the cutover has
// no session row and will be rejected. That signs existing customers out once. No row is invented
// to avoid it: a fabricated session would claim a device and a time nobody can vouch for.
//
// SECURITY: token_hash is SHA-256 of the refresh token — the same construction auth.service and
// password-reset already use, and correct here because a JWT is high-entropy, so there is nothing
// for a slow hash to protect and lookup must stay an indexed point-read. The raw token is never
// stored, never logged.
//
// ip_address and user_agent are recorded ONLY when the request actually carries them, and are NULL
// otherwise. There is no device column and no location column: both would be guesses.
export const userSessions = mysqlTable(
  'user_sessions',
  {
    id: int('id').primaryKey().autoincrement(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256 hex of the refresh token. Unique so a lookup is an indexed point-read. */
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    createdAt: datetime('created_at', { mode: 'date' }).notNull().default(now),
    /** Stamped on every successful refresh — what "last active" on the Security page means. */
    lastUsedAt: datetime('last_used_at', { mode: 'date' }).notNull().default(now),
    expiresAt: datetime('expires_at', { mode: 'date' }).notNull(),
    /** Non-null == revoked, and revoked is forever. Rows are kept rather than deleted so a
     * revocation stays visible in the customer's own security history. */
    revokedAt: datetime('revoked_at', { mode: 'date' }),
    /** Real client IP when the request carries one. 45 chars fits an IPv6 address. NULL when
     * genuinely unavailable — never a placeholder. */
    ipAddress: varchar('ip_address', { length: 45 }),
    /** Real User-Agent header, truncated. NULL when the request sent none. */
    userAgent: varchar('user_agent', { length: 512 }),
  },
  (table) => [
    uniqueIndex('user_sessions_token_hash_idx').on(table.tokenHash),
    index('user_sessions_user_idx').on(table.userId, table.revokedAt),
  ],
);

// ─── security_events ─────────────────────────────────────────────────
// An append-only record of security-relevant actions, shown to the customer on Settings → Security.
//
// EVERY ROW COMES FROM A REAL BACKEND ACTION. Nothing seeds this table, nothing backfills it, and
// an account that has done nothing shows an empty history rather than an invented one.
//
// SECURITY: `metadata` describes WHAT HAPPENED, never the credential involved. No password, OTP,
// refresh token, access token, reset ticket or hash is ever written here — see
// security-event.service.ts, which is the only writer, precisely so that rule holds in one place.
export const securityEvents = mysqlTable(
  'security_events',
  {
    id: int('id').primaryKey().autoincrement(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 32 }).notNull(),
    /** Real client IP when available, else NULL. */
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: varchar('user_agent', { length: 512 }),
    /** Small, non-secret context — e.g. how many sessions a revoke-others ended. */
    metadata: json('metadata').$type<Record<string, unknown>>(),
    createdAt: datetime('created_at', { mode: 'date' }).notNull().default(now),
  },
  (table) => [
    index('security_events_user_created_idx').on(table.userId, table.createdAt),
    check(
      'security_events_type_valid',
      // `two_factor_admin_disabled` and `two_factor_challenges_revoked` are separate members
      // rather than reuses of `two_factor_disabled`: "you switched this off" and "an operator
      // switched this off for you" are different facts, and collapsing them would leave the
      // account owner unable to tell from their own history which one happened.
      sql`${table.type} IN ('login_success', 'login_failed', 'logout', 'password_changed', 'password_reset', 'email_verified', 'session_revoked', 'sessions_revoked', 'two_factor_enabled', 'two_factor_disabled', 'two_factor_admin_disabled', 'two_factor_challenges_revoked')`,
    ),
  ],
);

// ─── admin_security_actions ──────────────────────────────────────────
// The operator trail: one row per privileged action an admin took against SOMEONE ELSE'S account.
//
// WHY NOT JUST security_events: that table answers "what happened to my account" for the account
// owner, and its `metadata` column deliberately refuses strings so no credential can be smuggled
// into it (see security-event.service.ts). A privileged action needs two things that column cannot
// carry — WHO did it, and WHY — and a reason is free text by nature. So the customer-facing event
// and the operator record are written together, each holding what it is actually for.
//
// SECURITY: no credential, code, ticket or hash is ever written here. `reason` is operator-authored
// prose, validated at the route and bounded to the column width.
//
// CASCADE matches security_events: this is an operator trail for live accounts, not a compliance
// archive meant to outlive them. Stated plainly rather than implied.
export const adminSecurityActions = mysqlTable(
  'admin_security_actions',
  {
    id: int('id').primaryKey().autoincrement(),
    /** The admin who acted. Resolved from the authenticated request, never from a request body. */
    actorUserId: int('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** The account acted upon. */
    targetUserId: int('target_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    action: varchar('action', { length: 48 }).notNull(),
    /** Why the operator did this. Required — an unexplained privileged action is not auditable. */
    reason: varchar('reason', { length: 500 }).notNull(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: varchar('user_agent', { length: 512 }),
    createdAt: datetime('created_at', { mode: 'date' }).notNull().default(now),
  },
  (table) => [
    index('admin_security_actions_target_idx').on(table.targetUserId, table.createdAt),
    index('admin_security_actions_actor_idx').on(table.actorUserId, table.createdAt),
    check(
      'admin_security_actions_action_valid',
      sql`${table.action} IN ('two_factor_disabled', 'two_factor_challenges_revoked')`,
    ),
  ],
);

// ─── password_reset_tokens ───────────────────────────────────────────
// One row per password-reset request.
//
// A SEPARATE TABLE rather than columns on `users`, because a reset request is an event with its
// own lifecycle (issued → used, or issued → expired) and a user can legitimately have several in
// flight. Columns on `users` could only ever hold the newest, which makes "invalidate every other
// outstanding token" impossible to express.
//
// SECURITY: only the SHA-256 hash of the token is stored. The raw token exists in exactly two
// places — the email that was sent, and the URL the customer clicks. A database dump therefore
// yields nothing usable, exactly as with `users.refresh_token_hash`.
export const passwordResetTokens = mysqlTable(
  'password_reset_tokens',
  {
    id: int('id').primaryKey().autoincrement(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256 hex of the raw token. Unique so a lookup is an indexed point-read. */
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: datetime('expires_at', { mode: 'date' }).notNull(),
    /** Set the moment the token is redeemed. Non-null == spent, and spent is forever. */
    usedAt: datetime('used_at', { mode: 'date' }),
    createdAt: datetime('created_at', { mode: 'date' }).notNull().default(now),
  },
  (table) => [
    uniqueIndex('password_reset_tokens_hash_idx').on(table.tokenHash),
    index('password_reset_tokens_user_idx').on(table.userId),
  ],
);

// ─── auth_challenges ─────────────────────────────────────────────────
// One row per short-lived credential issued to a user out of band: the email-verification code,
// the password-reset code, and the high-entropy ticket that code exchanges into.
//
// ONE TABLE, THREE PURPOSES, on purpose. Each of these needs exactly the same lifecycle —
// issued → (attempts) → consumed, or expired — and giving each its own table would triple the
// code that enforces expiry, single-use and attempt limits, which is precisely the code that
// must not be reimplemented slightly differently three times.
//
// `password_reset_tokens` is deliberately NOT replaced by this table. It still backs the legacy
// emailed ?token= links for one release; new resets flow through here. See password-reset.service.
//
// SECURITY: `code_hash` is never a plaintext code. A 6-digit OTP is bcrypt-hashed (only a million
// values exist, so the hash itself has to be slow); a 256-bit ticket is SHA-256 (nothing to slow
// down). lib/otp.ts owns that distinction. Lookup is always by (user_id, purpose) — never by
// hash — so bcrypt's per-row salt is not a problem.
//
// This table is NOT a second-factor mechanism. Proving control of an email address is not the
// same claim as presenting a second authentication factor, and no purpose here issues a session.
export const authChallenges = mysqlTable(
  'auth_challenges',
  {
    id: int('id').primaryKey().autoincrement(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: varchar('purpose', { length: 32 }).notNull(),
    /** bcrypt for OTPs, SHA-256 hex for tickets. Never a raw credential. */
    codeHash: varchar('code_hash', { length: 255 }).notNull(),
    expiresAt: datetime('expires_at', { mode: 'date' }).notNull(),
    /** Incremented on every failed verification. Reaching maxAttempts kills the challenge. */
    attempts: int('attempts').notNull().default(0),
    maxAttempts: int('max_attempts').notNull().default(5),
    /** Non-null == spent, and spent is forever. Set on success, on supersede, and on exhaustion. */
    consumedAt: datetime('consumed_at', { mode: 'date' }),
    // ─── Delivery lifecycle ───────────────────────────────────────────
    // Without these the system cannot answer "did this code ever leave the building?", and a
    // customer staring at an empty inbox is indistinguishable from one who mistyped an address.
    sentAt: datetime('sent_at', { mode: 'date' }),
    deliveryAttempts: int('delivery_attempts').notNull().default(0),
    /** Transport error message only. Never an address, never a code. */
    lastDeliveryError: varchar('last_delivery_error', { length: 255 }),
    createdAt: datetime('created_at', { mode: 'date' }).notNull().default(now),
  },
  (table) => [
    index('auth_challenges_lookup_idx').on(table.userId, table.purpose, table.consumedAt),
    check(
      'auth_challenges_purpose_valid',
      // login_2fa / login_2fa_ticket are the Phase 3 pair, and they mirror the reset pair exactly:
      // a low-entropy code proves inbox control, and it exchanges into a high-entropy ticket that
      // is what the second step actually redeems. The code alone never completes a login.
      sql`${table.purpose} IN ('email_verification', 'password_reset', 'password_reset_ticket', 'login_2fa', 'login_2fa_ticket')`,
    ),
  ],
);

// ─── stores ──────────────────────────────────────────────────────────
// The storefront Scorelo analyzes. Identity fields feed the dashboard
// header; analysis fields are Settings → Analysis (crawl behaviour).
export const stores = mysqlTable('stores', {
  id: int('id').primaryKey().autoincrement(),
  ownerId: int('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  workspaceName: varchar('workspace_name', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  url: varchar('url', { length: 512 }).notNull(),
  platform: varchar('platform', { length: 64 }).notNull(),
  industry: varchar('industry', { length: 128 }).notNull(),
  country: varchar('country', { length: 128 }).notNull(),
  timezone: varchar('timezone', { length: 64 }).notNull(),
  currency: varchar('currency', { length: 64 }).notNull(),
  // Analysis preferences (Settings → Analysis)
  autoAnalysis: boolean('auto_analysis').notNull().default(true),
  analysisFrequency: varchar('analysis_frequency', { length: 32 }).notNull().default('Weekly'),
  crawlScope: varchar('crawl_scope', { length: 64 }).notNull().default('Entire store'),
  pageLimit: int('page_limit').notNull().default(2000),
  includeBlog: boolean('include_blog').notNull().default(true),
  includeCollections: boolean('include_collections').notNull().default(true),
  respectRobots: boolean('respect_robots').notNull().default(true),
}, (table) => [index('stores_owner_idx').on(table.ownerId)]);

// ─── audits ──────────────────────────────────────────────────────────
// One row per analysis run. run_at powers "Last analyzed"; the series
// powers the dashboard score trend and Reports' current-vs-previous.
export const audits = mysqlTable(
  'audits',
  {
    id: int('id').primaryKey().autoincrement(),
    storeId: int('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    overallScore: int('overall_score').notNull(),
    runAt: datetime('run_at', { mode: 'date' }).notNull().default(now),
    // 'engine' = computed by the real audit engine from live store data.
    // 'seed'   = development/demo fixture. Kept distinguishable so seeded rows can never be
    //            silently presented to a customer as a real audit of their store.
    source: varchar('source', { length: 16 }).notNull().default('engine'),
    // Honest run metadata: scope limits actually applied, resource counts fetched, and any
    // pillar that failed (so a partial audit is never mistaken for a complete one).
    metadata: json('metadata'),
  },
  (table) => [
    index('audits_store_run_idx').on(table.storeId, table.runAt),
    check('audits_score_range', sql`${table.overallScore} BETWEEN 0 AND 100`),
    check('audits_source_valid', sql`${table.source} IN ('engine', 'seed')`),
  ],
);

// ─── audit_scores ────────────────────────────────────────────────────
// Pillar- and sub-pillar-level scores for one audit.
//   sub_pillar NULL  → pillar row (dashboard pillar list; checks_* shown there)
//   sub_pillar set   → sub-pillar row (detail pages; analyzed/healthy metric strip)
export const auditScores = mysqlTable(
  'audit_scores',
  {
    id: int('id').primaryKey().autoincrement(),
    auditId: int('audit_id')
      .notNull()
      .references(() => audits.id, { onDelete: 'cascade' }),
    pillar: varchar('pillar', { length: 32 }).notNull(),
    subPillar: varchar('sub_pillar', { length: 120 }),
    // Postgres indexed COALESCE(sub_pillar, '') directly. MariaDB has no expression
    // indexes, so the expression is materialised here and the unique index sits on it —
    // same guarantee (one pillar-level row per audit + pillar), portable to both engines.
    subPillarKey: varchar('sub_pillar_key', { length: 120 })
      .notNull()
      .generatedAlwaysAs(sql`(COALESCE(\`sub_pillar\`, ''))`, { mode: 'stored' }),
    score: int('score').notNull(),
    // Pillar rows only (Dashboard "checks passed" column)
    checksTotal: int('checks_total'),
    checksPassed: int('checks_passed'),
    // Sub-pillar rows only (detail-page metric strip)
    analyzedCount: int('analyzed_count'),
    healthyCount: int('healthy_count'),
    // Per-sub-pillar detailed metrics / evidence payloads for flexible audit data
    details: json('details'),
  },
  (table) => [
    uniqueIndex('audit_scores_unique_idx').on(table.auditId, table.pillar, table.subPillarKey),
    check('audit_scores_score_range', sql`${table.score} BETWEEN 0 AND 100`),
    check(
      'audit_scores_pillar_valid',
      sql`${table.pillar} IN ('seo', 'content', 'speed', 'cro', 'ai-discovery')`,
    ),
  ],
);

// ─── findings ────────────────────────────────────────────────────────
// One row per issue an audit surfaced. This is the only entity the UI
// mutates repeatedly: Fix Center moves status between open / reviewed /
// resolved / ignored (single and bulk). Also renders priority issues
// and every sub-pillar findings list + investigation drawer.
export const findings = mysqlTable(
  'findings',
  {
    id: int('id').primaryKey().autoincrement(),
    auditId: int('audit_id')
      .notNull()
      .references(() => audits.id, { onDelete: 'cascade' }),
    pillar: varchar('pillar', { length: 32 }).notNull(),
    // Slug, not display label (e.g. 'title-tags', not 'Title Tags') — matches the
    // frontend route param and pillarMeta.ts's canonical sub-pillar ids.
    subPillar: varchar('sub_pillar', { length: 120 }).notNull(),
    title: varchar('title', { length: 512 }).notNull(),
    severity: varchar('severity', { length: 16 }).notNull(),
    status: varchar('status', { length: 16 }).notNull().default('open'),
    // How the finding gets resolved (Automated / Product / Service /
    // Integration / Deferred) — drives the CTA on pillar pages.
    resolutionType: varchar('resolution_type', { length: 32 }),
    affectedCount: int('affected_count').notNull(),
    affectedLabel: varchar('affected_label', { length: 255 }).notNull(),
    impact: varchar('impact', { length: 32 }).notNull(),
    scoreLift: int('score_lift').notNull().default(0),
    // Drawer copy: what is wrong / why it matters / what to do.
    problem: text('problem'),
    why: text('why').notNull(),
    recommendation: text('recommendation').notNull(),
    // Bullet list shown in the Fix Center / sub-pillar drawers. Postgres used a
    // text[]; MySQL has no array type, so this is a JSON array of strings. The
    // shape the API returns is unchanged.
    evidence: json('evidence').$type<string[]>().notNull().default([]),
    // Structured row data for evidence tables that need richer than text-only payloads
    evidenceRows: json('evidence_rows'),
    // ─── Optional AI enhancement ─────────────────────────────────────
    // Cached so a recommendation is generated ONCE per finding rather than on every render —
    // this is the cost control that keeps a dashboard refresh from becoming an API bill.
    // Null is the normal state: no AI configured, not requested yet, or generation failed.
    // `recommendation` above remains the deterministic source of truth and is never overwritten.
    aiRecommendation: json('ai_recommendation').$type<{
      recommendation: string;
      whyItMatters: string;
      suggestedAction: string;
      confidence: 'high' | 'medium' | 'low';
    }>(),
    /** Which model produced the cached text, so a model change can be identified later. */
    aiModel: varchar('ai_model', { length: 64 }),
    aiGeneratedAt: datetime('ai_generated_at', { mode: 'date' }),
    // Per-sub-pillar-analysis extras (issueType/effort) that don't apply to every
    // pillar's findings — see SubPillarFinding in frontend/src/data/seo/subpillar.model.ts.
    details: json('details'),
    // When status last changed — shown in Fix Center's "Applied fixes".
    statusChangedAt: datetime('status_changed_at', { mode: 'date' }),
  },
  (table) => [
    index('findings_audit_idx').on(table.auditId),
    index('findings_status_idx').on(table.status),
    check(
      'findings_severity_valid',
      sql`${table.severity} IN ('critical', 'high', 'medium', 'low')`,
    ),
    check(
      'findings_status_valid',
      sql`${table.status} IN ('open', 'reviewed', 'resolved', 'ignored')`,
    ),
    check(
      'findings_pillar_valid',
      sql`${table.pillar} IN ('seo', 'content', 'speed', 'cro', 'ai-discovery')`,
    ),
  ],
);

// ─── integrations ────────────────────────────────────────────────────
// Connection STATE only. Provider names, descriptions and "data
// received" chips are a static catalog in the frontend; what changes —
// and therefore persists — is whether each provider is connected,
// which account, when it last synced, and any attention notice.
export const integrations = mysqlTable(
  'integrations',
  {
    id: int('id').primaryKey().autoincrement(),
    storeId: int('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('not_connected'),
    accountDetail: varchar('account_detail', { length: 255 }),
    lastSyncedAt: datetime('last_synced_at', { mode: 'date' }),
    notice: text('notice'),
  },
  (table) => [
    uniqueIndex('integrations_store_provider_idx').on(table.storeId, table.provider),
    check(
      'integrations_status_valid',
      sql`${table.status} IN ('connected', 'needs_attention', 'not_connected')`,
    ),
  ],
);

// ─── notifications ────────────────────────────────────────────────────
// Real, persisted notifications for the app header and notifications page.
export const notifications = mysqlTable(
  'notifications',
  {
    id: int('id').primaryKey().autoincrement(),
    storeId: int('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 64 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),
    tone: varchar('tone', { length: 16 }).notNull().default('info'),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: datetime('created_at', { mode: 'date' }).notNull().default(now),
  },
  (table) => [
    index('notifications_store_created_idx').on(table.storeId, table.createdAt),
    check(
      'notifications_tone_valid',
      sql`${table.tone} IN ('neutral', 'success', 'warning', 'critical', 'info')`,
    ),
  ],
);

// ─── shopify_connections ────────────────────────────────────────────────
// OAuth install state for a store's connected Shopify shop. Separate from
// `integrations` (which is a generic, provider-agnostic connection-status
// display row) because OAuth has its own lifecycle: install/token/scope,
// uninstall, and the GDPR redact webhooks.
export const shopifyConnections = mysqlTable(
  'shopify_connections',
  {
    id: int('id').primaryKey().autoincrement(),
    storeId: int('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    shopDomain: varchar('shop_domain', { length: 255 }).notNull().unique(),
    accessTokenEncrypted: text('access_token_encrypted').notNull(),
    scope: text('scope').notNull(),
    // ── Expiring offline access tokens ────────────────────────────────
    // Shopify requires public apps to use EXPIRING offline tokens for Admin API requests from
    // 2027-01-01. An expiring access token lives 1 hour; the refresh token that renews it lives
    // 90 days and is spent server-side with no merchant interaction.
    //
    // All four columns are nullable on purpose: a connection created before this change holds a
    // legacy non-expiring token with no refresh token and no expiry, and must keep working
    // untouched until the merchant reconnects. NULL `access_token_expires_at` therefore means
    // "legacy, never expires", NOT "expired" — see needsRefresh() in shopify-oauth.service.ts.
    refreshTokenEncrypted: text('refresh_token_encrypted'),
    accessTokenExpiresAt: datetime('access_token_expires_at', { mode: 'date' }),
    refreshTokenExpiresAt: datetime('refresh_token_expires_at', { mode: 'date' }),
    // The shop's own Admin API identity (gid://shopify/Shop/123456). Captured from Shopify at
    // install rather than assumed, so store identity survives a myshopify domain rename.
    shopGid: varchar('shop_gid', { length: 64 }),
    // Outcome of the last real read of the shop's data: resource counts actually fetched, which
    // groups were truncated by the scope limit, and any non-fatal warnings. Persisted so the
    // Integrations page can show what was genuinely synced instead of re-asserting "Connected",
    // and so a partial sync of a large catalogue is never presented as a complete one.
    lastSyncSummary: json('last_sync_summary'),
    // Set when the last sync failed, cleared when one succeeds. A store that failed to sync must
    // say so rather than keep displaying the previous success.
    lastSyncError: text('last_sync_error'),
    installedAt: datetime('installed_at', { mode: 'date' }).notNull().default(now),
    uninstalledAt: datetime('uninstalled_at', { mode: 'date' }),
    lastWebhookAt: datetime('last_webhook_at', { mode: 'date' }),
  },
  (table) => [index('shopify_connections_store_idx').on(table.storeId)],
);

// ─── jobs ────────────────────────────────────────────────────────────
// Tracks one async audit run so the frontend can poll status instead of
// blocking the request. In-process execution for now (no queue infra) —
// see backend-plan / the approved implementation plan §4 for the bullmq
// migration path if run volume ever needs it.
export const jobs = mysqlTable(
  'jobs',
  {
    id: int('id').primaryKey().autoincrement(),
    storeId: int('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 32 }).notNull().default('audit_run'),
    status: varchar('status', { length: 16 }).notNull().default('queued'),
    // 1 while the job is queued or running, NULL once it is not. Paired with store_id in the
    // unique index below, this enforces "at most one active job per store" atomically — the
    // same guarantee Postgres got from a partial unique index, closing the race that two
    // concurrent POST /api/audits/run requests would otherwise both pass the in-app check for.
    // MySQL permits unlimited NULLs in a unique index, so finished jobs never collide.
    //
    // It is derived from `status` ALONE, deliberately: MySQL rejects ON DELETE CASCADE on any
    // column a stored generated column reads, so generating this from `store_id` would make
    // the store_id foreign key below un-creatable ("Cannot add foreign key constraint").
    // Keeping store_id in the index but out of the expression satisfies both.
    activeFlag: tinyint('active_flag').generatedAlwaysAs(
      sql`(CASE WHEN \`status\` IN ('queued', 'running') THEN 1 ELSE NULL END)`,
      { mode: 'stored' },
    ),
    progress: int('progress').notNull().default(0),
    error: text('error'),
    auditId: int('audit_id').references(() => audits.id, { onDelete: 'set null' }),
    startedAt: datetime('started_at', { mode: 'date' }),
    finishedAt: datetime('finished_at', { mode: 'date' }),
    createdAt: datetime('created_at', { mode: 'date' }).notNull().default(now),
  },
  (table) => [
    index('jobs_store_created_idx').on(table.storeId, table.createdAt),
    uniqueIndex('jobs_store_active_unique_idx').on(table.storeId, table.activeFlag),
    check('jobs_status_valid', sql`${table.status} IN ('queued', 'running', 'succeeded', 'failed')`),
    check('jobs_progress_range', sql`${table.progress} BETWEEN 0 AND 100`),
  ],
);

// ─── page_settings ────────────────────────────────────────────────────
// Persists per-page settings instead of localStorage-only storage.
export const pageSettings = mysqlTable(
  'page_settings',
  {
    id: int('id').primaryKey().autoincrement(),
    storeId: int('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 190 }).notNull(),
    values: json('values').notNull().default({}),
    updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(now),
  },
  (table) => [
    uniqueIndex('page_settings_store_slug_idx').on(table.storeId, table.slug),
    index('page_settings_store_updated_idx').on(table.storeId, table.updatedAt),
  ],
);

// ─── ai_fix_proposals ─────────────────────────────────────────────────
// One AI-proposed value for one field of one resource, awaiting a human decision.
//
// This table exists because approval is a SEPARATE request from generation: the merchant reviews
// a preview and comes back. The proposal therefore has to survive between the two, and it has to
// be re-validated on the way out — a row here is a suggestion on record, never an authorisation
// to change anything.
//
// `currentValue` is captured at proposal time so the preview can show current-vs-proposed, and so
// approval can detect that the underlying resource moved on since the proposal was written.
export const aiFixProposals = mysqlTable(
  'ai_fix_proposals',
  {
    id: int('id').primaryKey().autoincrement(),
    findingId: int('finding_id')
      .notNull()
      .references(() => findings.id, { onDelete: 'cascade' }),
    // Denormalized from the finding's audit so every tenancy check is one predicate, not a join
    // through audits — the authorization path should be the hardest thing in here to get wrong.
    storeId: int('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    // 'product' | 'collection' | 'page' | 'article' — see lib/ai/fix-policy.ts.
    resourceType: varchar('resource_type', { length: 32 }).notNull(),
    resourceId: varchar('resource_id', { length: 64 }).notNull(),
    // Allow-listed field path, e.g. 'seo.title'. Never free-form.
    field: varchar('field', { length: 64 }).notNull(),
    currentValue: text('current_value').notNull(),
    proposedValue: text('proposed_value').notNull(),
    /** The model's one-sentence justification, shown beside the diff at approval time. */
    reason: text('reason').notNull(),
    /** The deterministic engine's own suggestion, kept so the preview can show both and so an
     * approval remains possible when AI is later unavailable. */
    deterministicValue: text('deterministic_value'),
    /**
     * proposed → approved → applied, or → rejected / failed.
     * 'approved' and 'applied' are distinct on purpose: approval is the merchant's decision,
     * application is what the fix engine subsequently managed to do with it.
     */
    status: varchar('status', { length: 16 }).notNull().default('proposed'),
    /** Why an application failed, or why a proposal was rejected by validation. */
    statusDetail: text('status_detail'),
    aiModel: varchar('ai_model', { length: 64 }),
    createdAt: datetime('created_at', { mode: 'date' }).notNull().default(now),
    decidedAt: datetime('decided_at', { mode: 'date' }),
    /** Who approved or rejected it. Null while still awaiting a decision. */
    decidedBy: int('decided_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    index('ai_fix_proposals_finding_idx').on(table.findingId),
    index('ai_fix_proposals_store_status_idx').on(table.storeId, table.status),
    // One live proposal per resource+field. A re-run supersedes the old row rather than stacking
    // duplicates the merchant would have to disambiguate.
    uniqueIndex('ai_fix_proposals_target_idx').on(table.findingId, table.resourceType, table.resourceId, table.field),
    check(
      'ai_fix_proposals_status_valid',
      sql`${table.status} IN ('proposed', 'approved', 'applied', 'rejected', 'failed')`,
    ),
  ],
);
