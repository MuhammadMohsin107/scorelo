import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
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
      <div className="mx-auto max-w-3xl px-5 py-8 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700"><ArrowLeft size={14} /> Back to dashboard</Link>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-surface-950">Notifications</h1>
            <p className="mt-1 text-sm text-surface-600">{unreadCount} unread notification{unreadCount === 1 ? '' : 's'}</p>
          </div>
          <button type="button" onClick={markAllRead} disabled={unreadCount === 0} className="btn-secondary text-xs">Mark all as read</button>
        </div>

        <section className="mt-6 overflow-hidden rounded-2xl border border-surface-200 bg-white" aria-label="All notifications">
          {notifications.map((notification) => {
            const Icon = iconForNotification(notification.type);
            return <button key={notification.id} type="button" onClick={() => markRead(notification.id)} className={`flex w-full gap-4 border-b border-surface-100 px-5 py-5 text-left transition-colors last:border-b-0 hover:bg-surface-50 ${notification.isRead ? 'bg-white' : 'bg-brand-50/40'}`}>
              <Icon size={19} className={`mt-0.5 flex-shrink-0 ${notification.isRead ? 'text-surface-400' : 'text-brand-600'}`} />
              <span className="min-w-0 flex-1"><span className={`block text-sm ${notification.isRead ? 'font-medium text-surface-700' : 'font-bold text-surface-900'}`}>{notification.title}</span><span className="mt-1 block text-sm leading-5 text-surface-500">{notification.message}</span><span className="mt-2 block text-xs text-surface-400">{formatNotificationTime(notification.createdAt)}</span></span>
              {!notification.isRead && <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-brand-500" aria-label="Unread" />}
            </button>;
          })}
        </section>
      </div>
    </div>
  );
}