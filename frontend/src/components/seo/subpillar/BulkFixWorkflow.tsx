import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, History, Loader2, RotateCcw, X } from 'lucide-react';
import type { EvidenceRow, RowStatus } from '../../../data/seo/subpillar.model';
import { card, eyebrow } from './tone';

interface AppliedUpdate {
  id: string;
  before: string;
  after: string;
  beforeStatus: RowStatus;
  status: RowStatus;
}

interface Props {
  rows: EvidenceRow[];
  mode: 'title-tags' | 'generic';
  onClose: () => void;
  onApply: (updates: AppliedUpdate[]) => void;
}

const MIN_TITLE_LENGTH = 30;
const MAX_TITLE_LENGTH = 60;

function validate(row: EvidenceRow, value: string, mode: 'title-tags' | 'generic') {
  const current = row.current?.value ?? '';
  const trimmed = value.trim();
  if (!trimmed) return 'Recommendation is empty';
  if (mode === 'title-tags' && (trimmed.length < MIN_TITLE_LENGTH || trimmed.length > MAX_TITLE_LENGTH)) {
    return `Use ${MIN_TITLE_LENGTH}-${MAX_TITLE_LENGTH} characters`;
  }
  if (trimmed === current) return 'Recommendation must meaningfully change the value';
  return null;
}

export default function BulkFixWorkflow({ rows, mode, onClose, onApply }: Props) {
  const [isGenerating, setIsGenerating] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [applied, setApplied] = useState<AppliedUpdate[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (applied.length > 0) return;
    const timer = window.setTimeout(() => {
      setDrafts(Object.fromEntries(rows.map((row) => [row.id, row.suggested?.value ?? ''])));
      setIsGenerating(false);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [applied.length, rows]);

  const reviews = useMemo(
    () => rows.map((row) => ({ row, value: drafts[row.id] ?? '', error: validate(row, drafts[row.id] ?? '', mode) })),
    [drafts, mode, rows],
  );
  const ready = reviews.filter((item) => !item.error);
  const needsReview = reviews.length - ready.length;

  const updateDraft = (id: string, value: string) => setDrafts((current) => ({ ...current, [id]: value }));

  const handleApply = () => {
    const updates = ready.map(({ row, value }) => ({
      id: row.id,
      before: row.current?.value ?? '',
      after: value.trim(),
      beforeStatus: row.status,
      status: 'Healthy',
    }));
    if (updates.length === 0) return;
    onApply(updates);
    setApplied(updates);
  };

  const handleUndo = () => {
    onApply(applied.map((item) => ({ ...item, before: item.after, after: item.before, status: item.beforeStatus })));
    setApplied([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <button type="button" className="absolute inset-0 cursor-default bg-surface-950/25" onClick={onClose} aria-label="Close bulk fix review" />
      <section role="dialog" aria-modal="true" aria-labelledby="bulk-fix-title" className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-surface-0 shadow-2xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-surface-200 px-5 py-4 sm:px-6">
          <div>
            <p className={eyebrow}>Test mode · review before apply</p>
            <h2 id="bulk-fix-title" className="mt-1 text-lg font-semibold tracking-tight text-surface-950">Review {mode === 'title-tags' ? 'title tag' : 'recommended'} fixes</h2>
            <p className="mt-1 text-xs text-surface-500">Recommendations stay isolated until you approve validated changes.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-surface-500 hover:bg-surface-100 hover:text-surface-900" aria-label="Close review">
            <X size={17} />
          </button>
        </header>

        {isGenerating ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-sm text-surface-600">
            <Loader2 size={22} className="animate-spin text-brand-600" />
            Generating recommendations...
          </div>
        ) : applied.length > 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
            <CheckCircle2 size={34} className="text-success-600" />
            <h3 className="text-lg font-semibold text-surface-950">{applied.length} test fixes applied</h3>
            <p className="max-w-md text-sm text-surface-600">Only validated recommendations were applied to the in-memory test data.</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={handleUndo} className="btn-secondary"><RotateCcw size={15} /> Undo test fixes</button>
              <button type="button" onClick={() => setShowHistory((value) => !value)} className="btn-ghost"><History size={15} /> Fix history</button>
              <button type="button" onClick={onClose} className="btn-primary">Done</button>
            </div>
            {showHistory && <p className={`${card} mt-3 px-4 py-3 text-left text-xs text-surface-600`}>{applied.length} records changed in this test session.</p>}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-surface-200 bg-surface-50/60 px-5 py-3 text-xs sm:px-6">
              <span className="font-semibold text-surface-800">{rows.length} selected</span>
              <span className="text-success-700">{ready.length} ready</span>
              {needsReview > 0 && <span className="text-warning-700">{needsReview} need review</span>}
            </div>
            <div className="overflow-y-auto px-5 py-4 sm:px-6">
              <div className="space-y-3">
                {reviews.map(({ row, value, error }) => (
                  <article key={row.id} className="rounded-xl border border-surface-200 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[11px] text-surface-500">{String(row.cells.url ?? '')}</p>
                        <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-surface-400">Current value</p>
                        <p className="mt-1 text-sm text-surface-700">{row.current?.value || 'No current value'}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-surface-400" htmlFor={`bulk-fix-${row.id}`}>Recommended value</label>
                        <textarea id={`bulk-fix-${row.id}`} value={value} onChange={(event) => updateDraft(row.id, event.target.value)} rows={2} className="mt-1.5 w-full resize-y rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-900 outline-none focus:border-brand-400 focus:bg-surface-0 focus:ring-2 focus:ring-brand-100" />
                        <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
                          <span className={error ? 'text-warning-700' : 'text-success-700'}>{error ?? 'Ready to apply'}</span>
                          <span className="tabular-nums text-surface-400">{mode === 'title-tags' ? `${value.length}/${MAX_TITLE_LENGTH}` : `${value.length} characters`}</span>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <footer className="flex flex-col-reverse gap-2 border-t border-surface-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="inline-flex items-center gap-2 text-xs text-surface-500"><ClipboardCheck size={14} /> Validation runs before apply</div>
              <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button type="button" onClick={handleApply} disabled={ready.length === 0} className="btn-primary">Apply {ready.length} test fixes</button></div>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}