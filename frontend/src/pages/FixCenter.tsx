import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronRight, RefreshCw, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import type { FixFinding, WorkflowSeverity, WorkflowStatus } from '../data/workflows.mock';
import { bulkUpdateFindingStatus, fetchFindings, updateFindingStatus } from '../data/findings.repository';
import { Button, Drawer, MetricTile, ModuleHeader, SectionHeading, StatusBadge } from '../components/workflows/WorkflowPrimitives';

const severityTone: Record<WorkflowSeverity, 'critical' | 'warning' | 'info' | 'neutral'> = { critical: 'critical', high: 'warning', medium: 'info', low: 'neutral' };
const statusTone: Record<WorkflowStatus, 'critical' | 'warning' | 'success' | 'neutral'> = { open: 'critical', reviewed: 'warning', resolved: 'success', ignored: 'neutral' };
const statusLabel: Record<WorkflowStatus, string> = { open: 'Open', reviewed: 'Reviewed', resolved: 'Resolved', ignored: 'Ignored' };

export default function FixCenter() {
  const [findings, setFindings] = useState<FixFinding[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'success' | 'error'>('loading');
  const [query, setQuery] = useState('');
  const [pillar, setPillar] = useState('All pillars');
  const [severity, setSeverity] = useState('All severity');
  const [status, setStatus] = useState('All status');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<FixFinding | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  /** Set when a status write fails, after the optimistic change has been rolled back. */
  const [actionError, setActionError] = useState<string | null>(null);

  const loadFindings = () => fetchFindings()
    .then((data) => { setFindings(data); setLoadState('success'); })
    .catch((error) => { console.error('Failed to load findings', error); setLoadState('error'); });

  useEffect(() => {
    loadFindings();
  }, []);

  const filteredFindings = useMemo(() => findings.filter((finding) => {
    const haystack = `${finding.title} ${finding.pillarLabel} ${finding.subPillar}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase()))
      && (pillar === 'All pillars' || finding.pillarLabel === pillar)
      && (severity === 'All severity' || finding.severity === severity)
      && (status === 'All status' || finding.status === status);
  }), [findings, pillar, query, severity, status]);

  /**
   * Status changes are applied optimistically for responsiveness, but a failed request now
   * ROLLS THE UI BACK and says so.
   *
   * Previously the failure was only console.error'd: the row kept its new badge while the
   * database still held the old status, so the merchant believed an issue was handled until a
   * refresh silently undid it. Showing stale success is worse than showing an error.
   */
  const updateFinding = (id: string, nextStatus: WorkflowStatus) => {
    const previous = findings;
    const previousSelected = selectedFinding;
    setActionError(null);
    setFindings((current) => current.map((finding) => finding.id === id ? { ...finding, status: nextStatus } : finding));
    setSelectedFinding((current) => current?.id === id ? { ...current, status: nextStatus } : current);

    updateFindingStatus(id, nextStatus).catch((error) => {
      console.error('Failed to update finding status', error);
      setFindings(previous);
      setSelectedFinding(previousSelected);
      setActionError('We could not update that finding. Please try again.');
    });
  };

  const markSelectedReviewed = () => {
    const ids = selectedIds;
    const previous = findings;
    setActionError(null);
    setFindings((current) => current.map((finding) => ids.includes(finding.id) ? { ...finding, status: 'reviewed' } : finding));
    setSelectedIds([]);

    bulkUpdateFindingStatus(ids, 'reviewed').catch((error) => {
      console.error('Failed to bulk-update findings', error);
      setFindings(previous);
      setSelectedIds(ids);
      setActionError(`We could not update ${ids.length === 1 ? 'that finding' : `those ${ids.length} findings`}. Please try again.`);
    });
  };

  const refresh = () => {
    setIsRefreshing(true);
    loadFindings().finally(() => setIsRefreshing(false));
  };

  const allSelected = filteredFindings.length > 0 && filteredFindings.every((finding) => selectedIds.includes(finding.id));
  const openCount = findings.filter((finding) => finding.status === 'open').length;
  const resolvedCount = findings.filter((finding) => finding.status === 'resolved').length;

  if (loadState === 'loading') {
    return <div className="mx-auto max-w-[1440px] p-8 text-sm text-surface-500">Loading findings…</div>;
  }

  if (loadState === 'error') {
    return <div className="mx-auto max-w-[1440px] p-8 text-sm text-critical-600">Failed to load findings. Please try again.</div>;
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-8 p-5 pb-16 md:p-8">
      <ModuleHeader
        eyebrow="Execution workspace"
        title="Fix Center"
        description="Prioritize the issues that have the biggest impact on your store performance."
        actions={(
          <>
            <Button variant="secondary" onClick={refresh}><RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />{isRefreshing ? 'Refreshing' : 'Refresh'}</Button>
          </>
        )}
      />

      {actionError && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-critical-100 bg-critical-50 px-4 py-3">
          <AlertCircle size={16} className="mt-px flex-shrink-0 text-critical-600" aria-hidden="true" />
          <p className="text-sm leading-5 text-critical-700">{actionError}</p>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Finding summary">
        <MetricTile label="Total findings" value={findings.length} detail={`${openCount} still open`} />
        <MetricTile label="Critical" value={findings.filter((finding) => finding.severity === 'critical').length} detail="Needs immediate attention" tone="critical" />
        <MetricTile label="High" value={findings.filter((finding) => finding.severity === 'high').length} detail="High impact opportunities" tone="warning" />
        <MetricTile label="Medium" value={findings.filter((finding) => finding.severity === 'medium').length} detail="Worth scheduling" tone="info" />
        <MetricTile label="Resolved" value={resolvedCount} detail="Tracked in history" tone="success" />
      </section>

      <section className="space-y-4" aria-labelledby="priority-findings-title">
        <SectionHeading eyebrow="Priority queue" title="Findings to work through" description="Review evidence first, then choose the smallest supported action." action={selectedIds.length > 0 ? <Button onClick={markSelectedReviewed}><Check size={15} />Mark reviewed ({selectedIds.length})</Button> : undefined} />
        <div className="flex flex-col gap-3 rounded-xl border border-surface-200 bg-white p-3 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)] lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" /><span className="sr-only">Search findings</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search issue, pillar, or sub-pillar" className="w-full rounded-lg border border-surface-200 bg-surface-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100" /></label>
          <div className="flex flex-wrap gap-2"><SlidersHorizontal size={16} className="mt-2 text-surface-400" />
            <select value={pillar} onChange={(event) => setPillar(event.target.value)} className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 outline-none focus:border-brand-400"><option>All pillars</option>{['SEO', 'Content', 'Speed', 'CRO', 'AI Discovery'].map((item) => <option key={item}>{item}</option>)}</select>
            <select value={severity} onChange={(event) => setSeverity(event.target.value)} className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 outline-none focus:border-brand-400"><option>All severity</option>{['critical', 'high', 'medium', 'low'].map((item) => <option key={item}>{item}</option>)}</select>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 outline-none focus:border-brand-400"><option>All status</option>{['open', 'reviewed', 'resolved', 'ignored'].map((item) => <option key={item}>{item}</option>)}</select>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)]">
          <div className="hidden grid-cols-[32px_minmax(220px,1.8fr)_0.8fr_0.9fr_0.7fr_0.7fr_0.8fr_86px] gap-4 border-b border-surface-200 bg-surface-50 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-surface-500 lg:grid"><span><input type="checkbox" checked={allSelected} onChange={() => setSelectedIds(allSelected ? [] : filteredFindings.map((finding) => finding.id))} aria-label="Select all findings" /></span><span>Issue</span><span>Pillar</span><span>Sub-pillar</span><span>Severity</span><span>Affected</span><span>Status</span><span /></div>
          {filteredFindings.length === 0 ? <div className="px-6 py-14 text-center"><Sparkles size={24} className="mx-auto text-success-600" /><h3 className="mt-3 text-sm font-bold text-surface-900">No issues found</h3><p className="mt-1 text-sm text-surface-500">Try a different filter or search term.</p></div> : <div className="divide-y divide-surface-100">{filteredFindings.map((finding) => <div key={finding.id} className="grid gap-3 px-5 py-4 transition hover:bg-surface-50 lg:grid-cols-[32px_minmax(220px,1.8fr)_0.8fr_0.9fr_0.7fr_0.7fr_0.8fr_86px] lg:items-center lg:gap-4"><div><input type="checkbox" checked={selectedIds.includes(finding.id)} onChange={() => setSelectedIds((current) => current.includes(finding.id) ? current.filter((id) => id !== finding.id) : [...current, finding.id])} aria-label={`Select ${finding.title}`} /></div><div><button onClick={() => setSelectedFinding(finding)} className="text-left text-sm font-bold text-surface-900 hover:text-brand-700">{finding.title}</button><p className="mt-1 text-xs text-surface-500">{finding.impact} impact <span className="mx-1 text-surface-300">|</span> +{finding.scoreLift} potential pts</p></div><div className="text-xs font-semibold text-surface-700">{finding.pillarLabel}</div><div className="text-xs text-surface-600">{finding.subPillar}</div><div><StatusBadge label={finding.severity} tone={severityTone[finding.severity]} /></div><div className="text-xs font-semibold text-surface-700 tabular-nums">{finding.affected.toLocaleString()} {finding.affectedLabel}</div><div><StatusBadge label={statusLabel[finding.status]} tone={statusTone[finding.status]} /></div><div className="flex justify-end"><button onClick={() => setSelectedFinding(finding)} className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800">Review <ChevronRight size={14} /></button></div></div>)}</div>}
        </div>
      </section>

      <section className="rounded-xl border border-surface-200 bg-white p-5 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)] sm:p-6"><SectionHeading eyebrow="History" title="Applied fixes" description="A lightweight record of actions taken in this audit workspace." /><div className="mt-5 divide-y divide-surface-100">{findings.filter((finding) => finding.status !== 'open').map((finding) => <div key={finding.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-bold text-surface-900">{finding.title}</p><p className="mt-1 text-xs text-surface-500">{statusLabel[finding.status]}{finding.statusChangedAt && <><span className="mx-1 text-surface-300">|</span> {new Date(finding.statusChangedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>}</p></div><span className="text-sm font-bold text-success-700">Potential +{finding.scoreLift} pts</span></div>)}</div></section>

      <Drawer open={Boolean(selectedFinding)} title={selectedFinding?.title ?? ''} eyebrow="Finding detail" onClose={() => setSelectedFinding(null)}>
        {selectedFinding && <div className="space-y-6"><div className="flex flex-wrap gap-2"><StatusBadge label={selectedFinding.severity} tone={severityTone[selectedFinding.severity]} /><StatusBadge label={selectedFinding.pillarLabel} tone="neutral" /><StatusBadge label={statusLabel[selectedFinding.status]} tone={statusTone[selectedFinding.status]} /></div><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-surface-500">Why this matters</p><p className="mt-2 text-sm leading-6 text-surface-700">{selectedFinding.why}</p></div><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-surface-500">Detected evidence</p><ul className="mt-2 space-y-2">{selectedFinding.evidence.map((item) => <li key={item} className="flex gap-2 text-sm text-surface-700"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />{item}</li>)}</ul></div><div className="rounded-xl border border-brand-100 bg-brand-50 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700">Recommended action</p><p className="mt-2 text-sm leading-6 text-brand-950">{selectedFinding.recommendation}</p></div><div className="grid grid-cols-2 gap-3"><MetricTile label="Affected" value={selectedFinding.affected.toLocaleString()} detail={selectedFinding.affectedLabel} tone="critical" /><MetricTile label="Potential lift" value={`+${selectedFinding.scoreLift}`} detail="Score points" tone="success" /></div><div className="flex flex-wrap gap-2"><Button onClick={() => updateFinding(selectedFinding.id, 'reviewed')}><Check size={15} />Mark reviewed</Button><Button variant="secondary" onClick={() => updateFinding(selectedFinding.id, 'ignored')}><X size={15} />Ignore</Button><Button variant="ghost" onClick={() => setSelectedFinding(null)}>Close</Button></div></div>}
      </Drawer>
    </div>
  );
}
