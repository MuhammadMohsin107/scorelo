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
  role: varchar('role', { length: 64 }).notNull().default('Administrator'),
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
});

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
