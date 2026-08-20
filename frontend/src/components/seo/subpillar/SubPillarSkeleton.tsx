import { card } from './tone';

/** Loading state — mirrors the live layout so nothing shifts on arrival. */
export default function SubPillarSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-5 pb-12 pt-6 md:px-8" aria-busy="true" aria-label="Loading analysis">
      <div className="skeleton h-3 w-40" />

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="skeleton h-8 w-52" />
          <div className="skeleton h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton h-9 w-36 rounded-lg" />
          <div className="skeleton h-9 w-28 rounded-lg" />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-12 gap-5">
        <div className={`${card} col-span-12 p-7 xl:col-span-7`}>
          <div className="flex flex-col gap-7 sm:flex-row sm:items-center">
            <div className="skeleton h-[148px] w-[148px] flex-shrink-0 rounded-full" />
            <div className="flex-1 space-y-3">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-7 w-36" />
              <div className="skeleton h-4 w-full max-w-sm" />
              <div className="skeleton h-3 w-48" />
            </div>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <div className="skeleton h-3 w-20" />
                <div className="skeleton h-7 w-16" />
              </div>
            ))}
          </div>
        </div>

        <div className={`${card} col-span-12 space-y-4 p-6 xl:col-span-5`}>
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-5 w-40" />
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2 pt-1">
              <div className="skeleton h-3 w-28" />
              <div className="skeleton h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>

        <div className={`${card} col-span-12 overflow-hidden`}>
          <div className="space-y-2 border-b border-surface-200 px-6 py-4">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-5 w-44" />
          </div>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-start gap-4 border-b border-surface-200 px-6 py-4 last:border-0">
              <div className="skeleton h-10 w-[3px] rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-56 max-w-full" />
                <div className="skeleton h-3 w-full max-w-lg" />
                <div className="skeleton h-3 w-40" />
              </div>
            </div>
          ))}
        </div>

        <div className={`${card} col-span-12 overflow-hidden`}>
          <div className="space-y-3 border-b border-surface-200 px-6 py-4">
            <div className="skeleton h-5 w-40" />
            <div className="flex gap-2">
              <div className="skeleton h-9 w-64 rounded-lg" />
              <div className="skeleton h-9 w-36 rounded-lg" />
            </div>
          </div>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-6 border-b border-surface-200 px-6 py-3.5 last:border-0">
              <div className="skeleton h-4 w-48" />
              <div className="skeleton h-4 flex-1" />
              <div className="skeleton h-4 w-10" />
              <div className="skeleton h-5 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
