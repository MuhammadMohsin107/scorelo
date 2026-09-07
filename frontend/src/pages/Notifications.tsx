import { useEffect, useState } from 'react';
import { ArrowLeft, BellOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  fetchNotifications,
  formatNotificationTime,
  iconForNotification,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type NotificationRecord,
} from '../data/notifications';

export default function Notifications() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  useEffect(() => {
    fetchNotifications()
      .then(setNotifications)
      .catch((error) => console.error('Failed to load notifications', error));
  }, []);

  const markAllRead = () => {
    setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
    markAllNotificationsAsRead().catch((error) => console.error('Failed to mark all notifications read', error));
  };
  const markRead = (id: number) => {
    setNotifications((current) => current.map((notification) => notification.id === id ? { ...notification, isRead: true } : notification));
    markNotificationAsRead(id).catch((error) => console.error('Failed to mark notification read', error));
  };

  return (
    <div className="min-h-full bg-surface-50">
      <div className="mx-auto max-w-3xl px-3.5 py-2.5 md:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <Link to="/" className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-600 hover:text-brand-700"><ArrowLeft size={14} /> Back to dashboard</Link>
            <h1 className="mt-2.5 text-[20px] font-semibold tracking-tight text-surface-950">Notifications</h1>
            <p className="mt-1 text-[12.5px] text-surface-600">{unreadCount} unread notification{unreadCount === 1 ? '' : 's'}</p>
          </div>
          <button type="button" onClick={markAllRead} disabled={unreadCount === 0} className="btn-secondary text-[11.5px]">Mark all as read</button>
        </div>

        <section className="mt-2 overflow-hidden rounded-lg border border-surface-200 bg-surface-0" aria-label="All notifications">
          {/* Notifications are written only by events that happened — a finished or failed audit,
              a failed sync, an expired token, an uninstall. An empty list is therefore a real
              state, not a loading gap, and it says what would put something here. */}
          {notifications.length === 0 && (
            <div className="px-3.5 py-8 text-center">
              <BellOff size={18} className="mx-auto text-surface-300" aria-hidden="true" />
              <p className="mt-2 text-[12.5px] font-medium text-surface-700">No notifications yet</p>
              <p className="mt-1 text-[11.5px] leading-[1.45] text-surface-500">
                Scorelo will tell you here when an audit finishes, or when your store connection needs attention.
              </p>
            </div>
          )}
          {notifications.map((notification) => {
            const Icon = iconForNotification(notification.type);
            return <button key={notification.id} type="button" onClick={() => markRead(notification.id)} className={`flex w-full gap-2.5 border-b border-surface-100 px-3.5 py-2.5 text-left transition-colors last:border-b-0 hover:bg-surface-50 ${notification.isRead ? 'bg-surface-0' : 'bg-brand-50/40'}`}>
              <Icon size={19} className={`mt-0.5 flex-shrink-0 ${notification.isRead ? 'text-surface-400' : 'text-brand-600'}`} />
              <span className="min-w-0 flex-1"><span className={`block text-[12.5px] ${notification.isRead ? 'font-medium text-surface-700' : 'font-bold text-surface-900'}`}>{notification.title}</span><span className="mt-1 block text-[12.5px] leading-[1.4] text-surface-500">{notification.message}</span><span className="mt-2 block text-[11.5px] text-surface-400">{formatNotificationTime(notification.createdAt)}</span></span>
              {!notification.isRead && <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-brand-500" aria-label="Unread" />}
            </button>;
          })}
        </section>
      </div>
    </div>
  );
}