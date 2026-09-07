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
    <div className="page-shell section-stack">
      {/* Page header. The "Store performance" eyebrow is gone: the sidebar wordmark already says
          it, and it cost a whole line above the only title on the page. */}
      <div className="page-head motion-safe:animate-fade-in">
        <div className="min-w-0">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">A clear view of what is healthy, what changed, and what to fix next.</p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
          <span className="meta-chip">
            <Globe size={12} className="text-surface-400" />
            <span className="font-medium text-surface-800">{data.storeName}</span>
            <span className="text-surface-300">·</span>
            <span className="truncate font-mono text-[10.5px] text-surface-500">{data.storeUrl}</span>
          </span>
          {data.lastUpdated && (
            <span className="meta-chip">
              <Clock size={12} className="text-surface-400" />
              Analyzed <span className="font-medium text-surface-800">{formatLastUpdated(data.lastUpdated)}</span>
            </span>
          )}
          <button
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="btn-secondary btn-xs"
            aria-label="Refresh dashboard data"
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* 12-column content grid */}
      <div className="grid grid-cols-12 gap-3 motion-safe:animate-slide-up">
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
