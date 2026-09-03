import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Bell, ChevronDown, LogOut, Menu, Moon, Search, Sun, X } from 'lucide-react';
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
import { useTheme } from '../context/ThemeContext';
import type { UserRow } from '../data/api.types';

interface HeaderProps {
  onMenuClick: () => void;
  /**
   * Where a submitted query goes.
   *
   * THE SEAM. This component renders the control and owns nothing else — no results, no fetch, no
   * cached list. When search is built, it is wired here and the header does not change. Left
   * optional so the field is usable (and testable) before that endpoint exists, rather than
   * shipping a dropdown of invented matches to make the feature look finished.
   */
  onSearch?: (query: string) => void;
}

export default function Header({ onMenuClick, onSearch }: HeaderProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { theme, toggle } = useTheme();
  const headerRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [user, setUser] = useState<UserRow | null>(null);
  const [openMenu, setOpenMenu] = useState<'notifications' | 'profile' | null>(null);
  const [query, setQuery] = useState('');
  /** Phone only: whether the icon has expanded into the field. Irrelevant from `sm` up, where the
   * field is always present. */
  const [searchOpen, setSearchOpen] = useState(false);
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    // No handler yet means no search backend yet. Doing nothing is correct — the alternative is
    // pretending to search and showing nothing, which reads as a broken feature rather than an
    // unbuilt one.
    onSearch?.(trimmed);
  };

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
    <header ref={headerRef} className="sticky top-0 z-30 border-b border-chrome-border bg-chrome">
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

        {/* Right: Search + Actions */}
        <div className="relative flex items-center gap-1.5">
          {/*
            Search.
            Two presentations of ONE control, not two controls: a field from `sm` up, and an icon
            below it that expands into the same field. A 300px input cannot share a 16px-tall bar
            with the breadcrumb, the bell and the avatar on a phone, and shrinking it to fit would
            leave something too small to type into.

            NO RESULTS ARE RENDERED HERE. `onSearch` is the seam: it receives the submitted query
            and nothing else, so wiring it to the real endpoint later is one prop, not a rewrite of
            this component. Inventing a results dropdown now would mean shipping a list with
            nothing behind it.
          */}
          <form
            role="search"
            onSubmit={handleSearchSubmit}
            className={`items-center ${searchOpen ? 'flex' : 'hidden'} sm:flex`}
          >
            <label htmlFor="header-search" className="sr-only">
              Search Scorelo
            </label>
            <div className="relative">
              <Search
                size={15}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"
              />
              <input
                ref={searchRef}
                id="header-search"
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onBlur={() => { if (!query) setSearchOpen(false); }}
                placeholder="Search…"
                autoComplete="off"
                className="h-9 w-[180px] rounded-lg border border-chrome-border bg-surface-0 pl-8 pr-8 text-sm text-surface-900 outline-none transition-[width,border-color,box-shadow] duration-200 placeholder:text-surface-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 md:w-[240px] md:focus:w-[300px]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); searchRef.current?.focus(); }}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-700"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </form>

          {/* Phone: the same search, collapsed to its icon. */}
          <button
            type="button"
            onClick={() => { setSearchOpen(true); window.requestAnimationFrame(() => searchRef.current?.focus()); }}
            aria-label="Search"
            aria-expanded={searchOpen}
            className={`cursor-pointer rounded-lg p-2 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-700 active:scale-[0.98] sm:hidden ${searchOpen ? 'hidden' : ''}`}
          >
            <Search size={19} />
          </button>

          {/* Theme. One button cycling light → dark, reading its label from what is on screen so
              it says what it will DO, not what it currently is. */}
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="cursor-pointer rounded-lg p-2 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-700 active:scale-[0.98]"
          >
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>

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
            <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-surface-200 bg-surface-0 shadow-xl" role="dialog" aria-label="Notifications">
              <div className="flex items-center justify-between border-b border-surface-200 px-4 py-3">
                <div><h2 className="text-sm font-bold text-surface-900">Notifications</h2><p className="mt-0.5 text-xs text-surface-500">{unreadCount} unread</p></div>
                <button type="button" onClick={markAllRead} className="text-xs font-semibold text-brand-600 hover:text-brand-700">Mark all as read</button>
              </div>
              <div className="max-h-[min(420px,calc(100vh-9rem))] overflow-y-auto">
                {notifications.map((notification) => {
                  const Icon = iconForNotification(notification.type);
                  return <button type="button" key={notification.id} onClick={() => markNotificationRead(notification.id)} className={`flex w-full gap-3 border-b border-surface-100 px-4 py-3 text-left transition-colors hover:bg-surface-50 ${notification.isRead ? 'bg-surface-0' : 'bg-brand-50/40'}`}>
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
            <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-surface-200 bg-surface-0 shadow-xl" role="menu" aria-label="Account menu">
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
