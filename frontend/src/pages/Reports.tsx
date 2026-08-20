import { useMemo, useState } from 'react';
import { CalendarDays, Download, FileText, LineChart, Share2, TrendingDown, TrendingUp } from 'lucide-react';
import { reportPillars, reportTrend } from '../data/workflows.mock';
import { Button, MetricTile, ModuleHeader, SectionHeading } from '../components/workflows/WorkflowPrimitives';

const periods = ['7D', '30D', '90D', '6M', '1Y'];

function TrendChart({ values }: { values: number[] }) {
  const width = 760;
  const height = 230;
  const padding = 22;
  const min = Math.min(...values) - 3;
  const max = Math.max(...values) + 3;
  const points = values.map((value, index) => `${padding + (index * (width - padding * 2)) / (values.length - 1)},${height - padding - ((value - min) / (max - min)) * (height - padding * 2)}`).join(' ');
  return <div className="overflow-hidden rounded-xl border border-surface-200 bg-white p-4 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)]"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-600">Trend</p><h3 className="mt-1 text-base font-bold text-surface-950">Overall score over time</h3></div><span className="text-xs text-surface-500">Current period</span></div><svg viewBox={`0 0 ${width} ${height}`} className="mt-5 h-[230px] w-full" role="img" aria-label="Overall score trend from 78 to 91"><line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} stroke="#e4e4e7" /><line x1={padding} x2={width - padding} y1={padding} y2={padding} stroke="#f4f4f5" /><polyline fill="none" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={points} />{values.map((trendPoint, index) => { const [x, y] = points.split(' ')[index].split(','); return <circle key={`${trendPoint}-${x}-${y}`} cx={x} cy={y} r="4" fill="white" stroke="#4f46e5" strokeWidth="2" />; })}<text x={padding} y={height - 4} fill="#71717a" fontSize="11">Aug 12</text><text x={width - 54} y={height - 4} fill="#71717a" fontSize="11">Aug 19</text><text x={padding} y={padding - 5} fill="#71717a" fontSize="11">{Math.max(...values)}</text></svg></div>;
}

export default function Reports() {
  const [period, setPeriod] = useState('30D');
  const [comparison, setComparison] = useState('Previous period');
  const [pillarFilter, setPillarFilter] = useState('All pillars');
  const visiblePillars = useMemo(() => reportPillars.filter((pillar) => pillarFilter === 'All pillars' || pillar.label === pillarFilter), [pillarFilter]);
  const currentScore = 91;
  const previousScore = 85;
  const exportCsv = () => {
    const rows = ['Pillar,Current score,Previous score,Change,Status', ...reportPillars.map((pillar) => `${pillar.label},${pillar.current},${pillar.previous},${pillar.current - pillar.previous},${pillar.status}`)];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `scorelo-report-${period.toLowerCase()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-8 p-5 pb-16 md:p-8">
      <ModuleHeader eyebrow="Performance intelligence" title="Reports" description="Understand how your store performance is changing over time." actions={<><Button variant="secondary"><CalendarDays size={15} />{period}</Button><Button variant="secondary" onClick={exportCsv}><Download size={15} />Export CSV</Button><Button><FileText size={15} />Create report</Button></>} />

      <section className="flex flex-col gap-3 rounded-xl border border-surface-200 bg-white p-3 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)] sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap items-center gap-1.5"><span className="mr-2 text-[10px] font-bold uppercase tracking-[0.14em] text-surface-500">Period</span>{periods.map((item) => <button key={item} onClick={() => setPeriod(item)} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${period === item ? 'bg-slate-950 text-white' : 'text-surface-600 hover:bg-surface-100'}`}>{item}</button>)}</div><div className="flex flex-wrap gap-2"><select value={pillarFilter} onChange={(event) => setPillarFilter(event.target.value)} className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-xs font-semibold text-surface-700"><option>All pillars</option>{reportPillars.map((pillar) => <option key={pillar.key}>{pillar.label}</option>)}</select><select value={comparison} onChange={(event) => setComparison(event.target.value)} className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-xs font-semibold text-surface-700"><option>Previous period</option><option>Previous year</option></select></div></section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5"><MetricTile label="Overall score" value={currentScore} detail="out of 100" tone="success" /><MetricTile label="Change" value={`+${currentScore - previousScore}`} detail={`${comparison.toLowerCase()}`} tone="success" /><MetricTile label="Issues resolved" value="14" detail="Across all pillars" tone="info" /><MetricTile label="Critical issues" value="2" detail="Need attention" tone="critical" /><MetricTile label="Pages analyzed" value="1,342" detail="Latest audit" /></section>

      <section className="grid gap-5 xl:grid-cols-[1.5fr_1fr]"><TrendChart values={reportTrend} /><div className="rounded-xl border border-surface-200 bg-white p-5 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)] sm:p-6"><SectionHeading eyebrow="At a glance" title="What changed" /><div className="mt-5 space-y-4"><div className="flex gap-3"><div className="rounded-lg bg-success-50 p-2 text-success-700"><TrendingUp size={16} /></div><div><p className="text-sm font-bold text-surface-900">SEO improved by 6 points</p><p className="mt-1 text-xs leading-5 text-surface-500">Metadata coverage and structured data moved the largest pillar forward.</p></div></div><div className="flex gap-3"><div className="rounded-lg bg-warning-50 p-2 text-warning-700"><TrendingDown size={16} /></div><div><p className="text-sm font-bold text-surface-900">Content remains the widest gap</p><p className="mt-1 text-xs leading-5 text-surface-500">Thin product copy and media coverage are the clearest next opportunities.</p></div></div></div></div></section>

      <section className="space-y-4"><SectionHeading eyebrow="Comparison" title="Pillar performance" description={`Current period compared with ${comparison.toLowerCase()}.`} /><div className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)]"><div className="hidden grid-cols-[1.4fr_0.7fr_0.8fr_0.7fr_1.5fr_0.8fr] gap-4 border-b border-surface-200 bg-surface-50 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-surface-500 sm:grid"><span>Pillar</span><span>Current</span><span>Previous</span><span>Change</span><span>Progress</span><span>Status</span></div><div className="divide-y divide-surface-100">{visiblePillars.map((pillar) => { const delta = pillar.current - pillar.previous; return <div key={pillar.key} className="grid gap-3 px-5 py-4 transition hover:bg-surface-50 sm:grid-cols-[1.4fr_0.7fr_0.8fr_0.7fr_1.5fr_0.8fr] sm:items-center sm:gap-4"><div className="flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pillar.color }} /><span className="text-sm font-bold text-surface-900">{pillar.label}</span></div><div className="text-sm font-bold text-surface-900 tabular-nums">{pillar.current}</div><div className="text-sm text-surface-500 tabular-nums">{pillar.previous}</div><div className={`text-sm font-bold tabular-nums ${delta >= 0 ? 'text-success-700' : 'text-critical-700'}`}>{delta >= 0 ? '+' : ''}{delta}</div><div className="h-2 overflow-hidden rounded-full bg-surface-100"><div className="h-full rounded-full" style={{ width: `${pillar.current}%`, backgroundColor: pillar.color }} /></div><div><span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-bold" style={{ color: pillar.color, borderColor: pillar.color, backgroundColor: `${pillar.color}12` }}><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: pillar.color }} />{pillar.status}</span></div></div>; })}</div></div></section>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]"><div className="rounded-xl border border-surface-200 bg-white p-5 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)] sm:p-6"><SectionHeading eyebrow="Report history" title="Previous reports" /><div className="mt-5 divide-y divide-surface-100">{['August Performance Report', 'July Performance Report', 'June Performance Report'].map((report, index) => <div key={report} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="flex items-center gap-3"><div className="rounded-lg bg-surface-100 p-2 text-surface-600"><FileText size={16} /></div><div><p className="text-sm font-bold text-surface-900">{report}</p><p className="mt-1 text-xs text-surface-500">{index === 0 ? 'Aug 19, 2026' : index === 1 ? 'Jul 31, 2026' : 'Jun 30, 2026'}</p></div></div><Button variant="ghost"><Share2 size={14} />View</Button></div>)}</div></div><div className="rounded-xl border border-brand-100 bg-brand-50 p-5 sm:p-6"><LineChart size={20} className="text-brand-700" /><h3 className="mt-4 text-lg font-bold text-brand-950">Ready to share?</h3><p className="mt-2 text-sm leading-6 text-brand-800">Export the current pillar comparison as CSV for internal review or client reporting.</p><Button variant="primary" onClick={exportCsv}><Download size={15} />Export data</Button></div></section>
    </div>
  );
}
