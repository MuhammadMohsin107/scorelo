import type { ReactNode } from 'react';
import { Search } from 'lucide-react';

interface Props {
  title: string;
  subtitle?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: string[];
  activeFilter?: string;
  onFilterChange?: (filter: string) => void;
  children: ReactNode;
}

/** Shared table wrapper (title + search + filter pills) used by every pillar sub-page. */
export default function PillarTableCard({
  title,
  subtitle,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters,
  activeFilter,
  onFilterChange,
  children,
}: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)]">
      <div className="border-b border-surface-200 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-600">Detailed analysis</div>
            <h2 className="text-lg font-bold tracking-tight text-surface-900">{title}</h2>
          </div>
          {subtitle && <p className="text-xs text-surface-500">{subtitle}</p>}
        </div>
        {(onSearchChange || filters) && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            {onSearchChange && (
              <label className="relative block flex-1">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <span className="sr-only">Search table</span>
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-lg border border-surface-200 bg-surface-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
                />
              </label>
            )}
            {filters && filters.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {filters.map((f) => (
                  <button
                    key={f}
                    onClick={() => onFilterChange?.(f)}
                    className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                      activeFilter === f
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'border border-surface-200 text-surface-600 hover:bg-surface-50'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
