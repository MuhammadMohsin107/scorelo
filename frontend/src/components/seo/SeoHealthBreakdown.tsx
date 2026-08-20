export interface HealthBreakdownItem {
  label: string;
  value: number;
  barClass?: string;
  dotClass?: string;
}

export interface HealthBreakdownSummary {
  label: string;
  value: number | string;
  tone?: 'valid' | 'warning' | 'error' | 'missing' | 'info' | 'neutral';
}

export interface HealthBreakdownRow {
  label: string;
  count: number;
  valid?: number;
  warnings?: number;
  errors?: number;
  missing?: number;
  tone?: 'valid' | 'warning' | 'error' | 'missing' | 'info' | 'neutral';
}

interface Props {
  title: string;
  total: number;
  items?: HealthBreakdownItem[];
  summary?: HealthBreakdownSummary[];
  rows?: HealthBreakdownRow[];
  footerNote?: string;
  status?: 'ready' | 'loading' | 'empty' | 'error';
  emptyMessage?: string;
  errorMessage?: string;
  onRetry?: () => void;
}

const toneStyles: Record<NonNullable<HealthBreakdownSummary['tone']>, string> = {
  valid: 'bg-green-500 text-green-700',
  warning: 'bg-amber-500 text-amber-700',
  error: 'bg-red-500 text-red-700',
  missing: 'bg-gray-400 text-gray-700',
  info: 'bg-blue-500 text-blue-700',
  neutral: 'bg-slate-400 text-slate-700',
};

const summarizeItems = (items: HealthBreakdownItem[]): HealthBreakdownSummary[] => {
  const labelMap: Record<string, HealthBreakdownSummary['tone']> = {
    valid: 'valid',
    healthy: 'valid',
    optimized: 'valid',
    warning: 'warning',
    warnings: 'warning',
    alert: 'warning',
    error: 'error',
    errors: 'error',
    missing: 'missing',
    missings: 'missing',
    broken: 'error',
    orphan: 'warning',
    duplicate: 'missing',
    noindex: 'neutral',
    blocked: 'error',
    not: 'error',
    'not indexed': 'error',
    info: 'info',
    opportunity: 'info',
  };

  return items.map((item) => {
    const normalized = item.label.toLowerCase();
    const tone = Object.entries(labelMap).find(([key]) => normalized.includes(key))?.[1] ?? 'neutral';
    return { label: item.label, value: item.value, tone };
  });
};

const toRows = (items: HealthBreakdownItem[]): HealthBreakdownRow[] =>
  items.map((item) => ({
    label: item.label,
    count: item.value,
    valid: item.value,
    tone: summarizeItems([item])[0]?.tone ?? 'neutral',
  }));

export default function SeoHealthBreakdown({
  title,
  total,
  items = [],
  rows,
  footerNote,
  status = 'ready',
  emptyMessage = 'No data available for this breakdown yet.',
  errorMessage = 'Unable to load this breakdown.',
  onRetry,
}: Props) {
  const fallbackRows = items.length > 0 ? toRows(items) : [];
  const resolvedRows = rows && rows.length > 0 ? rows : fallbackRows;

  if (status === 'loading') {
    return (
      <div className="bg-white border border-surface-200 rounded-lg shadow-sm p-6 animate-pulse">
        <div className="h-6 w-48 bg-surface-200 rounded mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="border border-surface-200 bg-surface-50 rounded-lg p-3">
              <div className="h-2.5 w-16 bg-surface-200 rounded mb-3" />
              <div className="h-7 w-20 bg-surface-200 rounded" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="space-y-2">
              <div className="h-4 w-28 bg-surface-200 rounded" />
              <div className="h-2 w-full bg-surface-100 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="bg-white border border-surface-200 rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-bold text-surface-900 mb-4">{title}</h2>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">{errorMessage}</p>
          {onRetry && (
            <button onClick={onRetry} className="mt-3 text-sm font-semibold text-red-700 hover:text-red-800">
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status === 'empty' || (!rows && items.length === 0)) {
    return (
      <div className="bg-white border border-surface-200 rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-bold text-surface-900 mb-3">{title}</h2>
        <div className="rounded-lg border border-surface-200 bg-surface-50 p-4 text-sm text-surface-600">
          {emptyMessage}
        </div>
      </div>
    );
  }

  const showStructuredRows = resolvedRows.length > 0;
  const maxValue = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="bg-white border border-surface-200 rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-bold text-surface-900 mb-6">{title}</h2>

      {showStructuredRows ? (
        <div className="space-y-5">
          {resolvedRows.map((row) => {
            const rowValue = row.valid ?? row.count ?? 0;
            const progress = row.count > 0 ? Math.max((rowValue / row.count) * 100, 8) : 100;
            const textTone = row.tone ?? 'neutral';
            const labelMeta = row.errors !== undefined || row.warnings !== undefined || row.missing !== undefined;
            return (
              <div key={row.label} className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-surface-900">{row.label}</div>
                    {row.count > 0 && (
                      <div className="text-[11px] text-surface-500">{row.count.toLocaleString()} pages</div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-right text-xs text-surface-600">
                    {row.valid !== undefined && (
                      <span className="font-semibold text-surface-900 tabular-nums">{row.valid.toLocaleString()} valid</span>
                    )}
                    {row.errors !== undefined && row.errors > 0 && (
                      <span className="text-critical-600">{row.errors.toLocaleString()} errors</span>
                    )}
                    {row.warnings !== undefined && row.warnings > 0 && (
                      <span className="text-warning-600">{row.warnings.toLocaleString()} warnings</span>
                    )}
                    {!labelMeta && row.count > 0 && (
                      <span className="text-surface-600">{row.count.toLocaleString()}</span>
                    )}
                  </div>
                </div>

                <div className="w-full bg-surface-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full ${toneStyles[textTone]}`}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mb-8">
          <div className="flex items-end justify-center gap-2 h-48 bg-surface-50 rounded-lg p-6">
            {items.map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-2 flex-1">
                <div
                  className={`w-full rounded-t-lg transition-all ${item.barClass ?? 'bg-surface-300'}`}
                  style={{ height: `${Math.max((item.value / maxValue) * 180, 4)}px` }}
                  title={`${item.label}: ${item.value.toLocaleString()}`}
                />
                <span className="text-xs text-surface-600 font-medium text-center">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!showStructuredRows && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => {
            const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';
            return (
              <div key={item.label} className="flex items-center justify-between p-4 bg-surface-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-surface-900">{item.label}</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-surface-900 tabular-nums">{item.value.toLocaleString()}</div>
                  <div className="text-xs text-surface-500">{pct}%</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {footerNote && (
        <div className="mt-6 pt-4 border-t border-surface-200 text-center">
          <p className="text-xs text-surface-500">{footerNote}</p>
        </div>
      )}
    </div>
  );
}
