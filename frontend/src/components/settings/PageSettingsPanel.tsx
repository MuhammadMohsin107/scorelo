import { Check, ShieldCheck, X } from 'lucide-react';
import {
  Field,
  SelectInput,
  TextInput,
  ToggleRow,
  settingsCard,
} from './SettingsPrimitives';
import type {
  PageSettingField,
  PageSettingValue,
  PageSettingsDefinition,
} from '../../data/pageSettings.registry';

interface PageSettingsPanelProps {
  open: boolean;
  definition: PageSettingsDefinition;
  values: Record<string, PageSettingValue>;
  onClose: () => void;
  onChange: (key: string, value: PageSettingValue) => void;
  onReset: () => void;
  onSave: () => void;
}

function renderField(field: PageSettingField, value: PageSettingValue, onChange: (value: PageSettingValue) => void) {
  const sharedLabelText = (
    <div className="mb-2 flex items-center justify-between gap-3">
      <span className="text-sm font-semibold text-surface-800">{field.label}</span>
      <span className="rounded-full border border-surface-200 bg-surface-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.11em] text-surface-500">
        {field.source}
      </span>
    </div>
  );

  if (field.type === 'toggle') {
    return (
      <div key={field.key} className="border-b border-surface-100 pb-3 last:border-b-0 last:pb-0">
        <ToggleRow
          id={field.key}
          label={field.label}
          description={field.description ?? 'Toggle the generated schema behavior for this page.'}
          checked={Boolean(value)}
          onChange={(next) => onChange(next)}
        />
        <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-surface-500">
          <ShieldCheck size={10} />
          {field.source}
        </div>
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <Field key={field.key} label={field.label} htmlFor={field.key} hint={field.description} className="py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full border border-surface-200 bg-surface-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.11em] text-surface-500">
            {field.source}
          </span>
        </div>
        <div className="mt-2">
          <SelectInput
            id={field.key}
            value={String(value ?? (field.options?.[0] ?? ''))}
            options={field.options ?? []}
            onChange={(next) => onChange(next)}
          />
        </div>
      </Field>
    );
  }

  const inputValue = typeof value === 'string' ? value : '';

  if (field.type === 'textarea') {
    return (
      <div key={field.key} className="py-3">
        {sharedLabelText}
        <textarea
          id={field.key}
          value={inputValue}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 min-h-[96px] w-full rounded-lg border border-surface-200 bg-surface-0 px-3 py-2.5 text-sm text-surface-900 outline-none transition-colors placeholder:text-surface-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-surface-500">
          <span>{field.description}</span>
          {typeof field.maxLength === 'number' && (
            <span className="tabular-nums">{inputValue.length}/{field.maxLength}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div key={field.key} className="py-3">
      {sharedLabelText}
      <TextInput
        id={field.key}
        type={field.type === 'url' ? 'url' : 'text'}
        value={inputValue}
        placeholder={field.placeholder}
        onChange={(next) => onChange(next)}
      />
      <p className="mt-2 text-xs leading-5 text-surface-500">{field.description}</p>
    </div>
  );
}

export default function PageSettingsPanel({
  open,
  definition,
  values,
  onClose,
  onChange,
  onReset,
  onSave,
}: PageSettingsPanelProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button type="button" className="absolute inset-0 bg-surface-950/25" onClick={onClose} aria-label="Close settings panel" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="page-settings-title"
        className="relative flex h-full w-full max-w-2xl flex-col border-l border-surface-200 bg-surface-0 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-surface-200 px-5 py-5 sm:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-surface-500">Client settings</p>
            <h2 id="page-settings-title" className="mt-1 text-xl font-semibold text-surface-950">{definition.title}</h2>
            <p className="mt-1 text-xs leading-5 text-surface-500">{definition.description}</p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost h-9 w-9 p-0" aria-label="Close page settings">
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          {definition.sections.map((section) => (
            <section key={section.id} className={`${settingsCard} overflow-hidden`}>
              <div className="border-b border-surface-200 px-4 py-3 sm:px-5">
                <h3 className="text-sm font-bold text-surface-950">{section.title}</h3>
                {section.description && <p className="mt-1 text-xs leading-5 text-surface-500">{section.description}</p>}
              </div>
              <div className="px-4 py-3 sm:px-5">
                {section.fields.map((field) => renderField(field, values[field.key], (next) => onChange(field.key, next)))}
              </div>
            </section>
          ))}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-surface-200 bg-surface-50 px-5 py-4 sm:px-6">
          <button type="button" onClick={onReset} className="btn-ghost text-xs text-surface-600">
            Reset defaults
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Cancel
            </button>
            <button type="button" onClick={onSave} className="btn-primary text-xs">
              <Check size={14} />
              Save settings
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
