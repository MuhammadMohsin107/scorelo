import { useEffect, useState } from 'react';
import { AlertCircle, Bell, CheckCircle2, FileText, TrendingUp, type LucideIcon } from 'lucide-react';
import { api } from '../lib/api';

/**
 * ─── Notification store ──────────────────────────────────────────────
 *
 * ONE state, shared by the header bell and the /notifications page.
 *
 * They used to hold separate copies: each fetched on mount and each mutated only its own array.
 * So marking everything read on the page left the bell still showing "5", and a notification
 * opened from the bell stayed bold on the page — two views of the same data disagreeing until a
 * full reload. Anything that changes notifications now goes through here, and every subscriber is
 * told at once.
 *
 * Three other things this fixes:
 *
 *   · A FAILED WRITE IS ROLLED BACK. Both views applied the change optimistically and then
 *     console.error'd the failure, so a rejected PATCH left the row looking read while the
 *     database still had it unread — the badge "fixed itself" back to the old number on the next
 *     reload with no explanation. The optimistic update now reverts and the error is surfaced.
 *   · THE BADGE COUNTS THE STORE, NOT THE PAGE. `unreadCount` comes from the server, so capping
 *     the list at 30 rows cannot make the bell under-report.
 *   · IT REFRESHES. Notifications are written by background work — an audit finishing, a sync
 *     failing — so a tab left open used to show a stale bell indefinitely.
 */

export interface NotificationRecord {
  id: number;
  type: string;
  title: string;
  message: string;
  tone: 'neutral' | 'success' | 'warning' | 'critical' | 'info';
  isRead: boolean;
  createdAt: string;
}

interface NotificationListResponse {
  items: NotificationRecord[];
  unreadCount: number;
  total: number;
}

export interface NotificationState {
  items: NotificationRecord[];
  /** Unread across the whole store — not a count of `items`. */
  unreadCount: number;
  total: number;
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** Set when a load or a write failed. Shown to the customer rather than only logged. */
  error: string | null;
}

const EMPTY: NotificationState = { items: [], unreadCount: 0, total: 0, status: 'idle', error: null };

/** How many rows the bell and the page show. The server caps this at 100. */
const PAGE_SIZE = 30;
/** Background work lands between page loads; a minute is frequent enough to feel live and rare
 * enough that an idle tab is not a load source. */
const POLL_MS = 60_000;

let state: NotificationState = EMPTY;
const listeners = new Set<(next: NotificationState) => void>();
let timer: number | null = null;

function set(patch: Partial<NotificationState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener(state));
}

export function getNotificationState(): NotificationState {
  return state;
}

export async function loadNotifications(): Promise<void> {
  if (state.status === 'idle') set({ status: 'loading' });
  try {
    const data = await api.get<NotificationListResponse>(`/notifications?limit=${PAGE_SIZE}`);
    set({ items: data.items, unreadCount: data.unreadCount, total: data.total, status: 'ready', error: null });
  } catch (error) {
    console.error('Failed to load notifications', error);
    // A failed refresh keeps whatever is already on screen: replacing real notifications with an
    // empty list because one poll failed would be worse than showing slightly stale ones.
    set({ status: state.items.length > 0 ? 'ready' : 'error', error: 'Notifications could not be loaded.' });
  }
}

export async function markNotificationRead(id: number): Promise<void> {
  const target = state.items.find((item) => item.id === id);
  if (!target || target.isRead) return;

  const previous = state;
  set({
    items: state.items.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
    unreadCount: Math.max(0, state.unreadCount - 1),
    error: null,
  });

  try {
    await api.patch<NotificationRecord>(`/notifications/${id}/read`);
  } catch (error) {
    console.error('Failed to mark notification read', error);
    set({ ...previous, error: 'That notification could not be marked as read.' });
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  if (state.unreadCount === 0) return;

  const previous = state;
  set({ items: state.items.map((item) => ({ ...item, isRead: true })), unreadCount: 0, error: null });

  try {
    await api.patch<NotificationRecord[]>('/notifications/read-all');
    // Re-read rather than trusting the local guess: rows beyond this page were also marked, and
    // the server's count is the one the badge should show.
    await loadNotifications();
  } catch (error) {
    console.error('Failed to mark all notifications read', error);
    set({ ...previous, error: 'Those notifications could not be marked as read.' });
  }
}

/** Drops everything on sign-out, so the next person in this tab never sees the previous one's. */
export function resetNotifications(): void {
  state = EMPTY;
  listeners.forEach((listener) => listener(state));
}

function startPolling() {
  if (timer !== null) return;
  timer = window.setInterval(() => {
    // A hidden tab is not being read; polling it spends the customer's battery and our capacity
    // to keep a badge current that nobody is looking at.
    if (document.visibilityState === 'visible') void loadNotifications();
  }, POLL_MS);
}

function stopPolling() {
  if (timer === null) return;
  window.clearInterval(timer);
  timer = null;
}

/** Refreshes the moment a tab is looked at again, so returning to it never shows a stale bell. */
function onVisible() {
  if (document.visibilityState === 'visible' && listeners.size > 0) void loadNotifications();
}

export function subscribeNotifications(listener: (next: NotificationState) => void): () => void {
  listeners.add(listener);
  listener(state);

  if (listeners.size === 1) {
    document.addEventListener('visibilitychange', onVisible);
    startPolling();
    void loadNotifications();
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      document.removeEventListener('visibilitychange', onVisible);
      stopPolling();
    }
  };
}

/** The one way a component reads notifications. Subscribing is what starts the polling. */
export function useNotifications(): NotificationState {
  const [current, setCurrent] = useState<NotificationState>(state);
  useEffect(() => subscribeNotifications(setCurrent), []);
  return current;
}

// ─── Presentation helpers ────────────────────────────────────────────

const iconByType: Record<string, LucideIcon> = {
  analysis_complete: CheckCircle2,
  critical_issue: AlertCircle,
  score_change: TrendingUp,
  integration_alert: AlertCircle,
  weekly_summary: FileText,
  product_update: Bell,
};

export function iconForNotification(type: string): LucideIcon {
  return iconByType[type] ?? Bell;
}

/**
 * Relative for the first week, then an actual date.
 *
 * "412 days ago" is arithmetic, not information — past about a week nobody counts days, and the
 * date is both shorter and more useful.
 */
export function formatNotificationTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';

  const diffMins = Math.floor((Date.now() - date.getTime()) / 60_000);
  // A clock that is a little behind the server must not produce "in 3 minutes".
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('en-US', sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
}
