// ─── One-shot dev seed (npm run db:seed) ─────────────────────────────
// Populates the tables whose API is fully built today (users, stores,
// integrations, notifications, audits, audit_scores, findings) with the
// same content the frontend mocks currently show, so switching a page
// from mock data to a real fetch is visually a no-op. Safe to re-run:
// deleting `stores` cascades to audits/audit_scores/findings/
// integrations/notifications automatically (all FK onDelete: 'cascade').
//
// `findings.subPillar` is a SLUG (e.g. 'title-tags'), matching the route
// param the sub-pillar aggregate endpoint takes and pillarMeta.ts's ids —
// not the display label (resolved client-side via subPillarLabel()).
//
// Sub-pillar data: 'seo'/'title-tags' is seeded inline below; every other
// sub-pillar comes from subpillar-seed.json, generated from the frontend's
// hand-authored analysis data by frontend/scripts/export-seed-data.ts.
// Re-run that script if the frontend source data changes.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { db, pool } from './client.js';
import { insertReturning } from './returning.js';
import { auditScores, audits, findings, integrations, notifications, stores, users } from './schema.js';

interface SubPillarSeedEntry {
  pillar: string;
  subPillar: string;
  score: number;
  analyzed: number;
  healthy: number;
  details: {
    summary: string;
    healthChip: string;
    contextLabel: string;
    contextValue: string;
    evidenceRows: unknown[];
  };
  findings: Array<{
    title: string;
    severity: string;
    affectedCount: number;
    affectedLabel: string;
    impact: string;
    scoreLift: number;
    resolutionType: string | null;
    problem: string;
    why: string;
    recommendation: string;
    evidence: string[];
    details: { issueType: string; effort: string };
  }>;
}

const subPillarSeed: { entries: SubPillarSeedEntry[] } = JSON.parse(
  readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'subpillar-seed.json'), 'utf8'),
);

async function seed() {
  // TRUNCATE (not DELETE) so identity sequences reset too — otherwise a second
  // run would hand out id 2 for the "only" user, breaking mock-auth's
  // hardcoded req.user = { id: 1 }. CASCADE also clears every FK-dependent
  // table (audits, audit_scores, findings, integrations, notifications, page_settings).
  // MySQL truncates one table per statement, has no CASCADE, and resets AUTO_INCREMENT on its
  // own (no RESTART IDENTITY). Foreign key checks are dropped for the duration so the two
  // parent tables can be emptied in either order; every child cascades from stores anyway.
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  await db.execute(sql`TRUNCATE TABLE ${stores}`);
  await db.execute(sql`TRUNCATE TABLE ${users}`);
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);

  // Demo login: moshin.akhlaq@example.com / password123 — dev/demo only, never used in production.
  const passwordHash = await bcrypt.hash('password123', 12);

  const user = await insertReturning(users, {
      fullName: 'Moshin Akhlaq',
      email: 'moshin.akhlaq@example.com',
      passwordHash,
      jobTitle: 'Ecommerce Manager',
      role: 'Administrator',
      notifyAnalysisComplete: true,
      notifyCriticalIssues: true,
      notifyScoreChanges: true,
      notifyWeeklySummary: true,
      notifyIntegrationAlerts: true,
      notifyProductUpdates: false,
      density: 'Comfortable',
      reduceMotion: false,
  });

  const store = await insertReturning(stores, {
      ownerId: user.id,
      workspaceName: 'Acme Commerce',
      name: 'My Shopify Store',
      url: 'myshopifystore.com',
      platform: 'Shopify',
      industry: 'Consumer Electronics',
      country: 'Pakistan',
      timezone: '(UTC+05:00) Karachi',
      currency: 'PKR — Pakistani Rupee',
      autoAnalysis: true,
      analysisFrequency: 'Weekly',
      crawlScope: 'Entire store',
      pageLimit: 2000,
      includeBlog: true,
      includeCollections: true,
      respectRobots: true,
  });

  const now = Date.now();
  const minutesAgo = (n: number) => new Date(now - n * 60 * 1000);
  const hoursAgo = (n: number) => new Date(now - n * 60 * 60 * 1000);
  const daysAgo = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000);

  await db.insert(integrations).values([
    {
      storeId: store.id,
      provider: 'shopify',
      status: 'connected',
      accountDetail: 'My Shopify Store',
      lastSyncedAt: minutesAgo(18),
      notice: null,
    },
    {
      storeId: store.id,
      provider: 'search-console',
      status: 'connected',
      accountDetail: 'myshopifystore.com',
      lastSyncedAt: minutesAgo(22),
      notice: null,
    },
    {
      storeId: store.id,
      provider: 'analytics',
      status: 'needs_attention',
      accountDetail: 'Property 348219',
      lastSyncedAt: hoursAgo(18),
      notice: 'Authorization expired. Reconnect to resume behavioral data.',
    },
    {
      storeId: store.id,
      provider: 'pagespeed',
      status: 'connected',
      accountDetail: 'myshopifystore.com',
      lastSyncedAt: minutesAgo(66),
      notice: null,
    },
    {
      storeId: store.id,
      provider: 'clarity',
      status: 'not_connected',
      accountDetail: 'No project connected',
      lastSyncedAt: null,
      notice: 'Connect Clarity to include behavioral evidence in CRO analysis.',
    },
    {
      storeId: store.id,
      provider: 'merchant-center',
      status: 'not_connected',
      accountDetail: 'No account connected',
      lastSyncedAt: null,
      notice: null,
    },
  ]);

  await db.insert(notifications).values([
    {
      storeId: store.id,
      type: 'analysis_complete',
      title: 'SEO analysis completed',
      message: 'Your latest SEO analysis has finished successfully.',
      tone: 'success',
      isRead: false,
      createdAt: minutesAgo(10),
    },
    {
      storeId: store.id,
      type: 'critical_issue',
      title: 'Critical SEO issue detected',
      message: '8 canonical issues require attention.',
      tone: 'critical',
      isRead: false,
      createdAt: hoursAgo(1),
    },
    {
      storeId: store.id,
      type: 'score_change',
      title: 'Score improved',
      message: 'Your overall Scorelo score increased by 3 points.',
      tone: 'success',
      isRead: true,
      createdAt: hoursAgo(26),
    },
    {
      storeId: store.id,
      type: 'integration_alert',
      title: 'Integration needs attention',
      message: 'Google Search Console requires reconnection.',
      tone: 'warning',
      isRead: false,
      createdAt: hoursAgo(30),
    },
    {
      storeId: store.id,
      type: 'weekly_summary',
      title: 'Weekly report generated',
      message: 'Your weekly Store Performance report is ready.',
      tone: 'info',
      isRead: true,
      createdAt: hoursAgo(48),
    },
  ]);

  // Six weekly audits — the same score progression the dashboard/reports
  // mocks show (72 → 87) — so the trend chart has real history from day one.
  const weeklyScores = [72, 74, 78, 81, 84, 87];
  const insertedAudits = [];
  for (let i = 0; i < weeklyScores.length; i++) {
    const weeksFromLatest = weeklyScores.length - 1 - i;
    // source:'seed' is what keeps these demo fixtures distinguishable from a real
    // engine-computed audit — they must never be shown to a customer as their own results.
    const audit = await insertReturning(audits, { storeId: store.id, overallScore: weeklyScores[i], runAt: daysAgo(weeksFromLatest * 7), source: 'seed' });
    insertedAudits.push(audit);
  }
  const latestAudit = insertedAudits[insertedAudits.length - 1];
  const previousAudit = insertedAudits[insertedAudits.length - 2];

  // Pillar-level scores for the latest audit (dashboard pillar list / key metrics).
  await db.insert(auditScores).values([
    { auditId: latestAudit.id, pillar: 'seo', score: 91, checksTotal: 24, checksPassed: 22 },
    { auditId: latestAudit.id, pillar: 'content', score: 55, checksTotal: 18, checksPassed: 10 },
    { auditId: latestAudit.id, pillar: 'speed', score: 84, checksTotal: 18, checksPassed: 15 },
    { auditId: latestAudit.id, pillar: 'cro', score: 78, checksTotal: 20, checksPassed: 14 },
    { auditId: latestAudit.id, pillar: 'ai-discovery', score: 82, checksTotal: 15, checksPassed: 12 },
  ]);

  // Pillar-level scores for the previous audit (Reports current-vs-previous comparison).
  await db.insert(auditScores).values([
    { auditId: previousAudit.id, pillar: 'seo', score: 85 },
    { auditId: previousAudit.id, pillar: 'content', score: 56 },
    { auditId: previousAudit.id, pillar: 'speed', score: 82 },
    { auditId: previousAudit.id, pillar: 'cro', score: 75 },
    { auditId: previousAudit.id, pillar: 'ai-discovery', score: 78 },
  ]);

  // ─── Title Tags: full sub-pillar-analysis proof-of-concept ──────────
  // Numbers match frontend/src/data/seo/seo-8pillars.mock.ts's titleTagsData;
  // evidence rows and finding copy match data/seo/analyses/title-tags.ts verbatim.
  const titleTags = { pagesAnalyzed: 1284, optimized: 1214, missing: 18, duplicate: 16, tooLong: 24, tooShort: 12, score: 94, averageLength: 58 };
  const titleTagsIssues = titleTags.missing + titleTags.duplicate + titleTags.tooLong + titleTags.tooShort;

  const titleTagsRow = (
    id: string, url: string, title: string, keyword: string, pageType: string, status: string,
    suggested?: string, note?: string,
  ) => ({
    id, status, facet: pageType,
    cells: { url, pageType, title, keyword, length: title.length },
    current: { label: 'Current', value: title, meta: url },
    suggested: suggested ? { label: 'Suggested', value: suggested } : undefined,
    note: note ?? null,
  });

  await db.insert(auditScores).values({
    auditId: latestAudit.id, pillar: 'seo', subPillar: 'title-tags',
    score: titleTags.score, analyzedCount: titleTags.pagesAnalyzed, healthyCount: titleTags.optimized,
    details: {
      summary: `${titleTags.optimized.toLocaleString()} of ${titleTags.pagesAnalyzed.toLocaleString()} crawled pages have a unique, well-sized title. ${titleTagsIssues} need attention — ${titleTags.missing} of them urgently.`,
      healthChip: `${((titleTags.optimized / titleTags.pagesAnalyzed) * 100).toFixed(1)}% healthy`,
      contextLabel: 'Average length',
      contextValue: `${titleTags.averageLength} chars`,
      evidenceRows: [
        titleTagsRow('e1', '/wireless-earbuds-pro', 'Premium Wireless Earbuds - Acme Store', 'wireless earbuds', 'Product', 'Healthy'),
        titleTagsRow('e2', '/noise-cancelling-headphones', 'Best Noise Cancelling Headphones 2024', 'noise cancelling headphones', 'Product', 'Healthy'),
        titleTagsRow('e3', '/best-bluetooth-speakers', 'Top Bluetooth Speakers for Every Budget', 'bluetooth speakers', 'Collection', 'Healthy'),
        titleTagsRow('e4', '/gaming-headset-guide', 'Ultimate Gaming Headset Buying Guide', 'gaming headset', 'Blog', 'Healthy'),
        titleTagsRow('e5', '/home-audio-setup', 'Complete Home Audio System Setup Guide', 'home audio system', 'Blog', 'Healthy'),
        titleTagsRow('e6', '/wireless-earbuds-black', '', 'wireless earbuds black', 'Product', 'Missing', 'Wireless Earbuds in Matte Black — 30h Battery | Acme'),
        titleTagsRow('e7', '/wireless-earbuds-white', '', 'wireless earbuds white', 'Product', 'Missing', 'Wireless Earbuds in Arctic White — 30h Battery | Acme'),
        titleTagsRow('e8', '/collections/clearance', '', 'audio clearance deals', 'Collection', 'Missing', 'Clearance Audio Deals — Up to 40% Off | Acme Store'),
        titleTagsRow('e9', '/over-ear-headphones-2024', 'Best Noise Cancelling Headphones 2024', 'over ear headphones', 'Product', 'Duplicate', 'Over-Ear Headphones with ANC — 40h Battery | Acme', 'Collides with /noise-cancelling-headphones'),
        titleTagsRow('e10', '/earbuds-pro-charging-case', 'Premium Wireless Earbuds - Acme Store', 'earbuds charging case', 'Product', 'Duplicate', 'Wireless Earbuds Pro Charging Case — USB-C | Acme', 'Collides with /wireless-earbuds-pro'),
        titleTagsRow('e11', '/collections/top-rated', 'Top Bluetooth Speakers for Every Budget', 'top rated speakers', 'Collection', 'Duplicate', 'Top-Rated Bluetooth Speakers — 4.5★ and Above | Acme', 'Collides with /best-bluetooth-speakers'),
        titleTagsRow('e12', '/gaming-headset-pro-max-surround', 'Gaming Headset Pro Max Wireless RGB 7.1 Surround Sound Edition For PC And Console', 'gaming headset surround sound', 'Product', 'Too Long', 'Gaming Headset Pro Max — 7.1 Surround, Wireless | Acme'),
        titleTagsRow('e13', '/home-theater-soundbar-5-1', 'Home Theater Soundbar 5.1 Channel With Wireless Subwoofer And Dolby Atmos Support', 'home theater soundbar', 'Product', 'Too Long', 'Home Theater Soundbar 5.1 — Dolby Atmos | Acme'),
        titleTagsRow('e14', '/blogs/guides/how-to-choose-headphones', 'How To Choose The Right Headphones For Running Commuting Studio Work And Gaming', 'how to choose headphones', 'Blog', 'Too Long', 'How to Choose Headphones: A Practical Buying Guide'),
        titleTagsRow('e15', '/portable-speaker-mini', 'Portable Speaker', 'portable bluetooth speaker', 'Product', 'Too Short', 'Portable Bluetooth Speaker — Waterproof, 24h Battery'),
        titleTagsRow('e16', '/collections/new-arrivals', 'New Arrivals', 'new audio products', 'Collection', 'Too Short', 'New Arrivals — Latest Headphones & Speakers | Acme'),
        titleTagsRow('e17', '/pages/warranty', 'Warranty', 'acme warranty policy', 'Page', 'Too Short', 'Warranty & Coverage — 2-Year Guarantee | Acme Store'),
        titleTagsRow('e18', '/studio-monitor-headphones', 'Studio Monitor Headphones - Reference Grade Audio', 'studio monitor headphones', 'Product', 'Healthy'),
      ],
    },
  });

  // Findings for the latest audit — powers Fix Center, the dashboard's priority issues,
  // and (for title-tags) the sub-pillar aggregate endpoint.
  await db.insert(findings).values([
    {
      auditId: latestAudit.id, pillar: 'seo', subPillar: 'title-tags', title: 'Pages with no title tag',
      severity: 'critical', status: 'open', affectedCount: titleTags.missing, affectedLabel: 'pages', impact: 'High', scoreLift: 2,
      problem: `${titleTags.missing} pages render without a <title> element, so search engines fall back to the page handle or an on-page heading.`,
      why: 'A missing title removes the strongest on-page relevance signal you control and leaves the search snippet to be generated for you.',
      recommendation: 'Write a unique, keyword-relevant title of 30–60 characters for every affected page.',
      evidence: ['18 pages render without a <title> element', '/wireless-earbuds-black', '/wireless-earbuds-white'],
      details: { issueType: 'Missing', effort: 'Low' },
    },
    {
      auditId: latestAudit.id, pillar: 'seo', subPillar: 'title-tags', title: 'Duplicate title tags',
      severity: 'high', status: 'open', affectedCount: titleTags.duplicate, affectedLabel: 'pages', impact: 'High', scoreLift: 2,
      problem: `${titleTags.duplicate} pages share their title with at least one other page, most commonly colour and size variants of the same product.`,
      why: 'Identical titles make pages compete for the same query, so search engines pick one and the rest lose visibility.',
      recommendation: 'Add a distinguishing modifier — variant, use case or audience — so no two titles are identical.',
      evidence: ['/over-ear-headphones-2024', '/noise-cancelling-headphones', 'Same title detected on 16 pages'],
      details: { issueType: 'Duplicate', effort: 'Low' },
    },
    {
      auditId: latestAudit.id, pillar: 'seo', subPillar: 'title-tags', title: 'Titles longer than 60 characters',
      severity: 'medium', status: 'open', affectedCount: titleTags.tooLong, affectedLabel: 'pages', impact: 'Medium', scoreLift: 1,
      problem: `${titleTags.tooLong} titles exceed 60 characters and are truncated in search results.`,
      why: 'When a title truncates, the part that gets cut is usually the differentiator — the brand, the offer or the key spec.',
      recommendation: 'Front-load the primary keyword and trim each title to 60 characters or fewer.',
      evidence: ['/gaming-headset-pro-max-surround', '/home-theater-soundbar-5-1', '24 titles exceed the limit'],
      details: { issueType: 'Too Long', effort: 'Low' },
    },
    {
      auditId: latestAudit.id, pillar: 'seo', subPillar: 'title-tags', title: 'Titles shorter than 30 characters',
      severity: 'low', status: 'open', affectedCount: titleTags.tooShort, affectedLabel: 'pages', impact: 'Low', scoreLift: 1,
      problem: `${titleTags.tooShort} titles are under 30 characters and carry little keyword context.`,
      why: 'Short titles waste available snippet space and give search engines less to match a query against.',
      recommendation: 'Expand each title with the qualifier a shopper would actually search for.',
      evidence: ['/portable-speaker-mini', '/collections/new-arrivals', '12 titles are under the minimum'],
      details: { issueType: 'Too Short', effort: 'Low' },
    },
  ]);

  // ─── Every other sub-pillar: from the generated JSON ────────────────
  // (See header comment — generated from the frontend analysis sources.)
  let jsonScoreCount = 0;
  let jsonFindingCount = 0;
  for (const entry of subPillarSeed.entries) {
    await db.insert(auditScores).values({
      auditId: latestAudit.id,
      pillar: entry.pillar,
      subPillar: entry.subPillar,
      score: entry.score,
      analyzedCount: entry.analyzed,
      healthyCount: entry.healthy,
      details: {
        summary: entry.details.summary,
        healthChip: entry.details.healthChip,
        contextLabel: entry.details.contextLabel,
        contextValue: entry.details.contextValue,
        evidenceRows: entry.details.evidenceRows,
      },
    });
    jsonScoreCount += 1;

    if (entry.findings.length > 0) {
      await db.insert(findings).values(
        entry.findings.map((finding) => ({
          auditId: latestAudit.id,
          pillar: entry.pillar,
          subPillar: entry.subPillar,
          title: finding.title,
          severity: finding.severity,
          status: 'open',
          resolutionType: finding.resolutionType,
          affectedCount: finding.affectedCount,
          affectedLabel: finding.affectedLabel,
          impact: finding.impact,
          scoreLift: finding.scoreLift,
          problem: finding.problem,
          why: finding.why,
          recommendation: finding.recommendation,
          evidence: finding.evidence,
          details: finding.details,
        })),
      );
      jsonFindingCount += entry.findings.length;
    }
  }

  console.log(
    `[scorelo-db] seeded user ${user.id}, store ${store.id}, 6 integrations, 5 notifications, 6 audits, ` +
    `${11 + jsonScoreCount} audit_scores, ${4 + jsonFindingCount} findings (${jsonScoreCount} sub-pillars from subpillar-seed.json)`,
  );
}

/**
 * Refuse to run anywhere but development.
 *
 * Everything below writes `source: 'seed'` audits with invented scores, a store called
 * "My Shopify Store", and a demo login whose password is written in a comment in this file. On a
 * staging or production database that is not a convenience, it is fabricated audit data sitting
 * alongside real merchant data — exactly what every score in Scorelo is supposed never to be.
 *
 * The guard is deliberately opt-out-able (SEED_ALLOW_NON_DEV=true) for the rare case of
 * rebuilding a throwaway demo environment, but it must be a conscious act, not a typo away.
 */
function assertSeedingAllowed(): void {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (nodeEnv === 'development' || process.env.SEED_ALLOW_NON_DEV === 'true') return;
  console.error(
    `[scorelo-db] refusing to seed: NODE_ENV is '${nodeEnv}', not 'development'.\n` +
    '[scorelo-db] This script writes demo audits and a known-password demo user. Running it\n' +
    '[scorelo-db] outside development would mix fabricated results into real audit data.\n' +
    '[scorelo-db] Set SEED_ALLOW_NON_DEV=true only if you are certain this database is disposable.',
  );
  process.exitCode = 1;
}

try {
  assertSeedingAllowed();
  if (process.exitCode !== 1) await seed();
} catch (error) {
  console.error('[scorelo-db] seed failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
