import { useMemo, useState } from 'react';
import { ArrowRight, Search, SlidersHorizontal } from 'lucide-react';
import {
  HEALTHY,
  findingForRow,
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
import { card, cardHeader, cardHeadingRow, cardTitle, eyebrow } from './tone';

interface Props {
  evidence: EvidenceConfig;
  totalIssues: number;
  statusFilter: RowStatus | 'All';
  onStatusFilterChange: (next: RowStatus | 'All') => void;
  findings: SubPillarFinding[];
  /** The items the drawer should show: the ticked rows, or just the row that was pressed. */
  onInvestigate: (finding: SubPillarFinding, rows: EvidenceRow[]) => void;
  supportsBulkFix?: boolean;
  bulkFixMode?: 'title-tags' | 'generic';
  /** Characters the theme appends to every rendered title, measured by the audit. */
  titleSuffixLength?: number;
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
  titleSuffixLength = 0,
}: Props) {
  const [search, setSearch] = useState('');
  const [facet, setFacet] = useState('All');
  const [sortKey, setSortKey] = useState(evidence.sorts[0]?.key ?? '');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkFixOpen, setIsBulkFixOpen] = useState(false);
  const [workingRows, setWorkingRows] = useState(evidence.rows);

  const statusFilters: (RowStatus | 'All')[] = useMemo(
    () => ['All', ...findings.filter((finding) => finding.affected > 0).map((finding) => finding.issueType), evidence.healthyStatus ?? HEALTHY],
    [findings, evidence.healthyStatus],
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
    const primary = row.cells[column.key];
    const value = (primary === undefined || primary === null || primary === '') && column.fallbackKey
      ? row.cells[column.fallbackKey]
      : primary;
    const sub = column.subKey ? row.cells[column.subKey] : undefined;

    if (column.variant === 'severity') return <SeverityBadge severity={severityForStatus(row.status, findings, evidence.healthyStatus)} showIcon={false} />;
    if (column.variant === 'status') {
      const issue = isIssueStatus(row.status, evidence.healthyStatus);
      return <span className={`text-[12px] ${issue ? 'font-medium text-surface-800' : 'text-surface-400'}`}>{issue ? row.status : '—'}</span>;
    }
    if (column.variant === 'action') {
      const finding = findingForRow(row, findings, evidence.healthyStatus);
      // The items travel with the finding: this button is per item, so the drawer opens on what
      // was actually chosen rather than on a generic sample of the issue type. Pressing Investigate
      // on a row that is part of a tick selection investigates that whole selection; pressing it on
      // any other row is a question about that row alone, whatever else happens to be ticked.
      const investigating = selectedIds.includes(row.id) ? selectedRows : [row];
      return finding ? (
        <button type="button" onClick={() => onInvestigate(finding, investigating)} className="inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] font-semibold text-brand-700 transition-colors hover:bg-brand-50 hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" aria-label={`Investigate ${row.status} issue`}>
          Investigate <ArrowRight size={11} />
        </button>
      ) : <span className="text-[12px] text-surface-300">—</span>;
    }

    const isEmpty = value === '' || value === null || value === undefined;
    const text = isEmpty ? (column.emptyText ?? '—') : String(value);
    const clamp = column.clamp ?? 'max-w-[18rem]';
    const body = column.variant === 'mono' ? (
      <p className={`${clamp} truncate font-mono text-[11.5px] text-surface-600`} title={text}>{text}</p>
    ) : column.variant === 'number' ? (
      <span className="text-[12px] font-medium tabular-nums text-surface-700">{text}</span>
    ) : column.variant === 'muted' ? (
      <p className={`${clamp} truncate text-[12px] text-surface-500`} title={text}>{text}</p>
    ) : (
      <p className={`${clamp} truncate text-[12px] ${isEmpty ? 'italic text-surface-400' : 'text-surface-900'}`} title={isEmpty ? undefined : text}>{text}</p>
    );
    if (sub === undefined || sub === null || sub === '') return body;
    return <>{body}<p className={`${clamp} truncate text-[10.5px] leading-[1.35] text-surface-400`}>{String(sub)}</p></>;
  };

  return (
    <section className={`${card} overflow-hidden`} aria-labelledby="sp-evidence-title">
      <div className={cardHeader}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className={cardHeadingRow}><p className={eyebrow}>Evidence</p><h2 id="sp-evidence-title" className={cardTitle}>{evidence.title}</h2></div>
          <p className="text-[11px] text-surface-500">Sample of <span className="font-semibold tabular-nums text-surface-700">{workingRows.length}</span> {evidence.sampleNoun} · <span className="font-semibold tabular-nums text-surface-700">{totalIssues.toLocaleString()}</span> flagged store-wide</p>
        </div>
        {/* Search, facet, sort and the issue filters share one row from `lg` up: four controls that
            each fit in 28px have no reason to occupy three stacked bands above the data. */}
        <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
          <label className="relative block lg:w-56">
            <span className="sr-only">Search evidence</span>
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400" aria-hidden="true" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={evidence.searchPlaceholder} className="h-7 w-full rounded-md border border-surface-200 bg-surface-50 pl-7 pr-2 text-[12px] text-surface-900 outline-none transition-colors placeholder:text-surface-400 focus:border-brand-400 focus:bg-surface-0 focus:ring-2 focus:ring-brand-100" />
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {evidence.facet && <label className="inline-flex items-center gap-1 text-[11px] text-surface-500"><SlidersHorizontal size={12} aria-hidden="true" /><span className="sr-only">{evidence.facet.label}</span><select value={facet} onChange={(event) => setFacet(event.target.value)} className="h-7 cursor-pointer rounded-md border border-surface-200 bg-surface-0 px-1.5 text-[11.5px] font-medium text-surface-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"><option value="All">{evidence.facet.allLabel}</option>{evidence.facet.values.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>}
            {evidence.sorts.length > 0 && <label className="inline-flex items-center gap-1 text-[11px] text-surface-500"><span className="sr-only">Sort</span><select value={sortKey} onChange={(event) => setSortKey(event.target.value)} className="h-7 cursor-pointer rounded-md border border-surface-200 bg-surface-0 px-1.5 text-[11.5px] font-medium text-surface-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100">{evidence.sorts.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>}
          </div>
          <div className="inline-flex flex-wrap gap-0.5 rounded-md border border-surface-200 bg-surface-100/70 p-0.5" role="group" aria-label="Filter by issue">
            {statusFilters.map((status) => {
              const active = statusFilter === status;
              const count = status === 'All' ? workingRows.length : workingRows.filter((row) => row.status === status).length;
              return <button key={status} type="button" onClick={() => onStatusFilterChange(status)} aria-pressed={active} className={`inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${active ? 'bg-surface-0 text-surface-950 shadow-[0_1px_2px_var(--c-shadow-md)]' : 'text-surface-500 hover:text-surface-800'}`}>{status}<span className="tabular-nums text-surface-400">{count}</span></button>;
            })}
          </div>
        </div>
        {supportsBulkFix && selectedIds.length > 0 && <div className="mt-2 flex flex-col gap-1.5 rounded-md border border-brand-100 bg-brand-50/60 px-2.5 py-1.5 sm:flex-row sm:items-center sm:justify-between"><span className="text-[11.5px] font-semibold text-brand-800">{selectedIds.length} selected</span><div className="flex flex-wrap gap-1.5"><button type="button" onClick={() => setIsBulkFixOpen(true)} className="btn-primary btn-xs">Generate fixes</button><button type="button" onClick={() => setSelectedIds([])} className="btn-ghost btn-xs">Deselect all</button></div></div>}
      </div>

      {visible.length === 0 ? <div className="px-4 py-8 text-center"><p className="text-[13px] font-semibold text-surface-900">Nothing matches these filters</p><p className="mt-0.5 text-[11.5px] text-surface-500">Clear the search or pick a different issue.</p></div> : <div className="overflow-x-auto"><table className="table-compact w-full"><caption className="sr-only">{evidence.caption}</caption><thead className="border-b border-surface-200 bg-surface-0"><tr>{supportsBulkFix && <th scope="col" className="w-9"><input type="checkbox" checked={allVisibleSelected} ref={(element) => { if (element) element.indeterminate = someVisibleSelected; }} onChange={toggleVisibleSelection} aria-label="Select visible rows" className="h-3.5 w-3.5 cursor-pointer rounded border-surface-300 text-brand-600 focus:ring-brand-500" /></th>}{evidence.columns.map((column) => <th key={column.key} scope="col" className={alignClass[column.align ?? 'left']}>{column.header}</th>)}</tr></thead><tbody className="divide-y divide-surface-200">{visible.map((row) => <tr key={row.id} className="transition-colors hover:bg-surface-50">{supportsBulkFix && <td><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleRowSelection(row.id)} aria-label={`Select ${String(row.cells.url ?? row.id)}`} className="h-3.5 w-3.5 cursor-pointer rounded border-surface-300 text-brand-600 focus:ring-brand-500" /></td>}{evidence.columns.map((column) => <td key={column.key} className={alignClass[column.align ?? 'left']}>{renderCell(row, column)}</td>)}</tr>)}</tbody></table></div>}
      {supportsBulkFix && isBulkFixOpen && (
        <BulkFixWorkflow
          rows={selectedRows}
          mode={bulkFixMode}
          titleSuffixLength={titleSuffixLength}
          // Resolved here rather than inside the workflow: this component already owns the
          // row→finding mapping (it is what the Investigate button uses), and AI planning is
          // scoped to a finding, so the selection has to carry which finding each row came from.
          findingIdByRowId={Object.fromEntries(
            selectedRows
              .map((row) => [row.id, findingForRow(row, findings, evidence.healthyStatus)?.id])
              .filter((entry): entry is [string, string] => Boolean(entry[1])),
          )}
          onClose={() => setIsBulkFixOpen(false)}
          onApply={applyUpdates}
        />
      )}
    </section>
  );
}
