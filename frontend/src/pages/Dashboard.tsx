import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, RefreshCw, Clock, Globe, PlugZap } from 'lucide-react';
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
import { useAuditRun } from '../data/useAuditRun';

type LoadState = 'loading' | 'success' | 'empty' | 'error';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [state, setState] = useState<LoadState>('loading');

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      // A refresh keeps the current dashboard on screen and swaps the numbers when they arrive;
      // only the first load may blank the page out to a skeleton.
      if (!isRefresh) setState('loading');
      const result = await fetchDashboardData();
      setData(result);
      setState('success');
    } catch (err) {
      // A store that has never been audited is a first-run state, not a failure — the backend
      // says so explicitly with AUDITS_NOT_FOUND, so don't show it as a broken dashboard.
      setState(err instanceof ApiError && err.code === 'AUDITS_NOT_FOUND' ? 'empty' : 'error');
    }
  }, []);

  /**
   * Refresh RE-ANALYSES the store, then reloads from the audit that run produced.
   *
   * It used to call fetchDashboardData() alone: the same stored audit, re-read and re-rendered.
   * Every number came back identical and "Analyzed 1d ago" stayed 1d ago, which is exactly what
   * a button that does nothing looks like. The five pillar dashboards already ran a real audit
   * behind the same label — this is the same hook, so the dashboard cannot drift from them again.
   */
  const auditRun = useAuditRun();
  const refresh = () => void auditRun.run(() => loadData(true));

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
            onClick={refresh}
            disabled={auditRun.running}
            className="btn-secondary btn-xs"
            aria-label="Re-analyze this store and refresh the dashboard"
          >
            <RefreshCw size={12} className={auditRun.running ? 'animate-spin motion-reduce:animate-none' : ''} />
            {auditRun.running ? `Analyzing… ${auditRun.progress}%` : 'Refresh'}
          </button>
        </div>
      </div>

      {/* A run that could not start has to say so. Silence here is what made the button look
          broken: a store with no live Shopify connection is refused with STORE_NOT_CONNECTED
          before any work begins, and nothing on the page changed to explain it. */}
      {auditRun.error && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-critical-100 bg-critical-50 px-2.5 py-2 text-[12px] text-critical-800" role="alert">
          <AlertCircle size={15} className="shrink-0" />
          <p className="flex-1">{auditRun.error.message}</p>
          {auditRun.error.needsConnection ? (
            <Link to="/integrations" className="btn-primary btn-xs"><PlugZap size={12} />Connect your store</Link>
          ) : (
            <button onClick={refresh} className="btn-secondary btn-xs"><RefreshCw size={12} />Try again</button>
          )}
        </div>
      )}

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
