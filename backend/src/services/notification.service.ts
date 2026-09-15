import { and, count, desc, eq, gt, inArray, isNull, lt } from 'drizzle-orm';
import { db } from '../db/client.js';
import { insertReturning, updateReturning } from '../db/returning.js';
import { auditScores, audits, findings, notifications, stores, users } from '../db/schema.js';
import { ApiError } from '../middleware/error.js';
import { pillarLabel } from '../lib/report-labels.js';
import { getCurrentStoreId } from './store.service.js';

/**
 * ─── Writing notifications ───────────────────────────────────────────
 *
 * Two things belong in the bell.
 *
 * FIRST, anything that happened WHILE THE MERCHANT WAS NOT LOOKING — an uninstall, an expired
 * token, a failed background sync, a finished audit. None of them is visible until somebody
 * thinks to go looking, so without a notification they are simply not reported.
 *
 * SECOND, the milestones in a store's integration history, even ones the merchant watched happen.
 * A successful Shopify connection is the example: the Integrations banner announces it once and
 * is gone on the next navigation, which leaves the bell holding only the failures — an expired
 * token and an uninstall, with nothing saying when the connection they refer to began. Recording
 * the connect is what makes that history readable as one thread rather than a list of complaints.
 *
 * What still does NOT belong: state that is permanently on screen anyway. The connection BADGE on
 * Integrations is not duplicated here; the moment it changed is.
 */

/**
 * Which user preference gates which notification type.
 *
 * These columns already existed on `users` and were already editable in Settings — and were read
 * by nothing at all, so every toggle was decorative. They gate real writes now, which is what
 * makes them settings rather than switches.
 */
const PREFERENCE_BY_TYPE = {
  analysis_complete: 'notifyAnalysisComplete',
  critical_issue: 'notifyCriticalIssues',
  score_change: 'notifyScoreChanges',
  weekly_summary: 'notifyWeeklySummary',
  integration_alert: 'notifyIntegrationAlerts',
  product_update: 'notifyProductUpdates',
} as const;

export type NotificationType = keyof typeof PREFERENCE_BY_TYPE;
export type NotificationTone = 'neutral' | 'success' | 'warning' | 'critical' | 'info';

export interface CreateNotificationInput {
  storeId: number;
  type: NotificationType;
  title: string;
  message: string;
  tone?: NotificationTone;
  /**
   * Suppresses a duplicate of the same type for this store within the given minutes.
   *
   * A revoked token is discovered by every audit, every sync and every page load that touches
   * Shopify — without this, one expired token would bury the bell under identical rows saying the
   * same thing. The merchant needs to be told once.
   */
  dedupeMinutes?: number;
}

/**
 * Records one notification, or returns null when it was suppressed.
 *
 * NEVER THROWS. This is called from webhook handlers and from the audit worker, where the event
 * being recorded is not the caller's actual job: a notification that could not be written must not
 * fail an uninstall webhook or roll back a completed audit. Failures are logged and swallowed.
 */
/**
 * Whether the store's owner has this notification type switched on.
 *
 * False when the store has no owner. Not an error — a store row can outlive its user during a
 * deletion cascade, and the webhook that triggered the notification still has to return 200.
 */
async function ownerWants(storeId: number, type: NotificationType): Promise<boolean> {
  const [owner] = await db
    .select({
      notifyAnalysisComplete: users.notifyAnalysisComplete,
      notifyCriticalIssues: users.notifyCriticalIssues,
      notifyScoreChanges: users.notifyScoreChanges,
      notifyWeeklySummary: users.notifyWeeklySummary,
      notifyIntegrationAlerts: users.notifyIntegrationAlerts,
      notifyProductUpdates: users.notifyProductUpdates,
    })
    .from(stores)
    .innerJoin(users, eq(stores.ownerId, users.id))
    .where(eq(stores.id, storeId))
    .limit(1);

  return Boolean(owner && owner[PREFERENCE_BY_TYPE[type]]);
}

export async function createNotification(input: CreateNotificationInput): Promise<typeof notifications.$inferSelect | null> {
  try {
    if (!(await ownerWants(input.storeId, input.type))) return null;

    if (input.dedupeMinutes && input.dedupeMinutes > 0) {
      const since = new Date(Date.now() - input.dedupeMinutes * 60_000);
      const [recent] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(and(
          eq(notifications.storeId, input.storeId),
          eq(notifications.type, input.type),
          gt(notifications.createdAt, since),
        ))
        .limit(1);
      if (recent) return null;
    }

    return await insertReturning(notifications, {
      storeId: input.storeId,
      type: input.type,
      title: input.title,
      message: input.message,
      tone: input.tone ?? 'info',
    });
  } catch (error) {
    console.warn(`[scorelo-api] notification not recorded (${input.type}): ${error instanceof Error ? error.message : 'unknown error'}`);
    return null;
  }
}

/**
 * The movement a pillar has to make before it is worth interrupting someone about.
 *
 * 5 points is not an arbitrary threshold: Settings promises "when any pillar score moves by more
 * than 5 points between audits", so the rule and the sentence describing it are the same number.
 */
const SCORE_CHANGE_THRESHOLD = 5;

/**
 * Compares the audit just written against the one before it and reports the largest pillar move.
 *
 * This is the write that made `notifyScoreChanges` a real preference. The column existed, Settings
 * offered the toggle and described exactly this behaviour — and nothing anywhere created a
 * `score_change` notification, so the switch had no effect in either position.
 *
 * A pillar that was not measured in either audit is skipped rather than treated as a move from
 * zero: "not measured" becoming "62" is not an improvement of 62 points.
 *
 * Never throws — it runs at the end of a completed audit and must not fail one.
 */
export async function notifyScoreMovement(storeId: number, auditId: number): Promise<void> {
  try {
    const [previous] = await db
      .select({ id: audits.id })
      .from(audits)
      .where(and(eq(audits.storeId, storeId), lt(audits.id, auditId)))
      .orderBy(desc(audits.id))
      .limit(1);
    // A store's first audit has nothing to compare against. Silence is the correct output.
    if (!previous) return;

    const [current, before] = await Promise.all([
      db.select().from(auditScores).where(and(eq(auditScores.auditId, auditId), isNull(auditScores.subPillar))),
      db.select().from(auditScores).where(and(eq(auditScores.auditId, previous.id), isNull(auditScores.subPillar))),
    ]);

    const measured = (row: typeof auditScores.$inferSelect | undefined) =>
      Boolean(row) && (row!.details as { status?: string } | null)?.status !== 'unavailable';

    let biggest: { pillar: string; from: number; to: number; delta: number } | null = null;
    for (const row of current) {
      const match = before.find((other) => other.pillar === row.pillar);
      if (!measured(row) || !measured(match)) continue;
      const delta = row.score - match!.score;
      if (Math.abs(delta) <= SCORE_CHANGE_THRESHOLD) continue;
      if (!biggest || Math.abs(delta) > Math.abs(biggest.delta)) {
        biggest = { pillar: row.pillar, from: match!.score, to: row.score, delta };
      }
    }

    if (!biggest) return;

    const label = pillarLabel(biggest.pillar);
    const improved = biggest.delta > 0;
    await createNotification({
      storeId,
      type: 'score_change',
      title: `${label} ${improved ? 'improved' : 'dropped'} by ${Math.abs(biggest.delta)} points`,
      // Both numbers, not just the delta: "dropped 8 points" reads very differently at 91→83
      // than at 30→22, and the merchant should not have to open the app to find out which.
      message: `${label} moved from ${biggest.from} to ${biggest.to} since the previous audit. Open the pillar to see which checks changed.`,
      tone: improved ? 'success' : 'warning',
    });
  } catch (error) {
    console.warn(`[scorelo-api] score-change notification not evaluated: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

// ─── What an audit tells the bell ────────────────────────────────────
//
// THE BUG THIS REPLACES. Every finished audit inserted "Store analysis finished", plus "N critical
// issues found" whenever any critical finding existed — unconditionally. Nothing asked whether an
// unread notice saying the same thing was already in the bell, or whether those critical issues
// were the very ones already reported. So every press of Refresh, every "Run an audit" and every
// scheduled run stacked another identical unread pair, and a merchant re-analysing a store they
// had not changed was told the same two things again each time.
//
// THE RULE NOW: one live (unread) notice per kind.
//   • Analysis finished — a newer completion updates the unread notice already there, rather than
//     adding a second one beside it. Once read, the next completion is genuinely new and is added.
//   • Critical issues — announced when an audit finds critical issues the previous audit did not
//     have. Issues that were already reported are not re-announced; an unread notice about them is
//     kept current instead. When an audit finds no critical issues at all, any unread notice
//     claiming otherwise is marked read — it is no longer true.
//
// Superseded notices are MARKED READ, never deleted: they stay in the history on /notifications.

/** A critical finding, reduced to what identifies it from one audit to the next. */
export interface CriticalFindingRef {
  pillar: string;
  subPillar: string;
  title: string;
}

/**
 * Identifies the same critical finding across audits: same pillar, same sub-pillar, same title.
 *
 * Finding titles are templates that name the problem rather than a count ("Products with no
 * description"), so the title stays stable while the number of affected items changes — which is
 * exactly the case that must not be re-announced as a new issue.
 */
export function criticalFindingKey(finding: CriticalFindingRef): string {
  return `${finding.pillar}|${finding.subPillar}|${finding.title.trim().toLowerCase()}`;
}

/** Critical findings in `current` that were not critical in `previous`, each counted once. */
export function newCriticalFindings(current: CriticalFindingRef[], previous: CriticalFindingRef[]): CriticalFindingRef[] {
  const before = new Set(previous.map(criticalFindingKey));
  const seen = new Set<string>();
  return current.filter((finding) => {
    const key = criticalFindingKey(finding);
    if (before.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type CriticalNoticeAction = 'none' | 'resolve' | 'refresh' | 'create';

/**
 * What an audit does to the critical-issue notice. Pure, so the whole rule is tested directly.
 *
 *   resolve  no critical issues now, and an unread notice still says there are
 *   refresh  critical issues now, and an unread notice exists — keep that one current
 *   create   critical issues the merchant has not been told about, and nothing unread to update
 *   none     nothing new to say, or nothing to correct
 */
export function planCriticalNotice(input: { currentCount: number; newCount: number; hasUnreadNotice: boolean }): CriticalNoticeAction {
  if (input.currentCount === 0) return input.hasUnreadNotice ? 'resolve' : 'none';
  if (input.hasUnreadNotice) return 'refresh';
  return input.newCount > 0 ? 'create' : 'none';
}

/** The wording for a critical-issue notice, from the real counts. */
export function criticalNoticeCopy(currentCount: number, newCount: number): { title: string; message: string } {
  const issues = (n: number) => `${n} critical ${n === 1 ? 'issue' : 'issues'}`;

  if (newCount === 0) {
    return {
      title: `${issues(currentCount)} still open`,
      message: 'The latest audit still finds these critical issues. Open Fix Center to review them.',
    };
  }
  if (newCount >= currentCount) {
    return {
      title: `${issues(currentCount)} found`,
      message: 'The latest audit found issues marked critical. Open Fix Center to review them.',
    };
  }
  return {
    title: `${newCount} new critical ${newCount === 1 ? 'issue' : 'issues'} found`,
    message: `The latest audit found ${issues(newCount)} that ${newCount === 1 ? 'was' : 'were'} not in the previous audit — ${currentCount} critical in total. Open Fix Center to review them.`,
  };
}

export interface AuditOutcomeSummary {
  auditId: number;
  pillarCount: number;
  findingCount: number;
  critical: CriticalFindingRef[];
}

/** Unread notices of one type for a store, newest first. */
async function unreadOfType(storeId: number, type: NotificationType) {
  return db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.storeId, storeId), eq(notifications.type, type), eq(notifications.isRead, false)))
    .orderBy(desc(notifications.createdAt), desc(notifications.id));
}

async function markIdsRead(ids: number[]): Promise<void> {
  if (ids.length > 0) await db.update(notifications).set({ isRead: true }).where(inArray(notifications.id, ids));
}

/** The critical findings of the store's previous real audit. A seeded fixture is not a previous
 * analysis of this store, so only engine audits count. */
async function previousAuditCriticalFindings(storeId: number, auditId: number): Promise<CriticalFindingRef[]> {
  const [previous] = await db
    .select({ id: audits.id })
    .from(audits)
    .where(and(eq(audits.storeId, storeId), eq(audits.source, 'engine'), lt(audits.id, auditId)))
    .orderBy(desc(audits.id))
    .limit(1);
  if (!previous) return [];

  return db
    .select({ pillar: findings.pillar, subPillar: findings.subPillar, title: findings.title })
    .from(findings)
    .where(and(eq(findings.auditId, previous.id), eq(findings.severity, 'critical')));
}

async function recordAnalysisComplete(storeId: number, outcome: AuditOutcomeSummary): Promise<void> {
  if (!(await ownerWants(storeId, 'analysis_complete'))) return;

  const title = 'Store analysis finished';
  const message = `Scorelo checked ${outcome.pillarCount} ${outcome.pillarCount === 1 ? 'pillar' : 'pillars'} and recorded ${outcome.findingCount} ${outcome.findingCount === 1 ? 'finding' : 'findings'}.`;

  const [latest, ...older] = await unreadOfType(storeId, 'analysis_complete');
  if (!latest) {
    await insertReturning(notifications, { storeId, type: 'analysis_complete', title, message, tone: 'success' });
    return;
  }

  // The unread notice now describes this run — moved to the top, because this run is what just
  // finished. Any older unread duplicates, left by the previous behaviour, are folded into it.
  await db
    .update(notifications)
    .set({ title, message, tone: 'success', createdAt: new Date() })
    .where(eq(notifications.id, latest.id));
  await markIdsRead(older.map((row) => row.id));
}

async function recordCriticalIssues(storeId: number, outcome: AuditOutcomeSummary): Promise<void> {
  const currentCount = new Set(outcome.critical.map(criticalFindingKey)).size;
  const fresh = newCriticalFindings(outcome.critical, await previousAuditCriticalFindings(storeId, outcome.auditId));
  const unread = await unreadOfType(storeId, 'critical_issue');
  const action = planCriticalNotice({ currentCount, newCount: fresh.length, hasUnreadNotice: unread.length > 0 });

  if (action === 'none') return;

  // Applied whatever the preference: a notice claiming critical issues that no longer exist is
  // wrong, and correcting it is not sending anything new.
  if (action === 'resolve') {
    await markIdsRead(unread.map((row) => row.id));
    return;
  }

  if (!(await ownerWants(storeId, 'critical_issue'))) return;

  const { title, message } = criticalNoticeCopy(currentCount, fresh.length);

  if (action === 'create') {
    await insertReturning(notifications, { storeId, type: 'critical_issue', title, message, tone: 'critical' });
    return;
  }

  // refresh: the unread notice is brought up to date. It moves to the top only when there is
  // something genuinely new in it — the same open issues are not news.
  const [latest, ...older] = unread;
  await db
    .update(notifications)
    .set({ title, message, tone: 'critical', ...(fresh.length > 0 ? { createdAt: new Date() } : {}) })
    .where(eq(notifications.id, latest.id));
  await markIdsRead(older.map((row) => row.id));
}

/**
 * Records what a completed audit means for the bell. See the section header for the rules.
 *
 * Never throws — it runs at the end of a completed audit and must not fail one. The two notices are
 * independent, so a failure in one does not stop the other.
 */
export async function notifyAuditOutcome(storeId: number, outcome: AuditOutcomeSummary): Promise<void> {
  try {
    await recordAnalysisComplete(storeId, outcome);
  } catch (error) {
    console.warn(`[scorelo-api] analysis-complete notification not recorded: ${error instanceof Error ? error.message : 'unknown error'}`);
  }

  try {
    await recordCriticalIssues(storeId, outcome);
  } catch (error) {
    console.warn(`[scorelo-api] critical-issue notification not recorded: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

export interface NotificationList {
  items: Array<typeof notifications.$inferSelect>;
  /** Unread across the WHOLE store, not just the page returned — this drives the bell badge. */
  unreadCount: number;
  total: number;
}

/**
 * The recent notifications plus the store's real unread and total counts.
 *
 * The counts are separate queries on purpose. This used to return every row the store had ever
 * received and let the browser count the unread ones, which meant the list grew without limit and
 * — the moment a limit was added — the badge would have counted only what fitted on the page.
 */
export async function listNotifications(
  userId: number,
  query: { limit: number },
  storeId?: number,
): Promise<NotificationList> {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  const forStore = eq(notifications.storeId, resolvedStoreId);

  const [items, [unread], [all]] = await Promise.all([
    db.select().from(notifications).where(forStore).orderBy(desc(notifications.createdAt)).limit(query.limit),
    db.select({ value: count() }).from(notifications).where(and(forStore, eq(notifications.isRead, false))),
    db.select({ value: count() }).from(notifications).where(forStore),
  ]);

  return { items, unreadCount: unread?.value ?? 0, total: all?.value ?? 0 };
}

export async function markNotificationRead(userId: number, id: number, storeId?: number) {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);

  const [notification] = await updateReturning(
    notifications,
    { isRead: true },
    and(eq(notifications.id, id), eq(notifications.storeId, resolvedStoreId)),
  );

  if (!notification) {
    throw new ApiError(404, 'Notification not found', 'NOTIFICATION_NOT_FOUND');
  }

  return notification;
}

/**
 * Removes one notification for good.
 *
 * Deliberately separate from "read". Reading something is a statement about attention; deleting
 * it is a statement about the record. Collapsing the two would mean a merchant who glanced at
 * "Store analysis could not finish" could never look at it again.
 */
export async function deleteNotification(userId: number, id: number, storeId?: number) {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);

  const [notification] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.storeId, resolvedStoreId)))
    .limit(1);
  // Checked before deleting so a caller aiming at another store's row gets 404 rather than a
  // silent success that deleted nothing.
  if (!notification) throw new ApiError(404, 'Notification not found', 'NOTIFICATION_NOT_FOUND');

  await db.delete(notifications).where(and(eq(notifications.id, id), eq(notifications.storeId, resolvedStoreId)));
  return { id };
}

/** Clears everything already read. Unread rows are never touched — the merchant has not seen them. */
export async function clearReadNotifications(userId: number, storeId?: number) {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  const where = and(eq(notifications.storeId, resolvedStoreId), eq(notifications.isRead, true));

  const rows = await db.select({ id: notifications.id }).from(notifications).where(where);
  if (rows.length > 0) await db.delete(notifications).where(where);
  return { deleted: rows.length };
}

export async function markAllNotificationsRead(userId: number, storeId?: number) {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);

  // updateReturning captures the matching ids before writing — essential here, where the
  // update flips the very column the predicate tests.
  return updateReturning(
    notifications,
    { isRead: true },
    and(eq(notifications.storeId, resolvedStoreId), eq(notifications.isRead, false)),
  );
}
