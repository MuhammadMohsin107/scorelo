import { useMemo, useState } from 'react';
import { ArrowRight, Search, SlidersHorizontal } from 'lucide-react';
import {
  HEALTHY,
  isIssueStatus,
  severityForStatus,
  type EvidenceColumn,
  type EvidenceConfig,
  type EvidenceRow,
  type RowStatus,
  type SubPillarFinding,
} from '../../../data/seo/subpillar.model';
import SeverityBadge from './SeverityBadge';
import BulkFixWorkflow from './BulkFixWorkflow';
import { card, cardHeader, cardTitle, eyebrow } from './tone';

interface Props {
  evidence: EvidenceConfig;
  totalIssues: number;
  statusFilter: RowStatus | 'All';
  onStatusFilterChange: (next: RowStatus | 'All') => void;
  findings: SubPillarFinding[];
  onInvestigate: (finding: SubPillarFinding) => void;
  supportsBulkFix?: boolean;
  bulkFixMode?: 'title-tags' | 'generic';
}

const alignClass = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

export default function EvidenceTable({
  evidence,
  totalIssues,
  statusFilter,
  onStatusFilterChange,
  findings,
  onInvestigate,
  supportsBulkFix = false,
  bulkFixMode = 'generic',
}: Props) {
  const [search, setSearch] = useState('');
  const [facet, setFacet] = useState('All');
  const [sortKey, setSortKey] = useState(evidence.sorts[0]?.key ?? '');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkFixOpen, setIsBulkFixOpen] = useState(false);
  const [workingRows, setWorkingRows] = useState(evidence.rows);

  const statusFilters: (RowStatus | 'All')[] = useMemo(
    () => ['All', ...findings.filter((finding) => finding.affected > 0).map((finding) => finding.issueType), HEALTHY],
    [findings],
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = workingRows.filter((row) => {
      if (statusFilter !== 'All' && row.status !== statusFilter) return false;
      if (evidence.facet && facet !== 'All' && row.facet !== facet) return false;
      if (!query) return true;
      return evidence.searchKeys.some((key) => String(row.cells[key] ?? '').toLowerCase().includes(query));
    });
    const sort = evidence.sorts.find((option) => option.key === sortKey) ?? evidence.sorts[0];
    return sort ? [...filtered].sort(sort.compare) : filtered;
  }, [evidence, facet, search, sortKey, statusFilter, workingRows]);

  const selectedRows = workingRows.filter((row) => selectedIds.includes(row.id));
  const selectedVisible = visible.filter((row) => selectedIds.includes(row.id));
  const allVisibleSelected = visible.length > 0 && selectedVisible.length === visible.length;
  const someVisibleSelected = selectedVisible.length > 0 && !allVisibleSelected;

  const toggleVisibleSelection = () => {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visible.some((row) => row.id === id))
        : [...new Set([...current, ...visible.map((row) => row.id)])],
    );
  };

  const toggleRowSelection = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const applyUpdates = (updates: { id: string; before: string; after: string; status: RowStatus }[]) => {
    setWorkingRows((current) =>
      current.map((row) => {
        const update = updates.find((item) => item.id === row.id);
        if (!update) return row;
        const matchingCell = Object.keys(row.cells).find((key) => String(row.cells[key] ?? '') === (row.current?.value ?? ''));
        const cells = { ...row.cells, ...(matchingCell ? { [matchingCell]: update.after } : {}) };
        if ('title' in row.cells) cells.title = update.after;
        if ('length' in row.cells) cells.length = update.after.length;
        return {
          ...row,
          status: update.status,
          cells,
          current: { label: 'Current', value: update.after, meta: String(row.cells.url ?? '') },
          suggested: undefined,
        };
      }),
    );
  };

  const renderCell = (row: EvidenceRow, column: EvidenceColumn) => {
    const value = row.cells[column.key];
    const sub = column.subKey ? row.cells[column.subKey] : undefined;

    if (column.variant === 'severity') return <SeverityBadge severity={severityForStatus(row.status, findings)} showIcon={false} />;
    if (column.variant === 'status') {
      const issue = isIssueStatus(row.status);
      return <span className={`text-xs ${issue ? 'font-medium text-surface-800' : 'text-surface-400'}`}>{issue ? row.status : '—'}</span>;
    }
    if (column.variant === 'action') {
      const finding = isIssueStatus(row.status) ? findings.find((item) => item.issueType === row.status) : undefined;
      return finding ? (
        <button type="button" onClick={() => onInvestigate(finding)} className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50 hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" aria-label={`Investigate ${row.status} issue`}>
          Investigate <ArrowRight size={12} />
        </button>
      ) : <span className="text-xs text-surface-300">—</span>;
    }

    const isEmpty = value === '' || value === null || value === undefined;
    const text = isEmpty ? (column.emptyText ?? '—') : String(value);
    const clamp = column.clamp ?? 'max-w-[18rem]';
    const body = column.variant === 'mono' ? (
      <p className={`${clamp} truncate font-mono text-xs text-surface-600`} title={text}>{text}</p>
    ) : column.variant === 'number' ? (
      <span className="text-xs font-medium tabular-nums text-surface-700">{text}</span>
    ) : column.variant === 'muted' ? (
      <p className={`${clamp} truncate text-xs text-surface-500`} title={text}>{text}</p>
    ) : (
      <p className={`${clamp} truncate text-xs ${isEmpty ? 'italic text-surface-400' : 'text-surface-900'}`} title={isEmpty ? undefined : text}>{text}</p>
    );
    if (sub === undefined || sub === null || sub === '') return body;
    return <>{body}<p className={`mt-0.5 ${clamp} truncate text-[11px] text-surface-400`}>{String(sub)}</p></>;
  };

  return (
    <section className={`${card} overflow-hidden`} aria-labelledby="sp-evidence-title">
      <div className={`${cardHeader} px-6 py-4`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className={eyebrow}>Evidence</p><h2 id="sp-evidence-title" className={`mt-1.5 ${cardTitle}`}>{evidence.title}</h2></div>
          <p className="text-xs text-surface-500">Sample of <span className="font-semibold tabular-nums text-surface-700">{workingRows.length}</span> {evidence.sampleNoun} · <span className="font-semibold tabular-nums text-surface-700">{totalIssues.toLocaleString()}</span> flagged store-wide</p>
        </div>
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative block lg:max-w-xs lg:flex-1">
            <span className="sr-only">Search evidence</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" aria-hidden="true" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={evidence.searchPlaceholder} className="h-9 w-full rounded-lg border border-surface-200 bg-surface-50 pl-9 pr-3 text-sm text-surface-900 outline-none transition-colors placeholder:text-surface-400 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100" />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {evidence.facet && <label className="inline-flex items-center gap-1.5 text-xs text-surface-500"><SlidersHorizontal size={13} aria-hidden="true" /><span className="sr-only sm:not-sr-only">{evidence.facet.label}</span><select value={facet} onChange={(event) => setFacet(event.target.value)} className="h-9 cursor-pointer rounded-lg border border-surface-200 bg-white px-2 text-xs font-medium text-surface-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"><option value="All">{evidence.facet.allLabel}</option>{evidence.facet.values.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>}
            <label className="inline-flex items-center gap-1.5 text-xs text-surface-500"><span className="sr-only sm:not-sr-only">Sort</span><select value={sortKey} onChange={(event) => setSortKey(event.target.value)} className="h-9 cursor-pointer rounded-lg border border-surface-200 bg-white px-2 text-xs font-medium text-surface-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100">{evidence.sorts.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
          </div>
        </div>
        <div className="mt-3 inline-flex flex-wrap gap-0.5 rounded-lg border border-surface-200 bg-surface-100/70 p-0.5" role="group" aria-label="Filter by issue">
          {statusFilters.map((status) => {
            const active = statusFilter === status;
            const count = status === 'All' ? workingRows.length : workingRows.filter((row) => row.status === status).length;
            return <button key={status} type="button" onClick={() => onStatusFilterChange(status)} aria-pressed={active} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${active ? 'bg-white text-surface-950 shadow-[0_1px_2px_rgba(16,24,40,0.08)]' : 'text-surface-500 hover:text-surface-800'}`}>{status}<span className="tabular-nums text-surface-400">{count}</span></button>;
          })}
        </div>
        {supportsBulkFix && selectedIds.length > 0 && <div className="mt-3 flex flex-col gap-2 rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"><span className="text-xs font-semibold text-brand-800">{selectedIds.length} selected</span><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setIsBulkFixOpen(true)} className="btn-primary h-9 min-h-0 px-3 text-xs">Generate fixes</button><button type="button" onClick={() => setSelectedIds([])} className="btn-ghost h-9 min-h-0 px-3 text-xs">Deselect all</button></div></div>}
      </div>

      {visible.length === 0 ? <div className="px-6 py-12 text-center"><p className="text-sm font-semibold text-surface-900">Nothing matches these filters</p><p className="mt-1 text-xs text-surface-500">Clear the search or pick a different issue.</p></div> : <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">{evidence.caption}</caption><thead className="border-b border-surface-200 bg-white"><tr className="[&>th]:px-6 [&>th]:py-2.5 [&>th]:text-[10px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-[0.08em] [&>th]:text-surface-400">{supportsBulkFix && <th scope="col" className="w-12"><input type="checkbox" checked={allVisibleSelected} ref={(element) => { if (element) element.indeterminate = someVisibleSelected; }} onChange={toggleVisibleSelection} aria-label="Select visible rows" className="h-4 w-4 cursor-pointer rounded border-surface-300 text-brand-600 focus:ring-brand-500" /></th>}{evidence.columns.map((column) => <th key={column.key} scope="col" className={alignClass[column.align ?? 'left']}>{column.header}</th>)}</tr></thead><tbody className="divide-y divide-surface-200">{visible.map((row) => <tr key={row.id} className="transition-colors hover:bg-surface-50">{supportsBulkFix && <td className="px-6 py-3"><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleRowSelection(row.id)} aria-label={`Select ${String(row.cells.url ?? row.id)}`} className="h-4 w-4 cursor-pointer rounded border-surface-300 text-brand-600 focus:ring-brand-500" /></td>}{evidence.columns.map((column) => <td key={column.key} className={`px-6 py-3 ${alignClass[column.align ?? 'left']}`}>{renderCell(row, column)}</td>)}</tr>)}</tbody></table></div>}
      {supportsBulkFix && isBulkFixOpen && <BulkFixWorkflow rows={selectedRows} mode={bulkFixMode} onClose={() => setIsBulkFixOpen(false)} onApply={applyUpdates} />}
    </section>
  );
}
