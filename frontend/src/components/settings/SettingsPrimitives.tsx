import { useEffect, useRef, type ReactNode } from 'react';
import { AlertTriangle, Check, Info, X } from 'lucide-react';
import { Button } from '../workflows/WorkflowPrimitives';

/** Card shell — matches Integrations / Reports / Fix Center exactly. */
export const settingsCard =
  'rounded-xl border border-surface-200 bg-white shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)]';

export const eyebrowClass = 'text-[10px] font-bold uppercase tracking-[0.14em] text-surface-500';

/** One settings group: title, description and its fields. */
export function SettingsCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className={`${settingsCard} overflow-hidden`}>
      <div className="border-b border-surface-200 px-5 py-4 sm:px-6">
        <h3 className="text-base font-bold tracking-tight text-surface-950">{title}</h3>
        {description && <p className="mt-1 max-w-2xl text-sm leading-6 text-surface-500">{description}</p>}
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
      {footer && <div className="border-t border-surface-200 bg-surface-50/60 px-5 py-3 sm:px-6">{footer}</div>}
    </section>
  );
}

/** Label + control + helper/error text. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className = '',
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-surface-800">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-critical-700">
          <AlertTriangle size={12} aria-hidden="true" />
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${htmlFor}-hint`} className="mt-1.5 text-xs leading-5 text-surface-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

const controlBase =
  'w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-surface-900 outline-none transition-colors placeholder:text-surface-400 focus:ring-2 disabled:cursor-not-allowed disabled:bg-surface-50 disabled:text-surface-500';

export function TextInput({
  id,
  value,
  onChange,
  placeholder,
  type = 'text',
  invalid = false,
  disabled = false,
  prefix,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  invalid?: boolean;
  disabled?: boolean;
  prefix?: string;
  describedBy?: string;
}) {
  const tone = invalid
    ? 'border-critical-300 focus:border-critical-500 focus:ring-critical-100'
    : 'border-surface-200 focus:border-brand-400 focus:ring-brand-100';

  if (prefix) {
    return (
      <div
        className={`flex items-stretch overflow-hidden rounded-lg border transition-colors focus-within:ring-2 ${
          invalid
            ? 'border-critical-300 focus-within:border-critical-500 focus-within:ring-critical-100'
            : 'border-surface-200 focus-within:border-brand-400 focus-within:ring-brand-100'
        }`}
      >
        <span className="flex items-center border-r border-surface-200 bg-surface-50 px-3 font-mono text-xs text-surface-500">
          {prefix}
        </span>
        <input
          id={id}
          type={type}
          value={value}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full bg-white px-3 py-2.5 text-sm text-surface-900 outline-none placeholder:text-surface-400"
        />
      </div>
    );
  }

  return (
    <input
      id={id}
      type={type}
      value={value}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={`${controlBase} ${tone}`}
    />
  );
}

export function SelectInput<T extends string>({
  id,
  value,
  options,
  onChange,
  disabled = false,
  describedBy,
}: {
  id: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  disabled?: boolean;
  describedBy?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value as T)}
      className={`${controlBase} cursor-pointer border-surface-200 focus:border-brand-400 focus:ring-brand-100`}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

/** Toggle row: label, microcopy, switch. Microcopy is required. */
export function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <label htmlFor={id} className={`block text-sm font-semibold ${disabled ? 'text-surface-400' : 'text-surface-800'}`}>
          {label}
        </label>
        <p className="mt-1 max-w-xl text-xs leading-5 text-surface-500">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${
          checked ? 'bg-brand-600' : 'bg-surface-300'
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none ${
            checked ? 'translate-x-[22px]' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

/** Read-only row for values Scorelo derives rather than accepts. */
export function ReadOnlyRow({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-surface-100 py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-surface-800">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-surface-500">{hint}</p>}
      </div>
      <div className="text-sm text-surface-700">{value}</div>
    </div>
  );
}

/** Explains why a group is display-only in this build. */
export function PreviewNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-info-100 bg-info-50 p-3.5">
      <Info size={15} className="mt-0.5 flex-shrink-0 text-info-700" aria-hidden="true" />
      <p className="text-xs leading-5 text-info-800">{children}</p>
    </div>
  );
}

/** Sticky bar shown only while there are unsaved changes. */
export function SaveBar({
  visible,
  saving,
  onSave,
  onCancel,
  message = 'You have unsaved changes',
}: {
  visible: boolean;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  message?: string;
}) {
  if (!visible) return null;
  return (
    <div className="sticky bottom-4 z-20 mt-6" role="region" aria-label="Unsaved changes">
      <div className="flex flex-col gap-3 rounded-xl border border-surface-300 bg-white/95 p-3 shadow-[0_16px_40px_-16px_rgba(15,23,42,0.35)] backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-surface-800">
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-warning-500" aria-hidden="true" />
          {message}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Discard
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Transient success confirmation after a save. */
export function SavedToast({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(onDismiss, 3200);
    return () => window.clearTimeout(timer);
  }, [visible, onDismiss]);

  if (!visible) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-xl border border-success-100 bg-white px-4 py-3 shadow-[0_16px_40px_-16px_rgba(15,23,42,0.35)] motion-safe:animate-scale-in"
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success-50 text-success-700">
        <Check size={14} strokeWidth={2.6} aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold text-surface-800">Settings saved</p>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-1 rounded p-1 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-700"
        aria-label="Dismiss"
      >
        <X size={13} />
      </button>
    </div>
  );
}

/** Destructive-action confirmation. Requires an explicit typed match. */
export function ConfirmDialog({
  open,
  title,
  description,
  impact,
  confirmLabel,
  confirmWord,
  typedValue,
  onTypedValueChange,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  impact: string[];
  confirmLabel: string;
  confirmWord: string;
  typedValue: string;
  onTypedValueChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onCancel]);

  if (!open) return null;
  const matches = typedValue.trim().toUpperCase() === confirmWord.toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" onClick={onCancel} aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        className="relative w-full max-w-md rounded-xl border border-surface-200 bg-white shadow-2xl motion-safe:animate-scale-in"
      >
        <div className="flex items-start gap-3 border-b border-surface-200 p-5">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-critical-50 text-critical-700">
            <AlertTriangle size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-title" className="text-base font-bold text-surface-950">
              {title}
            </h2>
            <p id="confirm-description" className="mt-1 text-sm leading-6 text-surface-600">
              {description}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Cancel"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-surface-500">What happens</p>
          <ul className="mt-2 space-y-1.5">
            {impact.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-surface-700">
                <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-surface-400" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-4">
            <label htmlFor="confirm-input" className="block text-sm font-semibold text-surface-800">
              Type <span className="font-mono text-critical-700">{confirmWord}</span> to confirm
            </label>
            <input
              id="confirm-input"
              value={typedValue}
              onChange={(event) => onTypedValueChange(event.target.value)}
              autoComplete="off"
              className="mt-1.5 w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm outline-none transition-colors focus:border-critical-400 focus:ring-2 focus:ring-critical-100"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-surface-200 bg-surface-50/60 p-4">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={!matches}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
