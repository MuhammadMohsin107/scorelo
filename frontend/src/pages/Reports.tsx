import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Download, FileText, LineChart, Share2, TrendingDown, TrendingUp } from 'lucide-react';
import { fetchReportOverview, type ReportOverview, type ReportPillar, type ReportTrendPoint } from '../data/reports.repository';
import { Button, MetricTile, ModuleHeader, SectionHeading } from '../components/workflows/WorkflowPrimitives';

const periods = ['7D', '30D', '90D', '6M', '1Y'];
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function TrendChart({ points: trendPoints }: { points: ReportTrendPoint[] }) {
  const width = 760;
  const height = 230;
  const padding = 22;
  const values = trendPoints.map((point) => point.score);
  const min = Math.min(...values) - 3;
  const max = Math.max(...values) + 3;
  const points = values.map((value, index) => `${padding + (index * (width - padding * 2)) / (Math.max(values.length - 1, 1))},${height - padding - ((value - min) / (max - min)) * (height - padding * 2)}`).join(' ');
  const first = trendPoints[0];
  const last = trendPoints[trendPoints.length - 1];
  return <div className="overflow-hidden rounded-xl border border-surface-200 bg-surface-0 p-4 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)]"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-600">Trend</p><h3 className="mt-1 text-base font-bold text-surface-950">Overall score over time</h3></div><span className="text-xs text-surface-500">Current period</span></div><svg viewBox={`0 0 ${width} ${height}`} className="mt-5 h-[230px] w-full" role="img" aria-label={`Overall score trend from ${first?.score ?? 0} to ${last?.score ?? 0}`}><line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} className="stroke-surface-200" /><line x1={padding} x2={width - padding} y1={padding} y2={padding} className="stroke-surface-100" /><polyline fill="none" strokeWidth="3" className="stroke-chart-line" strokeLinecap="round" strokeLinejoin="round" points={points} />{values.map((trendValue, index) => { const [x, y] = points.split(' ')[index].split(','); return <circle key={`${trendValue}-${x}-${y}`} cx={x} cy={y} r="4" strokeWidth="2" className="fill-surface-0 stroke-chart-line" />; })}{first && <text x={padding} y={height - 4} fontSize="11" className="fill-surface-500">{shortDate(first.date)}</text>}{last && <text x={width - 54} y={height - 4} fontSize="11" className="fill-surface-500">{shortDate(last.date)}</text>}<text x={padding} y={padding - 5} fontSize="11" className="fill-surface-500">{Math.max(...values)}</text></svg></div>;
}

export default function Reports() {
  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'success' | 'error'>('loading');
  const [period, setPeriod] = useState('30D');
  const [comparison, setComparison] = useState('Previous period');
  const [pillarFilter, setPillarFilter] = useState('All pillars');

  useEffect(() => {
    fetchReportOverview()
      .then((data) => { setOverview(data); setLoadState('success'); })
      .catch((error) => { console.error('Failed to load reports', error); setLoadState('error'); });
  }, []);

  const pillars = overview?.pillars ?? [];
  const visiblePillars = useMemo(() => pillars.filter((pillar) => pillarFilter === 'All pillars' || pillar.label === pillarFilter), [pillars, pillarFilter]);
  const rankedByDelta = useMemo(() => [...pillars].sort((a, b) => (b.current - b.previous) - (a.current - a.previous)), [pillars]);
  const topImprovement: ReportPillar | undefined = rankedByDelta[0];
  const widestGap: ReportPillar | undefined = [...pillars].sort((a, b) => a.current - b.current)[0];

  const exportCsv = () => {
    if (!overview) return;
    const rows = ['Pillar,Current score,Previous score,Change,Status', ...overview.pillars.map((pillar) => `${pillar.label},${pillar.current},${pillar.previous},${pillar.current - pillar.previous},${pillar.status}`)];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `scorelo-report-${period.toLowerCase()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loadState === 'loading' || !overview) {
    return <div className="mx-auto max-w-[1440px] p-8 text-sm text-surface-500">Loading reports…</div>;
  }

  if (loadState === 'error') {
    return <div className="mx-auto max-w-[1440px] p-8 text-sm text-critical-600">Failed to load reports. Please try again.</div>;
  }

  const { currentScore, previousScore, trend } = overview;

  return (
    <div className="mx-auto max-w-[1440px] space-y-8 p-5 pb-16 md:p-8">
      <ModuleHeader eyebrow="Performance intelligence" title="Reports" description="Understand how your store performance is changing over time." actions={<><Button variant="secondary"><CalendarDays size={15} />{period}</Button><Button variant="secondary" onClick={exportCsv}><Download size={15} />Export CSV</Button><Button><FileText size={15} />Create report</Button></>} />

      <section className="flex flex-col gap-3 rounded-xl border border-surface-200 bg-surface-0 p-3 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)] sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap items-center gap-1.5"><span className="mr-2 text-[10px] font-bold uppercase tracking-[0.14em] text-surface-500">Period</span>{periods.map((item) => <button key={item} onClick={() => setPeriod(item)} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${period === item ? 'bg-surface-950 text-surface-0' : 'text-surface-600 hover:bg-surface-100'}`}>{item}</button>)}</div><div className="flex flex-wrap gap-2"><select value={pillarFilter} onChange={(event) => setPillarFilter(event.target.value)} className="rounded-lg border border-surface-200 bg-surface-0 px-3 py-2 text-xs font-semibold text-surface-700"><option>All pillars</option>{pillars.map((pillar) => <option key={pillar.key}>{pillar.label}</option>)}</select><select value={comparison} onChange={(event) => setComparison(event.target.value)} className="rounded-lg border border-surface-200 bg-surface-0 px-3 py-2 text-xs font-semibold text-surface-700"><option>Previous period</option><option>Previous year</option></select></div></section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5"><MetricTile label="Overall score" value={currentScore} detail="out of 100" tone="success" /><MetricTile label="Change" value={`${currentScore - previousScore >= 0 ? '+' : ''}${currentScore - previousScore}`} detail={`${comparison.toLowerCase()}`} tone={currentScore >= previousScore ? 'success' : 'critical'} /><MetricTile label="Issues resolved" value={overview.issuesResolved} detail="Across all pillars" tone="info" /><MetricTile label="Critical issues" value={overview.criticalIssues} detail="Need attention" tone="critical" /><MetricTile label="Findings tracked" value={overview.findingsTracked} detail="Latest audit" /></section>

      <section className="grid gap-5 xl:grid-cols-[1.5fr_1fr]"><TrendChart points={trend} /><div className="rounded-xl border border-surface-200 bg-surface-0 p-5 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)] sm:p-6"><SectionHeading eyebrow="At a glance" title="What changed" /><div className="mt-5 space-y-4">{topImprovement && <div className="flex gap-3"><div className="rounded-lg bg-success-50 p-2 text-success-700"><TrendingUp size={16} /></div><div><p className="text-sm font-bold text-surface-900">{topImprovement.label} changed by {topImprovement.current - topImprovement.previous >= 0 ? '+' : ''}{topImprovement.current - topImprovement.previous} points</p><p className="mt-1 text-xs leading-5 text-surface-500">The largest score movement since the previous audit.</p></div></div>}{widestGap && <div className="flex gap-3"><div className="rounded-lg bg-warning-50 p-2 text-warning-700"><TrendingDown size={16} /></div><div><p className="text-sm font-bold text-surface-900">{widestGap.label} is the widest gap</p><p className="mt-1 text-xs leading-5 text-surface-500">Currently the lowest-scoring pillar at {widestGap.current}/100.</p></div></div>}</div></div></section>

      <section className="space-y-4"><SectionHeading eyebrow="Comparison" title="Pillar performance" description={`Current period compared with ${comparison.toLowerCase()}.`} /><div className="overflow-hidden rounded-xl border border-surface-200 bg-surface-0 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)]"><div className="hidden grid-cols-[1.4fr_0.7fr_0.8fr_0.7fr_1.5fr_0.8fr] gap-4 border-b border-surface-200 bg-surface-50 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-surface-500 sm:grid"><span>Pillar</span><span>Current</span><span>Previous</span><span>Change</span><span>Progress</span><span>Status</span></div><div className="divide-y divide-surface-100">{visiblePillars.map((pillar) => { const delta = pillar.current - pillar.previous; return <div key={pillar.key} className="grid gap-3 px-5 py-4 transition hover:bg-surface-50 sm:grid-cols-[1.4fr_0.7fr_0.8fr_0.7fr_1.5fr_0.8fr] sm:items-center sm:gap-4"><div className="flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pillar.color }} /><span className="text-sm font-bold text-surface-900">{pillar.label}</span></div><div className="text-sm font-bold text-surface-900 tabular-nums">{pillar.current}</div><div className="text-sm text-surface-500 tabular-nums">{pillar.previous}</div><div className={`text-sm font-bold tabular-nums ${delta >= 0 ? 'text-success-700' : 'text-critical-700'}`}>{delta >= 0 ? '+' : ''}{delta}</div><div className="h-2 overflow-hidden rounded-full bg-surface-100"><div className="h-full rounded-full" style={{ width: `${pillar.current}%`, backgroundColor: pillar.color }} /></div><div><span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-bold" style={{ color: pillar.color, borderColor: pillar.color, backgroundColor: `${pillar.color}12` }}><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: pillar.color }} />{pillar.status}</span></div></div>; })}</div></div></section>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]"><div className="rounded-xl border border-surface-200 bg-surface-0 p-5 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)] sm:p-6"><SectionHeading eyebrow="Report history" title="Previous reports" /><div className="mt-5 divide-y divide-surface-100">{['August Performance Report', 'July Performance Report', 'June Performance Report'].map((report, index) => <div key={report} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="flex items-center gap-3"><div className="rounded-lg bg-surface-100 p-2 text-surface-600"><FileText size={16} /></div><div><p className="text-sm font-bold text-surface-900">{report}</p><p className="mt-1 text-xs text-surface-500">{index === 0 ? 'Aug 19, 2026' : index === 1 ? 'Jul 31, 2026' : 'Jun 30, 2026'}</p></div></div><Button variant="ghost"><Share2 size={14} />View</Button></div>)}</div></div><div className="rounded-xl border border-brand-100 bg-brand-50 p-5 sm:p-6"><LineChart size={20} className="text-brand-700" /><h3 className="mt-4 text-lg font-bold text-brand-950">Ready to share?</h3><p className="mt-2 text-sm leading-6 text-brand-800">Export the current pillar comparison as CSV for internal review or client reporting.</p><Button variant="primary" onClick={exportCsv}><Download size={15} />Export data</Button></div></section>
    </div>
  );
}
