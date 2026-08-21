import { useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, FileText, TrendingUp, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface NotificationItem {
  id: number;
  title: string;
  description: string;
  time: string;
  read: boolean;
  icon: LucideIcon;
}

const initialNotifications: NotificationItem[] = [
  { id: 1, title: 'SEO analysis completed', description: 'Your latest SEO analysis has finished successfully.', time: '10 min ago', read: false, icon: CheckCircle2 },
  { id: 2, title: 'Critical SEO issue detected', description: '8 canonical issues require attention.', time: '1 hour ago', read: false, icon: AlertCircle },
  { id: 3, title: 'Score improved', description: 'Your overall Scorelo score increased by 3 points.', time: 'Yesterday', read: true, icon: TrendingUp },
  { id: 4, title: 'Integration needs attention', description: 'Google Search Console requires reconnection.', time: 'Yesterday', read: false, icon: AlertCircle },
  { id: 5, title: 'Weekly report generated', description: 'Your weekly Store Performance report is ready.', time: '2 days ago', read: true, icon: FileText },
];

export default function Notifications() {
  const [notifications, setNotifications] = useState(initialNotifications);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const markAllRead = () => setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
  const markRead = (id: number) => setNotifications((current) => current.map((notification) => notification.id === id ? { ...notification, read: true } : notification));

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
            const Icon = notification.icon;
            return <button key={notification.id} type="button" onClick={() => markRead(notification.id)} className={`flex w-full gap-4 border-b border-surface-100 px-5 py-5 text-left transition-colors last:border-b-0 hover:bg-surface-50 ${notification.read ? 'bg-white' : 'bg-brand-50/40'}`}>
              <Icon size={19} className={`mt-0.5 flex-shrink-0 ${notification.read ? 'text-surface-400' : 'text-brand-600'}`} />
              <span className="min-w-0 flex-1"><span className={`block text-sm ${notification.read ? 'font-medium text-surface-700' : 'font-bold text-surface-900'}`}>{notification.title}</span><span className="mt-1 block text-sm leading-5 text-surface-500">{notification.description}</span><span className="mt-2 block text-xs text-surface-400">{notification.time}</span></span>
              {!notification.read && <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-brand-500" aria-label="Unread" />}
            </button>;
          })}
        </section>
      </div>
    </div>
  );
}