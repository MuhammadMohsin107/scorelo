import { AlertCircle, ArrowLeft, BellOff, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  formatNotificationTime,
  iconForNotification,
  markAllNotificationsRead,
  markNotificationRead,
  useNotifications,
} from '../data/notifications';

export default function Notifications() {
  // The same store the header bell reads. Marking something read here updates the badge in the
  // same tick — the two used to hold separate arrays and drift apart until a full reload.
  const { items, unreadCount, total, status, error } = useNotifications();

  return (
    <div className="min-h-full bg-surface-50">
      <div className="mx-auto max-w-3xl px-3.5 py-2.5 md:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <Link to="/" className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-600 hover:text-brand-700"><ArrowLeft size={14} /> Back to dashboard</Link>
            {/* Matches .page-title (17/18px) — this heading was the last 20px page title left. */}
            <h1 className="mt-1.5 page-title">Notifications</h1>
            <p className="page-subtitle">
              {unreadCount} unread{total > items.length && ` · showing the latest ${items.length} of ${total}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void markAllNotificationsRead()}
            disabled={unreadCount === 0}
            className="btn-secondary btn-xs"
          >
            Mark all as read
          </button>
        </div>

        {/* A rolled-back write says so. Previously both handlers applied the change optimistically
            and console.error'd the failure, so a rejected request left a row looking read while
            the database still had it unread. */}
        {error && (
          <div role="alert" className="mt-2 flex items-start gap-2 rounded-lg border border-critical-100 bg-critical-50 px-2.5 py-2">
            <AlertCircle size={14} className="mt-px flex-shrink-0 text-critical-600" aria-hidden="true" />
            <p className="text-[11.5px] leading-[1.4] text-critical-700">{error}</p>
          </div>
        )}

        <section className="mt-2 overflow-hidden rounded-lg border border-surface-200 bg-surface-0" aria-label="All notifications">
          {status === 'loading' && items.length === 0 && (
            <p className="flex items-center justify-center gap-2 px-3 py-8 text-[12px] text-surface-500">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              Loading notifications…
            </p>
          )}

          {/* Notifications are written only by events that happened — a finished or failed audit,
              a failed sync, an expired token, an uninstall. An empty list is therefore a real
              state, not a loading gap, and it says what would put something here. */}
          {status !== 'loading' && items.length === 0 && (
            <div className="px-3 py-8 text-center">
              <BellOff size={18} className="mx-auto text-surface-300" aria-hidden="true" />
              <p className="mt-2 text-[12.5px] font-medium text-surface-700">No notifications yet</p>
              <p className="mt-1 text-[11.5px] leading-[1.45] text-surface-500">
                Scorelo will tell you here when an audit finishes, when a pillar score moves, or when your store connection needs attention.
              </p>
            </div>
          )}

          {items.map((notification) => {
            const Icon = iconForNotification(notification.type);
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => void markNotificationRead(notification.id)}
                disabled={notification.isRead}
                className={`flex w-full gap-2.5 border-b border-surface-100 px-3 py-2 text-left transition-colors last:border-b-0 enabled:hover:bg-surface-50 disabled:cursor-default ${notification.isRead ? 'bg-surface-0' : 'bg-brand-50/40'}`}
              >
                <Icon size={16} className={`mt-0.5 flex-shrink-0 ${notification.isRead ? 'text-surface-400' : 'text-brand-600'}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block text-[12.5px] ${notification.isRead ? 'font-medium text-surface-700' : 'font-bold text-surface-900'}`}>{notification.title}</span>
                  <span className="mt-0.5 block text-[11.5px] leading-[1.4] text-surface-500">{notification.message}</span>
                  <span className="mt-1 block text-[11px] text-surface-400">{formatNotificationTime(notification.createdAt)}</span>
                </span>
                {!notification.isRead && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-brand-500" aria-label="Unread" />}
              </button>
            );
          })}
        </section>
      </div>
    </div>
  );
}
