import { useState } from 'react';
import { AlertTriangle, ArrowRight, ChevronRight, Clock3, Globe, RefreshCw, Target, TrendingUp, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  croKpis,
  priorityIssues,
  recommendedActions,
  recentActivity,
  clarityBehaviorData,
  cartRecoveryData,
  trustSocialProofData,
  returnsFlowData,
  orderTrackingData,
  codCheckoutData,
  productOptionsData,
  subscriptionOpportunityData,
  wishlistData,
  storeLocatorData,
  mobileUxData,
  type CroSubPillarKey,
  type IssueSeverity,
} from '../../data/cro/cro.mock';
import PillarKpiCard from '../../components/pillars/PillarKpiCard';
import PillarScoreRing from '../../components/pillars/PillarScoreRing';

const areaRoute: Record<CroSubPillarKey, string> = {
  clarity: '/cro/clarity',
  'cart-recovery': '/cro/cart-recovery',
  trust: '/cro/trust',
  returns: '/cro/returns',
  tracking: '/cro/tracking',
  cod: '/cro/cod',
  options: '/cro/options',
  subscription: '/cro/subscription',
  wishlist: '/cro/wishlist',
  locator: '/cro/locator',
  'mobile-ux': '/cro/mobile-ux',
};

const areaTitleRoute: Record<string, string> = {
  'Clarity / Behavior Readiness': '/cro/clarity',
  'Cart Recovery': '/cro/cart-recovery',
  'Trust & Social Proof': '/cro/trust',
  'Returns Flow': '/cro/returns',
  'Order Tracking': '/cro/tracking',
  'COD Checkout Quality': '/cro/cod',
  'Product Options & Add-ons': '/cro/options',
  'Subscription Opportunity': '/cro/subscription',
  Wishlist: '/cro/wishlist',
  'Store Locator': '/cro/locator',
  'Mobile UX': '/cro/mobile-ux',
};

const statusLabel = (score: number) => score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Needs Work' : 'Critical';
const statusPill: Record<string, string> = { Excellent: 'bg-success-50 text-success-700 border-success-100', Good: 'bg-info-50 text-info-700 border-info-100', 'Needs Work': 'bg-warning-50 text-warning-700 border-warning-100', Critical: 'bg-critical-50 text-critical-700 border-critical-100' };
const statusBar: Record<string, string> = { Excellent: 'bg-success-500', Good: 'bg-info-500', 'Needs Work': 'bg-warning-500', Critical: 'bg-critical-500' };
const severityRank: Record<IssueSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const severityBadge: Record<IssueSeverity, string> = { critical: 'bg-critical-50 text-critical-700 border border-critical-100', high: 'bg-warning-50 text-warning-700 border border-warning-100', medium: 'bg-surface-100 text-surface-600 border border-surface-200', low: 'bg-surface-100 text-surface-500 border border-surface-200' };

interface AreaCard { key: CroSubPillarKey; title: string; score: number; analyzed: string; keyStat: string; description: string; }

const areaCards: AreaCard[] = [
  { key: 'clarity', title: 'Clarity / Behavior Readiness', score: clarityBehaviorData.score, analyzed: `${clarityBehaviorData.pagesAnalyzed} pages analyzed`, keyStat: `${clarityBehaviorData.weakCta + clarityBehaviorData.missingCta} CTA gaps`, description: 'Make the next action obvious across the storefront.' },
  { key: 'cart-recovery', title: 'Cart Recovery', score: cartRecoveryData.score, analyzed: `${cartRecoveryData.abandonedCarts} abandoned carts`, keyStat: `${cartRecoveryData.missingFlows} missing flows`, description: 'Recover high-intent shoppers with timely journeys.' },
  { key: 'trust', title: 'Trust & Social Proof', score: trustSocialProofData.score, analyzed: `${trustSocialProofData.productsAnalyzed.toLocaleString()} products analyzed`, keyStat: `${trustSocialProofData.noReviews} without reviews`, description: 'Make confidence visible near the buying decision.' },
  { key: 'returns', title: 'Returns Flow', score: returnsFlowData.score, analyzed: `${returnsFlowData.ordersAnalyzed.toLocaleString()} orders analyzed`, keyStat: `${returnsFlowData.manualReturns} manual returns`, description: 'Reduce support friction in the returns journey.' },
  { key: 'tracking', title: 'Order Tracking', score: orderTrackingData.score, analyzed: `${orderTrackingData.ordersAnalyzed.toLocaleString()} orders analyzed`, keyStat: `${orderTrackingData.ordersWithoutTracking} without tracking`, description: 'Keep customers informed after checkout.' },
  { key: 'cod', title: 'COD Checkout Quality', score: codCheckoutData.score, analyzed: `${codCheckoutData.codEligibleOrders.toLocaleString()} COD orders`, keyStat: `${codCheckoutData.validationErrorRate}% validation errors`, description: 'Reduce delivery refusal and fraud risk.' },
  { key: 'options', title: 'Product Options & Add-ons', score: productOptionsData.score, analyzed: `${productOptionsData.productsAnalyzed.toLocaleString()} products analyzed`, keyStat: `${productOptionsData.missingSizeGuide} missing guides`, description: 'Help shoppers choose with complete options.' },
  { key: 'subscription', title: 'Subscription Opportunity', score: subscriptionOpportunityData.score, analyzed: `${subscriptionOpportunityData.subscribableProducts} eligible products`, keyStat: `${subscriptionOpportunityData.productsMissingSubscription} missing`, description: 'Turn replenishment into recurring purchase intent.' },
  { key: 'wishlist', title: 'Wishlist', score: wishlistData.score, analyzed: `${wishlistData.themePageCoverage}% page coverage`, keyStat: `${wishlistData.productsNeverWishlisted} without activity`, description: 'Capture save-for-later intent across the catalog.' },
  { key: 'locator', title: 'Store Locator', score: storeLocatorData.score, analyzed: `${storeLocatorData.totalLocations} locations analyzed`, keyStat: `${storeLocatorData.missingMapPin} missing map pins`, description: 'Make physical locations easy to find and trust.' },
  { key: 'mobile-ux', title: 'Mobile UX', score: mobileUxData.score, analyzed: `${mobileUxData.pagesAnalyzed} pages analyzed`, keyStat: `${mobileUxData.critical} critical pages`, description: 'Remove friction from mobile conversion paths.' },
];

const kpiMeta: Record<string, { icon?: LucideIcon; accent?: 'brand' | 'success' | 'warning' | 'critical' | 'info' }> = {
  'Conversion Opportunities': { icon: Target, accent: 'warning' },
  'High-Impact Issues': { icon: AlertTriangle, accent: 'critical' },
  'Checkout Issues': { icon: Target, accent: 'warning' },
  'Mobile Issues': { icon: Target, accent: 'info' },
};

export default function CroDashboard() {
  const navigate = useNavigate();
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const overallScore = Number.parseInt(croKpis[0].value, 10);
  const overallStatus = statusLabel(overallScore);
  const sortedIssues = [...priorityIssues].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  const criticalCount = priorityIssues.filter((issue) => issue.severity === 'critical').length;
  const highCount = priorityIssues.filter((issue) => issue.severity === 'high').length;
  const mediumCount = priorityIssues.filter((issue) => issue.severity === 'medium').length;
  const handleReanalyze = () => { setIsReanalyzing(true); window.setTimeout(() => setIsReanalyzing(false), 1600); };

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="mx-auto max-w-[1440px] px-5 py-8 md:px-8">
        <div className="relative mb-6 overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-100/70 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 right-1/3 h-56 w-56 rounded-full bg-warning-50 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-300/70 to-transparent" />
          <div className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-[0_6px_14px_rgba(79,70,229,0.28)]"><Target size={16} strokeWidth={2.2} /></span><h1 className="text-xl font-semibold tracking-tight text-surface-900">CRO</h1><span className="inline-flex items-center rounded-full border border-brand-100 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">11 areas monitored</span></div>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-surface-600">Find and prioritize the moments that help more shoppers understand, trust, and complete their purchase.</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs"><span className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-surface-50 px-2.5 py-1.5 text-surface-600"><Globe size={13} className="text-surface-400" /><span className="font-medium text-surface-800">Acme Store</span><span className="text-surface-300">·</span><span className="font-mono text-[11px] text-surface-500">acme-store.com</span></span><span className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-surface-50 px-2.5 py-1.5 text-surface-600"><Clock3 size={13} className="text-surface-400" />Last analyzed <span className="font-medium text-surface-800">Today, 10:42 AM</span></span><span className="inline-flex items-center gap-1.5 rounded-lg border border-warning-100 bg-warning-50 px-2.5 py-1.5 text-warning-700"><TrendingUp size={13} />{croKpis[0].trend} vs last analysis</span></div>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center lg:border-l lg:border-surface-100 lg:pl-6"><div className="flex items-center gap-4"><PillarScoreRing score={overallScore} gradientId="cro-score-ring-gradient" /><div><p className="text-[11px] font-semibold uppercase tracking-wider text-surface-400">CRO Health</p><span className={`mt-1 inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusPill[overallStatus]}`}>{overallStatus}</span></div></div><button onClick={handleReanalyze} disabled={isReanalyzing} className="btn-primary sm:ml-2"><RefreshCw size={14} className={isReanalyzing ? 'animate-spin' : ''} />{isReanalyzing ? 'Re-analyzing…' : 'Re-analyze'}</button></div>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">{croKpis.slice(1).map((kpi) => { const meta = kpiMeta[kpi.label]; return <PillarKpiCard key={kpi.label} label={kpi.label} value={kpi.value} trend={kpi.trend} trendGood={kpi.status === 'improvement'} icon={meta?.icon} accent={meta?.accent} />; })}</div>

        <section className="mb-8" aria-labelledby="cro-areas-title"><div className="mb-4 flex items-end justify-between gap-4"><div><h2 id="cro-areas-title" className="text-lg font-semibold tracking-tight text-surface-900">CRO Areas</h2><p className="mt-0.5 text-sm text-surface-500">Review health and optimization opportunities across each conversion area.</p></div><span className="hidden rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700 sm:inline-flex">11 sub-pillars</span></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{areaCards.map((area) => { const label = statusLabel(area.score); return <button key={area.key} onClick={() => navigate(areaRoute[area.key])} className="group relative flex flex-col overflow-hidden rounded-xl border border-surface-200 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"><div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand-500 via-brand-400 to-success-500 opacity-0 transition-opacity group-hover:opacity-100" /><div className="mb-3 flex items-start justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100"><span className="text-[11px] font-semibold">{area.title.charAt(0)}</span></span><h3 className="text-sm font-semibold leading-snug text-surface-900 group-hover:text-brand-700">{area.title}</h3></div><span className={`inline-flex flex-shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusPill[label]}`}>{label}</span></div><div className="mb-2 flex items-baseline gap-1"><span className="text-2xl font-semibold tracking-tight text-surface-900 tabular-nums">{area.score}</span><span className="text-xs font-medium text-surface-400">/100</span></div><div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-100"><div className={`h-full rounded-full ${statusBar[label]}`} style={{ width: `${area.score}%` }} /></div><p className="mb-3 min-h-[36px] text-xs leading-relaxed text-surface-500">{area.description}</p><div className="mt-auto flex items-center justify-between gap-2 rounded-lg border border-surface-100 bg-surface-50 px-2.5 py-2 text-[11px]"><span className="truncate text-surface-500">{area.analyzed}</span><span className="flex-shrink-0 font-semibold text-surface-800">{area.keyStat}</span></div><div className="mt-3 flex items-center justify-between gap-2"><span className="text-xs font-medium text-brand-700">View analysis</span><span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-brand-700 transition-all group-hover:bg-brand-600 group-hover:text-white"><ArrowRight size={12} /></span></div></button>; })}</div></section>

        <div className="mb-10 grid gap-6 lg:grid-cols-3"><div className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-sm lg:col-span-2"><div className="border-b border-surface-200 px-6 py-5"><h2 className="text-base font-semibold tracking-tight text-surface-900">Priority Issues</h2><p className="mt-1 text-xs text-surface-500">Ordered by severity — start at the top.</p></div><div className="divide-y divide-surface-100">{sortedIssues.map((issue) => <div key={issue.id} className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-surface-50"><span className={`w-[72px] flex-shrink-0 rounded px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide ${severityBadge[issue.severity]}`}>{issue.severity}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-surface-900">{issue.title}</p><p className="mt-0.5 text-xs text-surface-500">{issue.affectedPages.toLocaleString()} affected · {issue.area}</p></div><button onClick={() => navigate(areaRoute[issue.areaKey])} className="btn-secondary min-h-9 px-3 py-1.5 text-xs">Review</button></div>)}</div></div><div className="h-fit rounded-xl border border-surface-200 bg-white p-6 shadow-sm"><h2 className="mb-1 text-base font-semibold tracking-tight text-surface-900">CRO Health</h2><p className="mb-6 text-sm text-surface-600">Needs work — conversion opportunities need focused attention.</p><div className="space-y-3"><HealthRow label="Critical Issues" value={criticalCount} tone="bg-critical-500" /><HealthRow label="High Priority" value={highCount} tone="bg-warning-500" /><HealthRow label="Medium Priority" value={mediumCount} tone="bg-surface-400" /></div><div className="mt-6 border-t border-surface-100 pt-4"><p className="text-xs leading-relaxed text-surface-500">Resolving critical checkout and recovery issues first will have the largest conversion impact.</p></div></div></div>

        <div className="grid gap-6 lg:grid-cols-2"><ListPanel title="Quick Wins" eyebrow="Highest-value actions" items={recommendedActions.slice(0, 4).map((action) => ({ id: action.id, title: action.title, detail: `${action.pages.toLocaleString()} affected · ${action.effort} effort`, route: areaTitleRoute[action.area] ?? '/cro' }))} navigate={navigate} /><ListPanel title="Recent Findings" eyebrow="Latest changes detected" items={recentActivity.map((item) => ({ id: item.id, title: item.action, detail: item.timestamp }))} navigate={navigate} /></div>
      </div>
    </div>
  );
}

function HealthRow({ label, value, tone }: { label: string; value: number; tone: string }) { return <div className="flex items-center justify-between rounded-lg bg-surface-50 p-3.5"><span className="flex items-center gap-2.5 text-sm font-medium text-surface-900"><span className={`h-2 w-2 flex-shrink-0 rounded-full ${tone}`} />{label}</span><span className="text-base font-semibold tabular-nums text-surface-900">{value}</span></div>; }

function ListPanel({ title, eyebrow, items, navigate }: { title: string; eyebrow: string; items: Array<{ id: string; title: string; detail: string; route?: string }>; navigate: (path: string) => void }) { return <div className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-sm"><div className="border-b border-surface-200 px-6 py-5"><h2 className="text-base font-semibold tracking-tight text-surface-900">{title}</h2><p className="mt-1 text-xs text-surface-500">{eyebrow}</p></div><div className="divide-y divide-surface-100">{items.map((item) => <div key={item.id} className="flex items-center gap-3 px-6 py-3.5"><ChevronRight size={14} className="flex-shrink-0 text-surface-300" /><p className="min-w-0 flex-1 truncate text-sm text-surface-800">{item.title}</p><span className="flex-shrink-0 text-xs text-surface-400">{item.detail}</span>{item.route && <button onClick={() => navigate(item.route!)} className="btn-secondary min-h-9 px-3 py-1.5 text-xs">Review</button>}</div>)}</div></div>; }
