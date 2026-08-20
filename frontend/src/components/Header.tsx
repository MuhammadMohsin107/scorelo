import { Menu, Bell, HelpCircle, ChevronDown, Store } from 'lucide-react';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-surface-200/50">
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
        <div className="flex items-center gap-1.5">
          {/* Help */}
          <button
            className="p-2 text-surface-400 hover:text-surface-700 hover:bg-surface-100 rounded-lg transition-colors active:scale-[0.98]"
            aria-label="Help and support"
          >
            <HelpCircle size={19} />
          </button>

          {/* Notifications */}
          <button
            className="relative p-2 text-surface-400 hover:text-surface-700 hover:bg-surface-100 rounded-lg transition-colors active:scale-[0.98]"
            aria-label="Notifications"
          >
            <Bell size={19} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-critical-500 rounded-full ring-2 ring-white shadow-sm" />
          </button>

          {/* Divider */}
          <div className="h-6 w-px bg-surface-200 mx-2 hidden sm:block" />

          {/* Profile Dropdown Trigger */}
          <button
            className="flex items-center gap-2 p-1.5 pr-2 rounded-lg hover:bg-surface-100 transition-colors active:scale-[0.98]"
            aria-label="Account menu"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-100 to-brand-50 border border-brand-200 flex items-center justify-center shadow-sm">
              <span className="text-brand-700 text-xs font-bold tracking-wide">JD</span>
            </div>
            <ChevronDown size={14} className="text-surface-400 hidden sm:block" />
          </button>
        </div>
      </div>
    </header>
  );
}
