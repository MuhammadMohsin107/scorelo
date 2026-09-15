import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AlertTriangle, Check, Info, Plus, Sparkles, X } from 'lucide-react';

/**
 * ─── Guided-setup building blocks ────────────────────────────────────
 *
 * Built on the app's existing surface/brand tokens so setup looks like the product it opens, not
 * like a separate onboarding product. Controls match the 32px height used across Settings.
 *
 * `DetectedNote` and `UnavailableNote` exist to keep one promise visible throughout the flow: a
 * pre-filled value always states where it came from, and a value we could not read says so rather
 * than appearing as an empty field the merchant assumes is optional.
 */

export function StepHeader({ step, total, title, purpose }: { step: number; total: number; title: string; purpose: string }) {
  return (
    <header className="border-b border-surface-200 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-600">
        Step {step} of {total}
      </p>
      <h1 className="mt-1 text-[17px] font-bold tracking-tight text-surface-950">{title}</h1>
      <p className="mt-1 max-w-xl text-[12.5px] leading-[1.45] text-surface-500">{purpose}</p>
    </header>
  );
}

/** Horizontal progress across the five steps. Completed steps are reachable; later ones are not,
 * because a step's suggestions depend on answers from the ones before it. */
export function Stepper({
  current,
  steps,
  onJump,
}: {
  current: number;
  steps: Array<{ step: number; title: string; status: 'complete' | 'skipped' | 'pending' }>;
  onJump: (step: number) => void;
}) {
  const furthest = Math.max(current, ...steps.filter((entry) => entry.status !== 'pending').map((entry) => entry.step + 1));

  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 px-4 py-2.5" aria-label="Setup progress">
      {steps.map((entry, index) => {
        const isCurrent = entry.step === current;
        const reachable = entry.step <= furthest;
        return (
          <li key={entry.step} className="flex items-center gap-1">
            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onJump(entry.step)}
              aria-current={isCurrent ? 'step' : undefined}
              className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11.5px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                isCurrent
                  ? 'text-brand-700'
                  : reachable
                    ? 'cursor-pointer text-surface-500 hover:text-surface-800'
                    : 'cursor-not-allowed text-surface-400'
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full text-[9.5px] font-bold ${
                  entry.status === 'complete'
                    ? 'bg-success-600 text-white'
                    : isCurrent
                      ? 'bg-brand-600 text-white'
                      : entry.status === 'skipped'
                        ? 'border border-dashed border-surface-400 text-surface-500'
                        : 'border border-surface-300 text-surface-400'
                }`}
              >
                {entry.status === 'complete' ? <Check size={11} strokeWidth={3} /> : entry.step}
              </span>
              <span className="hidden sm:inline">{entry.title}</span>
            </button>
            {index < steps.length - 1 && <span aria-hidden="true" className="h-px w-3 bg-surface-300 sm:w-5" />}
          </li>
        );
      })}
    </ol>
  );
}

/** States that a value came from the merchant's own Shopify store, and which part of it. */
export function DetectedNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1 flex items-start gap-1.5 text-[11.5px] leading-[1.45] text-surface-500">
      <Sparkles size={12} className="mt-[3px] flex-shrink-0 text-brand-500" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/** Says plainly that something could not be read. Never replaced by a placeholder value. */
export function UnavailableNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-warning-100 bg-warning-50 px-2.5 py-2">
      <AlertTriangle size={13} className="mt-px flex-shrink-0 text-warning-700" aria-hidden="true" />
      <p className="text-[11.5px] leading-[1.45] text-warning-700">{children}</p>
    </div>
  );
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-info-100 bg-info-50 px-2.5 py-2">
      <Info size={13} className="mt-px flex-shrink-0 text-info-700" aria-hidden="true" />
      <p className="text-[11.5px] leading-[1.45] text-info-700">{children}</p>
    </div>
  );
}

/** A selectable option with a title and an explanation of what choosing it does. */
export function ChoiceCard({
  name,
  value,
  selected,
  label,
  description,
  onSelect,
}: {
  name: string;
  value: string;
  selected: boolean;
  label: string;
  description?: string;
  onSelect: (value: string) => void;
}) {
  const id = `${name}-${value.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-2.5 py-2 transition-colors ${
        selected ? 'border-brand-400 bg-brand-50' : 'border-surface-200 bg-surface-0 hover:border-surface-300'
      }`}
    >
      <input
        id={id}
        type="radio"
        name={name}
        checked={selected}
        onChange={() => onSelect(value)}
        className="mt-[3px] h-3.5 w-3.5 flex-shrink-0 cursor-pointer accent-brand-600"
      />
      <span className="min-w-0">
        <span className={`block text-[12.5px] font-semibold ${selected ? 'text-brand-800' : 'text-surface-800'}`}>{label}</span>
        {description && <span className="mt-0.5 block text-[11.5px] leading-[1.4] text-surface-500">{description}</span>}
      </span>
    </label>
  );
}

/** Multi-select with the same anatomy as ChoiceCard. */
export function CheckCard({
  id,
  checked,
  label,
  description,
  onToggle,
}: {
  id: string;
  checked: boolean;
  label: string;
  description?: string;
  onToggle: (next: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-2.5 py-2 transition-colors ${
        checked ? 'border-brand-400 bg-brand-50' : 'border-surface-200 bg-surface-0 hover:border-surface-300'
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onToggle(event.target.checked)}
        className="mt-[3px] h-3.5 w-3.5 flex-shrink-0 cursor-pointer rounded accent-brand-600"
      />
      <span className="min-w-0">
        <span className={`block text-[12.5px] font-semibold ${checked ? 'text-brand-800' : 'text-surface-800'}`}>{label}</span>
        {description && <span className="mt-0.5 block text-[11.5px] leading-[1.4] text-surface-500">{description}</span>}
      </span>
    </label>
  );
}

/**
 * A list the merchant builds by typing. Enter or comma commits; × removes.
 *
 * Enforces `max` and rejects case-insensitive duplicates rather than accepting them and silently
 * de-duplicating on save — a merchant should see immediately that a term is already in the list.
 */
export function TagInput({
  id,
  values,
  onChange,
  placeholder,
  max,
  disabled = false,
  transform,
}: {
  id: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  max: number;
  disabled?: boolean;
  /** Normalises an entry as it is committed (lower-casing a keyword, stripping a URL to a host). */
  transform?: (raw: string) => string | null;
}) {
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const full = values.length >= max;

  const commit = (raw: string) => {
    const candidate = transform ? transform(raw) : raw.trim();
    if (!candidate) {
      setNotice(transform ? "That doesn't look like a valid entry." : null);
      return;
    }
    if (values.some((value) => value.toLowerCase() === candidate.toLowerCase())) {
      setNotice('Already in the list.');
      setDraft('');
      return;
    }
    if (full) {
      setNotice(`You can add up to ${max}.`);
      return;
    }
    onChange([...values, candidate]);
    setDraft('');
    setNotice(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      if (draft.trim()) commit(draft);
      return;
    }
    // Backspace on an empty field removes the last chip — the behaviour every tag field has.
    if (event.key === 'Backspace' && !draft && values.length > 0) {
      onChange(values.slice(0, -1));
      setNotice(null);
    }
  };

  return (
    <div>
      <div
        className={`flex flex-wrap items-center gap-1.5 rounded-md border bg-surface-0 px-2 py-1.5 transition-colors focus-within:ring-2 ${
          disabled
            ? 'border-surface-200 bg-surface-50'
            : 'border-surface-200 focus-within:border-brand-400 focus-within:ring-brand-100'
        }`}
      >
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-1 rounded bg-brand-50 py-0.5 pl-2 pr-1 text-[11.5px] font-medium text-brand-800"
          >
            {value}
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                onChange(values.filter((item) => item !== value));
                setNotice(null);
              }}
              aria-label={`Remove ${value}`}
              className="rounded p-0.5 text-brand-500 transition-colors hover:bg-brand-100 hover:text-brand-800 focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-500"
            >
              <X size={11} strokeWidth={2.5} />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          disabled={disabled || full}
          onChange={(event) => {
            setDraft(event.target.value);
            setNotice(null);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => draft.trim() && commit(draft)}
          placeholder={full ? `Maximum of ${max} reached` : values.length === 0 ? placeholder : 'Add another…'}
          className="min-w-[10rem] flex-1 bg-transparent px-1 py-0.5 text-[12.5px] text-surface-900 outline-none placeholder:text-surface-400 disabled:cursor-not-allowed"
        />
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <p className="text-[11.5px] text-surface-500">
          {notice ?? 'Press Enter or comma to add.'}
        </p>
        <p className="flex-shrink-0 font-mono text-[11px] text-surface-400">
          {values.length}/{max}
        </p>
      </div>
    </div>
  );
}

/**
 * Suggestions derived from the merchant's own store, offered one click at a time.
 *
 * Each chip carries the reason it was suggested (`hint`) because a merchant deciding whether
 * "merino base layers" belongs in their targets needs to know it came from a collection holding
 * 240 of their products. Already-added suggestions are shown as added rather than hidden, so the
 * list does not reflow under the cursor as it is used.
 */
export function SuggestionRow({
  label,
  suggestions,
  selected,
  onAdd,
  disabled = false,
}: {
  label: string;
  suggestions: Array<{ value: string; hint: string }>;
  selected: string[];
  onAdd: (value: string) => void;
  disabled?: boolean;
}) {
  const headingId = useId();
  if (suggestions.length === 0) return null;

  const lowered = selected.map((value) => value.toLowerCase());

  return (
    <div className="rounded-md border border-surface-200 bg-surface-50/60 px-2.5 py-2">
      <p id={headingId} className="text-[10px] font-bold uppercase tracking-[0.12em] text-surface-500">
        {label}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-labelledby={headingId}>
        {suggestions.map((suggestion) => {
          const added = lowered.includes(suggestion.value.toLowerCase());
          return (
            <button
              key={suggestion.value}
              type="button"
              disabled={disabled || added}
              onClick={() => onAdd(suggestion.value)}
              title={suggestion.hint}
              className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11.5px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                added
                  ? 'cursor-default border-success-100 bg-success-50 text-success-700'
                  : 'cursor-pointer border-surface-200 bg-surface-0 text-surface-700 hover:border-brand-300 hover:text-brand-700'
              }`}
            >
              {added ? <Check size={11} strokeWidth={2.6} aria-hidden="true" /> : <Plus size={11} strokeWidth={2.6} aria-hidden="true" />}
              {suggestion.value}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Ordered priority list. Position is the answer, so moving an item is the interaction. */
export function PriorityList({
  items,
  onReorder,
}: {
  items: Array<{ key: string; label: string }>;
  onReorder: (keys: string[]) => void;
}) {
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onReorder(next.map((item) => item.key));
  };

  return (
    <ol className="divide-y divide-surface-100 overflow-hidden rounded-md border border-surface-200">
      {items.map((item, index) => (
        <li key={item.key} className="flex items-center gap-2 bg-surface-0 px-2.5 py-1.5">
          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-surface-100 font-mono text-[11px] font-semibold text-surface-600">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-surface-800">{item.label}</span>
          <span className="flex flex-shrink-0 gap-1">
            <button
              type="button"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              aria-label={`Move ${item.label} up`}
              className="rounded border border-surface-200 px-1.5 py-0.5 text-[11px] text-surface-600 transition-colors hover:border-surface-300 hover:text-surface-900 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              disabled={index === items.length - 1}
              aria-label={`Move ${item.label} down`}
              className="rounded border border-surface-200 px-1.5 py-0.5 text-[11px] text-surface-600 transition-colors hover:border-surface-300 hover:text-surface-900 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              ↓
            </button>
          </span>
        </li>
      ))}
    </ol>
  );
}
