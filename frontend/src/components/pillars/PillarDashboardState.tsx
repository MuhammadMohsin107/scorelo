// Loading / empty / error states shared by the five pillar dashboards.
//
// The empty state is the important one. These pages used to fill their layout with hard-coded
// scores when no audit existed, which read as a real measurement of the merchant's store. An
// unaudited store now says so.

import { Link } from 'react-router-dom';
import { AlertCircle, RefreshCw, Radar } from 'lucide-react';

export function PillarDashboardSkeleton({ title }: { title: string }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="mx-auto max-w-[1440px] px-5 py-8 md:px-8">
        <div className="mb-6 h-40 animate-pulse rounded-2xl border border-surface-200 bg-white" />
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-surface-200 bg-white" />
          ))}
        </div>
        <span className="sr-only">Loading {title} analysis…</span>
      </div>
    </div>
  );
}

/**
 * Shown when the store has no audit for this pillar. Deliberately carries no score, no chart
 * and no placeholder digits — there is nothing measured to show, and saying so is the point.
 */
export function PillarDashboardEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="mx-auto max-w-[1440px] px-5 py-8 md:px-8">
        <div className="card flex min-h-[420px] flex-col items-center justify-center p-8 text-center md:p-12">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
            <Radar size={28} className="text-brand-600" />
          </div>
          <h1 className="mb-2 text-lg font-semibold text-surface-900">No {title} audit available</h1>
          <p className="mb-6 max-w-md text-sm text-surface-500">{description}</p>
          <Link to="/" className="btn-primary">
            <Radar size={16} />
            Run an audit to generate real results
          </Link>
          <p className="mt-6 max-w-md text-xs text-surface-400">
            Scores appear here only once an audit has measured your store. Nothing on this page is
            estimated or filled in.
          </p>
        </div>
      </div>
    </div>
  );
}

export function PillarDashboardError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="mx-auto max-w-[1440px] px-5 py-8 md:px-8">
        <div className="card flex min-h-[400px] flex-col items-center justify-center p-8 text-center md:p-12">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-critical-50">
            <AlertCircle size={28} className="text-critical-500" />
          </div>
          <h1 className="mb-2 text-lg font-semibold text-surface-900">Unable to load {title}</h1>
          <p className="mb-6 max-w-md text-sm text-surface-500">
            Something went wrong fetching this analysis. Please try again.
          </p>
          <button onClick={onRetry} className="btn-primary">
            <RefreshCw size={16} />
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

/** Marks seeded demo fixtures so they can never be mistaken for a measurement of a real store. */
export function SeedDataNotice() {
  return (
    <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-warning-100 bg-warning-50 p-3.5">
      <AlertCircle size={16} className="mt-0.5 shrink-0 text-warning-600" />
      <p className="text-sm text-warning-800">
        <span className="font-semibold">Demo data.</span> This audit is a seeded development
        fixture, not a measurement of your store.
      </p>
    </div>
  );
}
