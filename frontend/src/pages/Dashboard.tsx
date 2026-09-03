import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Clock, Globe } from 'lucide-react';
import type { DashboardData } from '../data/dashboard/dashboard.types';
import { fetchDashboardData, formatLastUpdated } from '../data/dashboard/dashboard.repository';
import PillarOverview from '../components/dashboard/PillarOverview';
import PriorityIssues from '../components/dashboard/PriorityIssues';
import RecommendedActions from '../components/dashboard/RecommendedActions';
import ScoreTrend from '../components/dashboard/ScoreTrend';
import ScoreOverview from '../components/dashboard/ScoreOverview';
import DashboardSkeleton from '../components/dashboard/DashboardSkeleton';
import DashboardError from '../components/dashboard/DashboardError';
import DashboardEmpty from '../components/dashboard/DashboardEmpty';
import { ApiError } from '../lib/api';

type LoadState = 'loading' | 'success' | 'empty' | 'error';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setState('loading');
      }
      const result = await fetchDashboardData();
      setData(result);
      setState('success');
    } catch (err) {
      // A store that has never been audited is a first-run state, not a failure — the backend
      // says so explicitly with AUDITS_NOT_FOUND, so don't show it as a broken dashboard.
      setState(err instanceof ApiError && err.code === 'AUDITS_NOT_FOUND' ? 'empty' : 'error');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (state === 'loading') {
    return <DashboardSkeleton />;
  }

  if (state === 'empty') {
    return <DashboardEmpty onAuditComplete={() => loadData()} />;
  }

  if (state === 'error' || !data) {
    return <DashboardError onRetry={() => loadData()} />;
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 p-5 pb-16 md:p-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between motion-safe:animate-fade-in">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-600">Store performance</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-surface-950 md:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-surface-500">A clear view of what is healthy, what changed, and what to fix next.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-surface-0 px-2.5 py-1.5 text-xs text-surface-600 shadow-sm">
            <Globe size={13} className="text-surface-400" />
            <span className="font-medium text-surface-800">{data.storeName}</span>
            <span className="text-surface-300">·</span>
            <span className="font-mono text-[11px] text-surface-500">{data.storeUrl}</span>
          </span>
          {data.lastUpdated && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-surface-0 px-2.5 py-1.5 text-xs text-surface-600 shadow-sm">
              <Clock size={13} className="text-surface-400" />
              Analyzed <span className="font-medium text-surface-800">{formatLastUpdated(data.lastUpdated)}</span>
            </span>
          )}
          <button
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="btn-secondary h-[34px] px-3 text-xs"
            aria-label="Refresh dashboard data"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* 12-column content grid */}
      <div className="grid grid-cols-12 gap-5 motion-safe:animate-slide-up">
        <div className="col-span-12 xl:col-span-8">
          <ScoreOverview data={data.overallScore} metrics={data.keyMetrics} trend={data.scoreTrend} />
        </div>
        <div className="col-span-12 xl:col-span-4">
          <ScoreTrend data={data.scoreTrend} />
        </div>

        <div className="col-span-12">
          <PillarOverview pillars={data.pillars} />
        </div>

        <div className="col-span-12 xl:col-span-7">
          <PriorityIssues issues={data.priorityIssues} />
        </div>
        <div className="col-span-12 xl:col-span-5">
          <RecommendedActions actions={data.recommendedActions} />
        </div>
      </div>
    </div>
  );
}
