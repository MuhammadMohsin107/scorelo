/**
 * Skeleton loading state for the dashboard.
 * Mirrors the live layout (header → hero + trend → pillar cards →
 * issues + actions) so nothing jumps when data arrives.
 */
const card = 'rounded-2xl border border-surface-200/80 bg-white';

export default function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-[1440px] space-y-6 p-5 pb-16 md:p-8" aria-busy="true" aria-label="Loading dashboard">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="skeleton h-3 w-32" />
          <div className="skeleton h-8 w-44" />
          <div className="skeleton h-4 w-80 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="skeleton h-8 w-52 rounded-lg" />
          <div className="skeleton h-8 w-36 rounded-lg" />
          <div className="skeleton h-8 w-24 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* Hero */}
        <div className={`${card} col-span-12 p-6 md:p-7 xl:col-span-8`}>
          <div className="flex flex-col gap-7 lg:flex-row">
            <div className="flex flex-1 flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
              <div className="skeleton h-[152px] w-[152px] flex-shrink-0 rounded-full" />
              <div className="flex-1 space-y-3">
                <div className="skeleton h-3 w-24" />
                <div className="skeleton h-7 w-40" />
                <div className="skeleton h-4 w-full max-w-md" />
                <div className="skeleton h-3 w-64" />
              </div>
            </div>
            <div className="space-y-3 lg:w-[300px] lg:border-l lg:border-surface-100 lg:pl-7">
              <div className="skeleton h-3 w-20" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="skeleton h-6 w-6 flex-shrink-0 rounded-md" />
                  <div className="skeleton h-4 w-full" />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 border-t border-surface-100 pt-5 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton h-9 w-9 flex-shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3 w-20" />
                  <div className="skeleton h-5 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trend */}
        <div className={`${card} col-span-12 flex flex-col xl:col-span-4`}>
          <div className="flex items-start justify-between border-b border-surface-100 px-5 py-4">
            <div className="space-y-2">
              <div className="skeleton h-3 w-14" />
              <div className="skeleton h-5 w-32" />
            </div>
            <div className="skeleton h-7 w-12" />
          </div>
          <div className="flex-1 p-4">
            <div className="skeleton h-[200px] w-full rounded-lg" />
          </div>
          <div className="border-t border-surface-100 px-5 py-3">
            <div className="skeleton h-3 w-48" />
          </div>
        </div>

        {/* Pillars */}
        <div className="col-span-12">
          <div className="mb-3 space-y-2">
            <div className="skeleton h-3 w-16" />
            <div className="skeleton h-5 w-48" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`${card} p-4 space-y-4`}>
                <div className="flex items-center gap-2">
                  <div className="skeleton h-8 w-8 rounded-lg" />
                  <div className="skeleton h-4 w-20" />
                </div>
                <div className="skeleton h-8 w-16" />
                <div className="skeleton h-2 w-full rounded-full" />
                <div className="skeleton h-3 w-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Issues */}
        <div className={`${card} col-span-12 xl:col-span-7`}>
          <div className="border-b border-surface-100 px-5 py-4">
            <div className="skeleton h-3 w-12" />
            <div className="skeleton mt-2 h-5 w-36" />
            <div className="mt-4 flex gap-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-6 w-16 rounded-full" />
              ))}
            </div>
          </div>
          <div className="divide-y divide-surface-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                <div className="skeleton h-8 w-8 flex-shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-64 max-w-full" />
                  <div className="skeleton h-3 w-48" />
                </div>
                <div className="skeleton h-4 w-14" />
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className={`${card} col-span-12 xl:col-span-5`}>
          <div className="border-b border-surface-100 px-5 py-4">
            <div className="skeleton h-3 w-16" />
            <div className="skeleton mt-2 h-5 w-44" />
          </div>
          <div className="divide-y divide-surface-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-4">
                <div className="skeleton h-7 w-7 flex-shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-52 max-w-full" />
                  <div className="skeleton h-3 w-full" />
                  <div className="skeleton h-3 w-32" />
                </div>
                <div className="skeleton h-7 w-20 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
