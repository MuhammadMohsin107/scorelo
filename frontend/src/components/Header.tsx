import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Bell, CheckCircle2, ChevronDown, FileText, Menu, Store, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface NotificationItem {
  id: number;
  title: string;
  description: string;
  time: string;
  read: boolean;
  icon: typeof CheckCircle2;
}

const initialNotifications: NotificationItem[] = [
  { id: 1, title: 'SEO analysis completed', description: 'Your latest SEO analysis has finished successfully.', time: '10 min ago', read: false, icon: CheckCircle2 },
  { id: 2, title: 'Critical SEO issue detected', description: '8 canonical issues require attention.', time: '1 hour ago', read: false, icon: AlertCircle },
  { id: 3, title: 'Score improved', description: 'Your overall Scorelo score increased by 3 points.', time: 'Yesterday', read: true, icon: TrendingUp },
  { id: 4, title: 'Integration needs attention', description: 'Google Search Console requires reconnection.', time: 'Yesterday', read: false, icon: AlertCircle },
  { id: 5, title: 'Weekly report generated', description: 'Your weekly Store Performance report is ready.', time: '2 days ago', read: true, icon: FileText },
];

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate();
  const headerRef = useRef<HTMLElement>(null);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [openMenu, setOpenMenu] = useState<'notifications' | 'profile' | null>(null);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) setOpenMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const toggleMenu = (menu: 'notifications' | 'profile') => {
    setOpenMenu((current) => (current === menu ? null : menu));
  };

  const markNotificationRead = (id: number) => {
    setNotifications((current) => current.map((notification) => notification.id === id ? { ...notification, read: true } : notification));
    setOpenMenu(null);
  };

  return (
    <header ref={headerRef} className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-surface-200/50">
      <div className="flex items-center justify-between h-16 px-6 lg:px-8">
        {/* Left: Mobile Menu + Page Context */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 text-surface-500 hover:text-surface-900 hover:bg-surface-100 rounded-lg transition-colors active:scale-[0.98]"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>

          {/* Store Selector - Clean, minimal button */}
          <button className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 text-sm font-semibold text-surface-800 bg-transparent hover:bg-surface-100 rounded-lg transition-colors group">
            <div className="w-6 h-6 rounded bg-surface-100 border border-surface-200 flex items-center justify-center text-surface-500 group-hover:bg-white group-hover:border-surface-300 transition-colors">
              <Store size={14} />
            </div>
            <span className="max-w-[160px] truncate">My Shopify Store</span>
            <ChevronDown size={14} className="text-surface-400" />
          </button>
        </div>

        {/* Right: Actions */}
        <div className="relative flex items-center gap-1.5">
          {/* Notifications */}
          <button
            onClick={() => toggleMenu('notifications')}
            aria-expanded={openMenu === 'notifications'}
            className="relative p-2 text-surface-400 hover:text-surface-700 hover:bg-surface-100 rounded-lg transition-colors active:scale-[0.98]"
            aria-label="Notifications"
          >
            <Bell size={19} />
            {unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">{unreadCount}</span>}
          </button>

          {openMenu === 'notifications' && (
            <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-xl" role="dialog" aria-label="Notifications">
              <div className="flex items-center justify-between border-b border-surface-200 px-4 py-3">
                <div><h2 className="text-sm font-bold text-surface-900">Notifications</h2><p className="mt-0.5 text-xs text-surface-500">{unreadCount} unread</p></div>
                <button type="button" onClick={() => setNotifications((current) => current.map((notification) => ({ ...notification, read: true })))} className="text-xs font-semibold text-brand-600 hover:text-brand-700">Mark all as read</button>
              </div>
              <div className="max-h-[min(420px,calc(100vh-9rem))] overflow-y-auto">
                {notifications.map((notification) => {
                  const Icon = notification.icon;
                  return <button type="button" key={notification.id} onClick={() => markNotificationRead(notification.id)} className={`flex w-full gap-3 border-b border-surface-100 px-4 py-3 text-left transition-colors hover:bg-surface-50 ${notification.read ? 'bg-white' : 'bg-brand-50/40'}`}>
                    <Icon size={17} className={`mt-0.5 flex-shrink-0 ${notification.read ? 'text-surface-400' : 'text-brand-600'}`} />
                    <span className="min-w-0 flex-1"><span className={`block text-xs ${notification.read ? 'font-medium text-surface-700' : 'font-bold text-surface-900'}`}>{notification.title}</span><span className="mt-1 block text-[11px] leading-4 text-surface-500">{notification.description}</span><span className="mt-1.5 block text-[10px] text-surface-400">{notification.time}</span></span>
                    {!notification.read && <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-500" aria-label="Unread" />}
                  </button>;
                })}
              </div>
              <div className="px-4 py-3 text-center"><button type="button" onClick={() => { navigate('/notifications'); setOpenMenu(null); }} className="text-xs font-semibold text-brand-600 hover:text-brand-700">View all notifications</button></div>
            </div>
          )}

          {/* Divider */}
          <div className="h-6 w-px bg-surface-200 mx-2 hidden sm:block" />

          {/* Profile Dropdown Trigger */}
          <button
            onClick={() => toggleMenu('profile')}
            aria-expanded={openMenu === 'profile'}
            className="flex items-center gap-2 p-1.5 pr-2 rounded-lg hover:bg-surface-100 transition-colors active:scale-[0.98]"
            aria-label="Account menu"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-100 to-brand-50 border border-brand-200 flex items-center justify-center shadow-sm">
              <span className="text-brand-700 text-xs font-bold tracking-wide">JD</span>
            </div>
            <ChevronDown size={14} className="text-surface-400 hidden sm:block" />
          </button>

          {openMenu === 'profile' && (
            <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-xl" role="menu" aria-label="Account menu">
              <div className="border-b border-surface-200 px-4 py-4"><p className="text-sm font-bold text-surface-900">John Doe</p><p className="mt-1 truncate text-xs text-surface-500">john.doe@myshopifystore.com</p><p className="mt-2 text-[11px] font-semibold text-surface-400">Administrator</p></div>
              <div className="p-1.5">
                <button type="button" onClick={() => { navigate('/settings/profile'); setOpenMenu(null); }} className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-surface-700 hover:bg-surface-100" role="menuitem">Profile</button>
                <button type="button" onClick={() => { navigate('/settings/workspace'); setOpenMenu(null); }} className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-surface-700 hover:bg-surface-100" role="menuitem">Workspace</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
