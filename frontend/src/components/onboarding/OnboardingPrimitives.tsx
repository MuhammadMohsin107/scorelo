import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Info,
  Plus,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react';

/**
 * ─── Guided-setup building blocks ────────────────────────────────────
 *
 * Built on the app's surface/brand tokens so setup looks like the product it opens. Controls here
 * are a size up from Settings (40px, 13.5px type): setup is a page someone reads end to end, not a
 * dense panel they scan, and the wider two-column layout gives the room for it.
 *
 * `DetectedNote` and `UnavailableNote` exist to keep one promise visible throughout the flow: a
 * suggested value always states where it came from, and a value we could not read says so rather
 * than appearing as an empty field the merchant assumes is optional.
 *
 * NOTHING HERE FILLS A FIELD. Placeholders say what to type, never an example answer that could be
 * mistaken for one already given.
 */

export type StepStatus = 'complete' | 'skipped' | 'pending';

interface StepEntry {
  step: number;
  title: string;
  status: StepStatus;
}

/** Completed and skipped steps are reachable, plus the one after the furthest of them; later ones
 * are not, because a step's suggestions depend on answers from the ones before it. */
function furthestReachable(current: number, steps: StepEntry[]): number {
  return Math.max(current, ...steps.filter((entry) => entry.status !== 'pending').map((entry) => entry.step + 1));
}

function StepBadge({ entry, isCurrent, size = 'md' }: { entry: StepEntry; isCurrent: boolean; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-[18px] w-[18px] text-[9.5px]' : 'h-7 w-7 text-[12px]';
  const tone =
    entry.status === 'complete'
      ? 'bg-success-600 text-white'
      : isCurrent
        ? 'bg-brand-600 text-white shadow-[0_0_0_4px_var(--c-brand-100)]'
        : entry.status === 'skipped'
          ? 'border border-dashed border-surface-400 bg-surface-0 text-surface-500'
          : 'border border-surface-300 bg-surface-0 text-surface-500';

  return (
    <span aria-hidden="true" className={`flex flex-shrink-0 items-center justify-center rounded-full font-semibold ${box} ${tone}`}>
      {entry.status === 'complete' ? <Check size={size === 'sm' ? 11 : 14} strokeWidth={3} /> : entry.step}
    </span>
  );
}

const STATUS_LABEL: Record<StepStatus, string> = {
  complete: 'Complete',
  skipped: 'Skipped for now',
  pending: 'Not started',
};

// ─── Progress ────────────────────────────────────────────────────────

/** Vertical progress for wide screens: every step, its state, and how far through setup is. */
export function StepRail({
  current,
  steps,
  onJump,
}: {
  current: number;
  steps: StepEntry[];
  onJump: (step: number) => void;
}) {
  const furthest = furthestReachable(current, steps);
  const completed = steps.filter((entry) => entry.status === 'complete').length;
  const percent = Math.round((completed / steps.length) * 100);

  return (
    <nav aria-label="Setup progress" className="rounded-xl border border-surface-200 bg-surface-0 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-surface-500">Guided setup</p>
      <p className="mt-1 text-[13px] text-surface-700">
        <span className="font-semibold text-surface-950">{completed}</span> of {steps.length} steps complete
      </p>
      <div
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={completed}
        aria-label="Steps complete"
      >
        <div
          className="h-full rounded-full bg-brand-600 transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ol className="mt-4 space-y-1">
        {steps.map((entry, index) => {
          const isCurrent = entry.step === current;
          const reachable = entry.step <= furthest;
          return (
            <li key={entry.step} className="relative">
              {/* The connector between badges, drawn behind them. */}
              {index < steps.length - 1 && (
                <span aria-hidden="true" className="absolute left-[23px] top-[42px] h-[calc(100%-26px)] w-px bg-surface-200" />
              )}
              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && !isCurrent && onJump(entry.step)}
                aria-current={isCurrent ? 'step' : undefined}
                className={`relative flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  isCurrent
                    ? 'bg-brand-50/70'
                    : reachable
                      ? 'cursor-pointer hover:bg-surface-50'
                      : 'cursor-not-allowed'
                }`}
              >
                <StepBadge entry={entry} isCurrent={isCurrent} />
                <span className="min-w-0 pt-0.5">
                  <span
                    className={`block text-[13px] font-semibold leading-tight ${
                      isCurrent ? 'text-brand-800' : reachable ? 'text-surface-800' : 'text-surface-400'
                    }`}
                  >
                    {entry.title}
                  </span>
                  <span className={`mt-0.5 block text-[11.5px] ${isCurrent ? 'text-brand-700' : 'text-surface-500'}`}>
                    {isCurrent && entry.status !== 'complete' ? 'In progress' : STATUS_LABEL[entry.status]}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Compact horizontal progress for narrow screens, where the rail is hidden. */
export function Stepper({
  current,
  steps,
  onJump,
}: {
  current: number;
  steps: StepEntry[];
  onJump: (step: number) => void;
}) {
  const furthest = furthestReachable(current, steps);

  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 px-4 py-3" aria-label="Setup progress">
      {steps.map((entry, index) => {
        const isCurrent = entry.step === current;
        const reachable = entry.step <= furthest;
        return (
          <li key={entry.step} className="flex items-center gap-1">
            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && !isCurrent && onJump(entry.step)}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`Step ${entry.step}: ${entry.title}`}
              className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                isCurrent
                  ? 'text-brand-700'
                  : reachable
                    ? 'cursor-pointer text-surface-500 hover:text-surface-800'
                    : 'cursor-not-allowed text-surface-400'
              }`}
            >
              <StepBadge entry={entry} isCurrent={isCurrent} size="sm" />
              {isCurrent && <span className="hidden sm:inline">{entry.title}</span>}
            </button>
            {index < steps.length - 1 && <span aria-hidden="true" className="h-px w-3 bg-surface-300 sm:w-5" />}
          </li>
        );
      })}
    </ol>
  );
}

export function StepHeader({
  step,
  total,
  title,
  purpose,
  icon: Icon,
}: {
  step: number;
  total: number;
  title: string;
  purpose: string;
  icon?: LucideIcon;
}) {
  return (
    <header className="flex items-start gap-4 border-b border-surface-200 px-5 py-5 sm:px-7 sm:py-6">
      {Icon && (
        <span className="hidden h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100 sm:flex">
          <Icon size={20} strokeWidth={2} aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600">
          Step {step} of {total}
        </p>
        <h1 className="mt-1 text-[20px] font-semibold leading-tight tracking-tight text-surface-950">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-[1.5] text-surface-500">{purpose}</p>
      </div>
    </header>
  );
}

// ─── Layout ──────────────────────────────────────────────────────────

function Badge({ children, tone }: { children: ReactNode; tone: 'required' | 'optional' }) {
  return (
    <span
      className={`rounded-full px-1.5 py-px text-[10.5px] font-semibold ${
        tone === 'required' ? 'bg-critical-50 text-critical-700' : 'bg-surface-100 text-surface-500'
      }`}
    >
      {children}
    </span>
  );
}

/**
 * The grid every step lays its fields out on: two equal columns from `md`, one below.
 *
 * WHY THE FIELDS ALIGN. `FormField` and `FormSection` place themselves on this grid's rows with
 * CSS subgrid — a field spans four row tracks (label, description, control, extras), a section
 * three. Items side by side share those tracks, so when one description wraps to two lines and its
 * neighbour's does not, both controls still start on the same line. A plain two-column grid lets
 * the longer description push its input down, and the pair stops lining up.
 *
 * Anything that should take the whole row passes `className="md:col-span-2"`.
 */
export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-x-6 gap-y-8 md:grid-cols-2">{children}</div>;
}

/**
 * One labelled control. The description sits between the label and the control; anything that
 * belongs under the control — a suggestion from Shopify, a list of chips — goes in `extras`, so it
 * stays attached to the control instead of shifting the next row.
 */
export function FormField({
  label,
  htmlFor,
  hint,
  badge,
  children,
  extras,
  className = '',
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  badge?: 'required' | 'optional';
  children: ReactNode;
  extras?: ReactNode;
  className?: string;
}) {
  return (
    // Always four children, even when a hint or extras are absent, so the subgrid rows line up.
    <div className={`row-span-4 grid min-w-0 grid-rows-subgrid gap-y-0 ${className}`}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <label htmlFor={htmlFor} className="text-[13px] font-semibold text-surface-800">
          {label}
        </label>
        {badge && <Badge tone={badge}>{badge === 'required' ? 'Required' : 'Optional'}</Badge>}
      </div>
      <p id={`${htmlFor}-hint`} className="mt-1 text-[12px] leading-[1.45] text-surface-500">
        {hint}
      </p>
      <div className="mt-2.5 min-w-0">{children}</div>
      <div className="min-w-0">{extras}</div>
    </div>
  );
}

/** A group of cards or other non-input controls, announced as one group. Aligns on FormGrid rows
 * exactly as FormField does, over three tracks: title, description, content. */
export function FormSection({
  title,
  description,
  badge,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  badge?: 'required' | 'optional';
  children: ReactNode;
  className?: string;
}) {
  const headingId = useId();
  return (
    <section
      role="group"
      aria-labelledby={headingId}
      className={`row-span-3 grid min-w-0 grid-rows-subgrid gap-y-0 ${className}`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h2 id={headingId} className="text-[13px] font-semibold text-surface-800">
          {title}
        </h2>
        {badge && <Badge tone={badge}>{badge === 'required' ? 'Required' : 'Optional'}</Badge>}
      </div>
      <p className="mt-1 text-[12px] leading-[1.45] text-surface-500">{description}</p>
      <div className="mt-3 min-w-0">{children}</div>
    </section>
  );
}

/** The setup page's buttons: a size up from the app's compact `.btn-*` classes, which are built
 * for dense panels rather than a page's primary actions. Colours mirror `.btn-primary`. */
export function ActionButton({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
}) {
  const tone = {
    primary:
      'border-brand-700 bg-brand-600 text-surface-0 shadow-[0_1px_2px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-brand-500',
    secondary: 'border-surface-200 bg-surface-0 text-surface-700 shadow-sm hover:border-surface-300 hover:bg-surface-50 hover:text-surface-900',
    ghost: 'border-transparent bg-transparent text-surface-600 hover:bg-surface-100 hover:text-surface-900',
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-4 text-[13.5px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${tone}`}
    >
      {children}
    </button>
  );
}

/** A fact Shopify reported, shown read-only. A missing value says so instead of showing a default. */
export function FactTile({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg border border-surface-200 bg-surface-50/70 px-3.5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">{label}</p>
      {value ? (
        <p className="mt-1 truncate text-[13.5px] font-semibold text-surface-900" title={value}>
          {value}
        </p>
      ) : (
        <p className="mt-1 text-[12.5px] text-surface-400">Not reported by Shopify</p>
      )}
    </div>
  );
}

// ─── Controls ────────────────────────────────────────────────────────

const controlBase =
  'w-full rounded-lg border border-surface-200 bg-surface-0 text-[13.5px] text-surface-900 shadow-[0_1px_0_rgba(15,23,42,0.03)] outline-none transition-[border-color,box-shadow] placeholder:text-surface-400 hover:border-surface-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100';

export function TextField({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      placeholder={placeholder}
      aria-describedby={`${id}-hint`}
      onChange={(event) => onChange(event.target.value)}
      className={`${controlBase} h-10 px-3`}
    />
  );
}

/**
 * A select whose empty state is a prompt, not the first option. Without the placeholder a native
 * select shows its first real option, which reads as an answer the merchant never chose.
 */
export function SelectField({
  id,
  value,
  options,
  placeholder,
  onChange,
}: {
  id: string;
  value: string;
  options: readonly string[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        aria-describedby={`${id}-hint`}
        onChange={(event) => onChange(event.target.value)}
        className={`${controlBase} h-10 cursor-pointer appearance-none pl-3 pr-9 ${value ? '' : 'text-surface-400'}`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option} className="text-surface-900">
            {option}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-surface-400"
        aria-hidden="true"
      />
    </div>
  );
}

export function TextArea({
  id,
  value,
  onChange,
  placeholder,
  maxLength,
  rows = 3,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength: number;
  rows?: number;
}) {
  return (
    <div>
      <textarea
        id={id}
        rows={rows}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-describedby={`${id}-hint`}
        onChange={(event) => onChange(event.target.value)}
        className={`${controlBase} block resize-y px-3 py-2.5 leading-[1.5]`}
      />
      <p className="mt-1 text-right font-mono text-[11px] text-surface-400">
        {value.length}/{maxLength}
      </p>
    </div>
  );
}

// ─── Notes ───────────────────────────────────────────────────────────

/**
 * States what the merchant's own Shopify store says about a field, and which part of it.
 *
 * With an `action`, the value is offered as a one-click answer. It is never written into the field
 * on its own: a value the merchant did not choose would be saved as theirs the moment they pressed
 * Continue, and would come back on every reload looking like something they typed.
 */
export function DetectedNote({
  children,
  action,
}: {
  children: ReactNode;
  action?: { label: string; applied: boolean; onApply: () => void };
}) {
  return (
    <div className="mt-2 flex items-start gap-2.5 rounded-lg border border-brand-100 bg-brand-50/50 px-3 py-2">
      <Sparkles size={13} className="mt-[3px] flex-shrink-0 text-brand-500" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-[12px] leading-[1.5] text-surface-600">{children}</p>
      {action &&
        (action.applied ? (
          <span className="inline-flex flex-shrink-0 items-center gap-1 py-0.5 text-[11.5px] font-semibold text-success-700">
            <Check size={12} strokeWidth={2.6} aria-hidden="true" />
            In use
          </span>
        ) : (
          <button
            type="button"
            onClick={action.onApply}
            className="flex-shrink-0 rounded-md bg-surface-0 px-2 py-0.5 text-[11.5px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 transition-colors hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}

/** Says plainly that something could not be read. Never replaced by a placeholder value. */
export function UnavailableNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-warning-100 bg-warning-50 px-3 py-2.5">
      <AlertTriangle size={14} className="mt-px flex-shrink-0 text-warning-700" aria-hidden="true" />
      <p className="text-[12px] leading-[1.5] text-warning-700">{children}</p>
    </div>
  );
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-info-100 bg-info-50 px-3 py-2.5">
      <Info size={14} className="mt-px flex-shrink-0 text-info-700" aria-hidden="true" />
      <p className="text-[12px] leading-[1.5] text-info-700">{children}</p>
    </div>
  );
}

/** Muted inline text for a pending read or an empty list. */
export function QuietNote({ children }: { children: ReactNode }) {
  return <p className="flex items-center gap-1.5 text-[12px] text-surface-500">{children}</p>;
}

// ─── Choice cards ────────────────────────────────────────────────────

function cardClasses(selected: boolean, className = '') {
  return `relative flex h-full cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition-[border-color,background-color,box-shadow] ${
    selected
      ? 'border-brand-500 bg-brand-50/60 shadow-[0_0_0_1px_var(--c-brand-500)]'
      : 'border-surface-200 bg-surface-0 hover:border-surface-300 hover:bg-surface-50/70'
  } ${className}`;
}

/** A selectable option with a title and an explanation of what choosing it does. */
export function ChoiceCard({
  name,
  value,
  selected,
  label,
  description,
  onSelect,
  className,
}: {
  name: string;
  value: string;
  selected: boolean;
  label: string;
  description?: string;
  onSelect: (value: string) => void;
  /** Grid placement, e.g. letting the last card of an odd row span it. */
  className?: string;
}) {
  const id = `${name}-${value.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <label htmlFor={id} className={cardClasses(selected, className)}>
      <input
        id={id}
        type="radio"
        name={name}
        checked={selected}
        onChange={() => onSelect(value)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`mt-[2px] flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2 ${
          selected ? 'border-brand-600 bg-brand-600' : 'border-surface-300 bg-surface-0'
        }`}
      >
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>
      <span className="min-w-0">
        <span className={`block text-[13px] font-semibold leading-snug ${selected ? 'text-brand-900' : 'text-surface-800'}`}>{label}</span>
        {description && <span className="mt-1 block text-[12px] leading-[1.45] text-surface-500">{description}</span>}
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
    <label htmlFor={id} className={cardClasses(checked)}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onToggle(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`mt-[2px] flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2 ${
          checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-surface-300 bg-surface-0'
        }`}
      >
        {checked && <Check size={11} strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className={`block text-[13px] font-semibold leading-snug ${checked ? 'text-brand-900' : 'text-surface-800'}`}>{label}</span>
        {description && <span className="mt-1 block text-[12px] leading-[1.45] text-surface-500">{description}</span>}
      </span>
    </label>
  );
}

// ─── Lists ───────────────────────────────────────────────────────────

/** A removable value the merchant added. */
export function Chip({ label, onRemove, disabled = false }: { label: string; onRemove: () => void; disabled?: boolean }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-brand-50 py-1 pl-2.5 pr-1 text-[12px] font-medium text-brand-800 ring-1 ring-inset ring-brand-100">
      <span className="truncate">{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="rounded p-0.5 text-brand-500 transition-colors hover:bg-brand-100 hover:text-brand-800 focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-500"
      >
        <X size={12} strokeWidth={2.5} />
      </button>
    </span>
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
        className={`flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5 shadow-[0_1px_0_rgba(15,23,42,0.03)] transition-[border-color,box-shadow] focus-within:ring-4 ${
          disabled
            ? 'border-surface-200 bg-surface-50'
            : 'border-surface-200 bg-surface-0 hover:border-surface-300 focus-within:border-brand-500 focus-within:ring-brand-100'
        }`}
      >
        {values.map((value) => (
          <Chip
            key={value}
            label={value}
            disabled={disabled}
            onRemove={() => {
              onChange(values.filter((item) => item !== value));
              setNotice(null);
            }}
          />
        ))}
        <input
          id={id}
          value={draft}
          disabled={disabled || full}
          aria-describedby={`${id}-hint`}
          onChange={(event) => {
            setDraft(event.target.value);
            setNotice(null);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => draft.trim() && commit(draft)}
          placeholder={full ? `Maximum of ${max} reached` : values.length === 0 ? placeholder : 'Add another…'}
          className="min-w-[9rem] flex-1 bg-transparent px-1.5 py-1 text-[13.5px] text-surface-900 outline-none placeholder:text-surface-400 disabled:cursor-not-allowed"
        />
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <p className={`text-[12px] ${notice ? 'text-warning-700' : 'text-surface-500'}`} aria-live="polite">
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
 * Each chip carries the reason it was suggested (`hint`) because a merchant deciding whether a term
 * belongs in their targets needs to know which part of their catalogue it came from. Already-added
 * suggestions are shown as added rather than hidden, so the list does not reflow under the cursor.
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
    <div className="rounded-lg border border-dashed border-surface-300 bg-surface-50/70 px-3 py-2.5">
      <p id={headingId} className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">
        <Sparkles size={12} className="text-brand-500" aria-hidden="true" />
        {label}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-labelledby={headingId}>
        {suggestions.map((suggestion) => {
          const added = lowered.includes(suggestion.value.toLowerCase());
          return (
            <button
              key={suggestion.value}
              type="button"
              disabled={disabled || added}
              onClick={() => onAdd(suggestion.value)}
              title={suggestion.hint}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                added
                  ? 'cursor-default border-success-100 bg-success-50 text-success-700'
                  : 'cursor-pointer border-surface-200 bg-surface-0 text-surface-700 hover:border-brand-300 hover:text-brand-700'
              }`}
            >
              {added ? <Check size={12} strokeWidth={2.6} aria-hidden="true" /> : <Plus size={12} strokeWidth={2.6} aria-hidden="true" />}
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

  const moveButton =
    'flex h-7 w-7 items-center justify-center rounded-md border border-surface-200 bg-surface-0 text-surface-500 transition-colors hover:border-surface-300 hover:text-surface-900 disabled:cursor-not-allowed disabled:opacity-35 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500';

  return (
    <ol className="divide-y divide-surface-100 overflow-hidden rounded-lg border border-surface-200 bg-surface-0">
      {items.map((item, index) => (
        <li key={item.key} className="flex items-center gap-3 px-3 py-2">
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-surface-100 font-mono text-[11.5px] font-semibold text-surface-600">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-surface-800">{item.label}</span>
          <span className="flex flex-shrink-0 gap-1">
            <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${item.label} up`} className={moveButton}>
              <ArrowUp size={13} strokeWidth={2.4} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              disabled={index === items.length - 1}
              aria-label={`Move ${item.label} down`}
              className={moveButton}
            >
              <ArrowDown size={13} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </span>
        </li>
      ))}
    </ol>
  );
}
