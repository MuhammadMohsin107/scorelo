// ─── Scorelo · PostgreSQL schema ─────────────────────────────────────
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
// ID strategy: integer identity PKs — single-tenant internal data with
// no distributed-generation or external-exposure requirement.

import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─── users ───────────────────────────────────────────────────────────
// Single account today (no auth). Persisted by Settings → Profile,
// Notifications and Appearance, which already have a save workflow.
export const users = pgTable('users', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull().unique(),
  jobTitle: text('job_title'),
  role: text('role').notNull().default('Administrator'),
  // Notifications (Settings → Notifications: six explicit toggles)
  notifyAnalysisComplete: boolean('notify_analysis_complete').notNull().default(true),
  notifyCriticalIssues: boolean('notify_critical_issues').notNull().default(true),
  notifyScoreChanges: boolean('notify_score_changes').notNull().default(true),
  notifyWeeklySummary: boolean('notify_weekly_summary').notNull().default(true),
  notifyIntegrationAlerts: boolean('notify_integration_alerts').notNull().default(true),
  notifyProductUpdates: boolean('notify_product_updates').notNull().default(false),
  // Appearance (Settings → Appearance)
  density: text('density').notNull().default('Comfortable'),
  reduceMotion: boolean('reduce_motion').notNull().default(false),
});

// ─── stores ──────────────────────────────────────────────────────────
// The storefront Scorelo analyzes. Identity fields feed the dashboard
// header; analysis fields are Settings → Analysis (crawl behaviour).
export const stores = pgTable('stores', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  workspaceName: text('workspace_name').notNull(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  platform: text('platform').notNull(),
  industry: text('industry').notNull(),
  country: text('country').notNull(),
  timezone: text('timezone').notNull(),
  currency: text('currency').notNull(),
  // Analysis preferences (Settings → Analysis)
  autoAnalysis: boolean('auto_analysis').notNull().default(true),
  analysisFrequency: text('analysis_frequency').notNull().default('Weekly'),
  crawlScope: text('crawl_scope').notNull().default('Entire store'),
  pageLimit: integer('page_limit').notNull().default(2000),
  includeBlog: boolean('include_blog').notNull().default(true),
  includeCollections: boolean('include_collections').notNull().default(true),
  respectRobots: boolean('respect_robots').notNull().default(true),
});

// ─── audits ──────────────────────────────────────────────────────────
// One row per analysis run. run_at powers "Last analyzed"; the series
// powers the dashboard score trend and Reports' current-vs-previous.
export const audits = pgTable(
  'audits',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    storeId: integer('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    overallScore: integer('overall_score').notNull(),
    runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audits_store_run_idx').on(table.storeId, table.runAt),
    check('audits_score_range', sql`${table.overallScore} BETWEEN 0 AND 100`),
  ],
);

// ─── audit_scores ────────────────────────────────────────────────────
// Pillar- and sub-pillar-level scores for one audit.
//   sub_pillar NULL  → pillar row (dashboard pillar list; checks_* shown there)
//   sub_pillar set   → sub-pillar row (detail pages; analyzed/healthy metric strip)
export const auditScores = pgTable(
  'audit_scores',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    auditId: integer('audit_id')
      .notNull()
      .references(() => audits.id, { onDelete: 'cascade' }),
    pillar: text('pillar').notNull(),
    subPillar: text('sub_pillar'),
    score: integer('score').notNull(),
    // Pillar rows only (Dashboard "checks passed" column)
    checksTotal: integer('checks_total'),
    checksPassed: integer('checks_passed'),
    // Sub-pillar rows only (detail-page metric strip)
    analyzedCount: integer('analyzed_count'),
    healthyCount: integer('healthy_count'),
  },
  (table) => [
    // COALESCE folds the pillar-level row (sub_pillar NULL) into '', so
    // only one pillar-level row can exist per audit + pillar.
    uniqueIndex('audit_scores_unique_idx').on(
      table.auditId,
      table.pillar,
      sql`COALESCE(${table.subPillar}, '')`,
    ),
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
export const findings = pgTable(
  'findings',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    auditId: integer('audit_id')
      .notNull()
      .references(() => audits.id, { onDelete: 'cascade' }),
    pillar: text('pillar').notNull(),
    subPillar: text('sub_pillar').notNull(),
    title: text('title').notNull(),
    severity: text('severity').notNull(),
    status: text('status').notNull().default('open'),
    // How the finding gets resolved (Automated / Product / Service /
    // Integration / Deferred) — drives the CTA on pillar pages.
    resolutionType: text('resolution_type'),
    affectedCount: integer('affected_count').notNull(),
    affectedLabel: text('affected_label').notNull(),
    impact: text('impact').notNull(),
    scoreLift: integer('score_lift').notNull().default(0),
    // Drawer copy: what is wrong / why it matters / what to do.
    problem: text('problem'),
    why: text('why').notNull(),
    recommendation: text('recommendation').notNull(),
    // Bullet list shown in the Fix Center / sub-pillar drawers.
    evidence: text('evidence').array().notNull().default(sql`'{}'::text[]`),
    // When status last changed — shown in Fix Center's "Applied fixes".
    statusChangedAt: timestamp('status_changed_at', { withTimezone: true }),
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
export const integrations = pgTable(
  'integrations',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    storeId: integer('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    status: text('status').notNull().default('not_connected'),
    accountDetail: text('account_detail'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
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
