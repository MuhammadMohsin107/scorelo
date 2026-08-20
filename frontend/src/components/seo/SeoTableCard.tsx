import type { ReactNode } from 'react';

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

export default function SeoTableCard({
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
    <div className="bg-white border border-surface-200 rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-surface-200">
        <h2 className="text-lg font-bold text-surface-900 mb-1">{title}</h2>
        {subtitle && <p className="text-xs text-surface-500 mb-3">{subtitle}</p>}
        {(onSearchChange || filters) && (
          <div className="flex flex-col sm:flex-row gap-3 mt-3">
            {onSearchChange && (
              <input
                type="text"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="flex-1 px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            )}
            {filters && (
              <div className="flex gap-2 flex-wrap">
                {filters.map((f) => (
                  <button
                    key={f}
                    onClick={() => onFilterChange?.(f)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeFilter === f
                        ? 'bg-brand-100 text-brand-700'
                        : 'text-surface-600 border border-surface-200 hover:bg-surface-50'
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
