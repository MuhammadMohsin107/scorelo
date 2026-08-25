import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, LogOut, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Breadcrumbs from './Breadcrumbs';
import {
  fetchNotifications,
  formatNotificationTime,
  iconForNotification,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type NotificationRecord,
} from '../data/notifications';
import { fetchCurrentUser, initialsFor, subscribeCurrentUser } from '../data/user.repository';
import { useAuth } from '../context/AuthContext';
import type { UserRow } from '../data/api.types';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const headerRef = useRef<HTMLElement>(null);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [user, setUser] = useState<UserRow | null>(null);
  const [openMenu, setOpenMenu] = useState<'notifications' | 'profile' | null>(null);
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  useEffect(() => {
    fetchNotifications()
      .then(setNotifications)
      .catch((error) => console.error('Failed to load notifications', error));
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchCurrentUser()
      .then((current) => { if (mounted) setUser(current); })
      .catch((error) => console.error('Failed to load current user', error));
    const unsubscribe = subscribeCurrentUser((current) => { if (mounted) setUser(current); });
    return () => { mounted = false; unsubscribe(); };
  }, []);

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
    setNotifications((current) => current.map((notification) => notification.id === id ? { ...notification, isRead: true } : notification));
    setOpenMenu(null);
    markNotificationAsRead(id).catch((error) => console.error('Failed to mark notification read', error));
  };

  const markAllRead = () => {
    setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
    markAllNotificationsAsRead().catch((error) => console.error('Failed to mark all notifications read', error));
  };

  return (
    <header ref={headerRef} className="sticky top-0 z-30 border-b border-[#e8e5df] bg-[#f8f8f7]">
      <div className="flex h-16 items-center justify-between gap-4 px-5 lg:px-8">
        {/* Left: Mobile Menu + Page Context */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 text-surface-500 hover:text-surface-900 hover:bg-surface-100 rounded-lg transition-colors active:scale-[0.98]"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>

          <div className="min-w-0">
            <Breadcrumbs compact />
          </div>

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
                <button type="button" onClick={markAllRead} className="text-xs font-semibold text-brand-600 hover:text-brand-700">Mark all as read</button>
              </div>
              <div className="max-h-[min(420px,calc(100vh-9rem))] overflow-y-auto">
                {notifications.map((notification) => {
                  const Icon = iconForNotification(notification.type);
                  return <button type="button" key={notification.id} onClick={() => markNotificationRead(notification.id)} className={`flex w-full gap-3 border-b border-surface-100 px-4 py-3 text-left transition-colors hover:bg-surface-50 ${notification.isRead ? 'bg-white' : 'bg-brand-50/40'}`}>
                    <Icon size={17} className={`mt-0.5 flex-shrink-0 ${notification.isRead ? 'text-surface-400' : 'text-brand-600'}`} />
                    <span className="min-w-0 flex-1"><span className={`block text-xs ${notification.isRead ? 'font-medium text-surface-700' : 'font-bold text-surface-900'}`}>{notification.title}</span><span className="mt-1 block text-[11px] leading-4 text-surface-500">{notification.message}</span><span className="mt-1.5 block text-[10px] text-surface-400">{formatNotificationTime(notification.createdAt)}</span></span>
                    {!notification.isRead && <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-500" aria-label="Unread" />}
                  </button>;
                })}
              </div>
              <div className="px-4 py-3 text-center"><button type="button" onClick={() => setOpenMenu(null)} className="text-xs font-semibold text-brand-600 hover:text-brand-700">View all notifications</button></div>
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
              <span className="text-brand-700 text-xs font-bold tracking-wide">{user ? initialsFor(user.fullName) : '··'}</span>
            </div>
            <ChevronDown size={14} className="text-surface-400 hidden sm:block" />
          </button>

          {openMenu === 'profile' && (
            <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-xl" role="menu" aria-label="Account menu">
              <div className="border-b border-surface-200 px-4 py-4"><p className="text-sm font-bold text-surface-900">{user?.fullName ?? 'Loading…'}</p><p className="mt-1 truncate text-xs text-surface-500">{user?.email ?? ''}</p><p className="mt-2 text-[11px] font-semibold text-surface-400">{user?.role ?? ''}</p></div>
              <div className="p-1.5">
                <button type="button" onClick={() => { navigate('/settings/profile'); setOpenMenu(null); }} className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-surface-700 hover:bg-surface-100" role="menuitem">Profile</button>
                <button type="button" onClick={() => { navigate('/settings/workspace'); setOpenMenu(null); }} className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-surface-700 hover:bg-surface-100" role="menuitem">Workspace</button>
              </div>
              <div className="border-t border-surface-200 p-1.5">
                <button
                  type="button"
                  onClick={async () => { setOpenMenu(null); await logout(); navigate('/login', { replace: true }); }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-critical-600 hover:bg-critical-50"
                  role="menuitem"
                >
                  <LogOut size={15} strokeWidth={2} aria-hidden="true" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
