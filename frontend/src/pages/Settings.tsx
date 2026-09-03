import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  AlertCircle,
  Bell,
  Building2,
  CreditCard,
  Gauge,
  Link2,
  Lock,
  Palette,
  RefreshCw,
  Search,
  ShieldAlert,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  platformOptions,
  industryOptions,
  countryOptions,
  timezoneOptions,
  currencyOptions,
  frequencyOptions,
  crawlScopeOptions,
  notificationCopy,
  planInfo,
  type SettingsState,
} from '../data/settings.mock';
import { fetchSettings, persistSettings } from '../data/settings.repository';
import { fetchIntegrations, type IntegrationRecord } from '../data/integrations.repository';
import { initialsFor } from '../data/user.repository';
import { ApiError } from '../lib/api';
import { Button, ModuleHeader, StatusBadge } from '../components/workflows/WorkflowPrimitives';
import ProfileSection from '../components/settings/ProfileSection';
import SecuritySection from '../components/settings/SecuritySection';
import { useTheme, type ThemePreference } from '../context/ThemeContext';
import {
  ConfirmDialog,
  Field,
  PreviewNotice,
  ReadOnlyRow,
  SaveBar,
  SavedToast,
  SelectInput,
  SettingsCard,
  TextInput,
  ToggleRow,
  settingsCard,
} from '../components/settings/SettingsPrimitives';

type SectionId =
  | 'profile'
  | 'workspace'
  | 'analysis'
  | 'notifications'
  | 'integrations'
  | 'appearance'
  | 'security'
  | 'billing'
  | 'danger';

interface SectionMeta {
  id: SectionId;
  label: string;
  group: 'Account' | 'Workspace' | 'Platform';
  icon: LucideIcon;
  title: string;
  description: string;
  /** Extra terms matched by the settings search. */
  keywords: string;
}

const SECTIONS: SectionMeta[] = [
  { id: 'profile', label: 'Profile', group: 'Account', icon: UserRound, title: 'Profile', description: 'Your personal Scorelo account information.', keywords: 'name email role job title avatar' },
  { id: 'appearance', label: 'Appearance', group: 'Account', icon: Palette, title: 'Appearance', description: 'How the Scorelo interface is presented to you.', keywords: 'theme density motion dark light' },
  { id: 'security', label: 'Security', group: 'Account', icon: Lock, title: 'Security', description: 'Password, sessions and account protection.', keywords: 'password session device two factor 2fa login' },
  { id: 'workspace', label: 'Workspace & store', group: 'Workspace', icon: Building2, title: 'Workspace & store', description: 'The store Scorelo analyzes and the context it uses for scoring.', keywords: 'store url platform shopify industry country timezone currency' },
  { id: 'analysis', label: 'Analysis', group: 'Workspace', icon: Gauge, title: 'Analysis', description: 'How often Scorelo audits your store and how deeply it crawls.', keywords: 'crawl frequency schedule scope pages robots scoring' },
  { id: 'notifications', label: 'Notifications', group: 'Workspace', icon: Bell, title: 'Notifications', description: 'Choose what Scorelo emails you about.', keywords: 'email alerts digest weekly summary critical' },
  { id: 'integrations', label: 'Integrations', group: 'Platform', icon: Link2, title: 'Integrations', description: 'Data sources connected to this workspace.', keywords: 'shopify search console analytics clarity connect sync' },
  { id: 'billing', label: 'Plan & usage', group: 'Platform', icon: CreditCard, title: 'Plan & usage', description: 'Your current plan and how much of it you are using.', keywords: 'billing subscription invoice payment upgrade plan' },
  { id: 'danger', label: 'Danger zone', group: 'Platform', icon: ShieldAlert, title: 'Danger zone', description: 'Irreversible actions that affect this workspace.', keywords: 'delete disconnect remove destroy reset' },
];

/** The select shows words; the context stores keys. Mapped in one place, both directions. */
const themeLabel: Record<ThemePreference, 'System' | 'Light' | 'Dark'> = { system: 'System', light: 'Light', dark: 'Dark' };
const labelToPreference: Record<'System' | 'Light' | 'Dark', ThemePreference> = { System: 'system', Light: 'light', Dark: 'dark' };

const GROUP_ORDER: SectionMeta['group'][] = ['Account', 'Workspace', 'Platform'];

/** Sections whose fields feed the draft the save bar writes. The rest read live data or are
 * read-only, so they neither show the save bar nor carry an unsaved-changes marker. */
const EDITABLE_SECTIONS = new Set<SectionId>(['profile', 'workspace', 'analysis', 'notifications', 'appearance', 'security']);

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const isDomain = (value: string) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value.trim());

export default function Settings() {
  const { section } = useParams<{ section?: string }>();
  const { preference, setPreference } = useTheme();
  const navigate = useNavigate();

  const [saved, setSaved] = useState<SettingsState | null>(null);
  const [draft, setDraft] = useState<SettingsState | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [search, setSearch] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmWord, setConfirmWord] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const active: SectionId = useMemo(() => {
    const match = SECTIONS.find((item) => item.id === section);
    return match ? match.id : 'profile';
  }, [section]);
  const activeMeta = SECTIONS.find((item) => item.id === active) ?? SECTIONS[0];

  // Rewrite the address bar when the URL names a section that does not exist. The page already
  // fell back to Profile, but the bogus path stayed visible and shareable — so a link like
  // /settings/billling looked meaningful, and bookmarking it preserved the mistake.
  // `/settings` with no section is left alone: it is a legitimate entry point, not a typo.
  useEffect(() => {
    if (section !== undefined && section !== active) {
      navigate(`/settings/${active}`, { replace: true });
    }
  }, [section, active, navigate]);

  const load = useCallback(async () => {
    try {
      setState('loading');
      const result = await fetchSettings();
      setSaved(result);
      setDraft(structuredClone(result));
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isDirty = Boolean(saved && draft) && JSON.stringify(saved) !== JSON.stringify(draft);

  // Warn before losing edits on a full page unload.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const errors = useMemo(() => {
    if (!draft) return {} as Record<string, string>;
    const next: Record<string, string> = {};
    if (!draft.profile.fullName.trim()) next.fullName = 'Enter your name.';
    if (!isEmail(draft.profile.email)) next.email = 'Enter a valid email address.';
    if (!draft.workspace.workspaceName.trim()) next.workspaceName = 'Workspace name is required.';
    if (!draft.workspace.storeName.trim()) next.storeName = 'Store name is required.';
    if (!isDomain(draft.workspace.storeUrl)) next.storeUrl = 'Enter a domain, for example myshopifystore.com';
    if (draft.analysis.pageLimit < 100 || draft.analysis.pageLimit > 10000) {
      next.pageLimit = 'Choose a limit between 100 and 10,000 pages.';
    }
    return next;
  }, [draft]);

  const hasErrors = Object.keys(errors).length > 0;

  const update = <K extends keyof SettingsState>(key: K, patch: Partial<SettingsState[K]>) =>
    setDraft((current) => (current ? { ...current, [key]: { ...current[key], ...patch } } : current));

  // A rejected save used to leave `isSaving` true forever — the button stayed on "Saving…",
  // the edits looked lost, and the reason (a duplicate email address, say) never reached the
  // customer. The failure is now surfaced and the draft is left untouched so it can be retried.
  const onSave = async () => {
    if (!draft || hasErrors) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await persistSettings(draft);
      setSaved(structuredClone(result));
      setDraft(structuredClone(result));
      setShowToast(true);
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : 'Could not save your changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const onDiscard = () => saved && setDraft(structuredClone(saved));

  const visibleSections = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return SECTIONS;
    return SECTIONS.filter((item) =>
      `${item.label} ${item.title} ${item.description} ${item.keywords}`.toLowerCase().includes(query),
    );
  }, [search]);

  // ─── Load / error states ───────────────────────────────────────────
  if (state === 'loading' || !draft) {
    if (state === 'error') {
      return (
        <div className="mx-auto max-w-[1440px] p-5 md:p-8">
          <div className={`${settingsCard} mx-auto flex max-w-md flex-col items-center p-10 text-center`}>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-critical-50 text-critical-600">
              <AlertCircle size={24} />
            </span>
            <h1 className="mt-4 text-lg font-bold text-surface-950">Unable to load settings</h1>
            <p className="mt-1.5 text-sm text-surface-500">Your saved preferences were not changed.</p>
            <div className="mt-6">
              <Button onClick={load}>
                <RefreshCw size={15} />
                Retry
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return <SettingsSkeleton />;
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-8 p-5 pb-16 md:p-8">
      <ModuleHeader
        eyebrow="Configuration"
        title="Settings"
        description="Manage your account, the store Scorelo analyzes, and how the platform behaves."
      />

      <div className="grid gap-6 lg:grid-cols-[264px_minmax(0,1fr)] lg:items-start">
        {/* ── Navigation ────────────────────────────────────────── */}
        <nav className="lg:sticky lg:top-6" aria-label="Settings sections">
          {/* Identity header: the same monogram the app header renders, so the settings nav
              is visibly anchored to the account being edited. */}
          <div className="mb-3 hidden items-center gap-3 rounded-xl border border-surface-200 bg-surface-0 p-3 lg:flex">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
              {initialsFor(draft.profile.fullName)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold text-surface-900">
                {draft.profile.fullName.trim() || 'Your account'}
              </span>
              <span className="block truncate text-[11px] text-surface-500">{draft.profile.email}</span>
            </span>
          </div>

          <div className="relative mb-3">
            <label htmlFor="settings-search" className="sr-only">
              Search settings
            </label>
            <Search
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"
            />
            <input
              id="settings-search"
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search settings…"
              className="w-full rounded-lg border border-surface-200 bg-surface-0 py-2 pl-8 pr-8 text-sm outline-none transition-colors placeholder:text-surface-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-700"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Mobile / tablet: horizontal pills. Desktop: grouped list. */}
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2 lg:hidden">
            {visibleSections.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(`/settings/${item.id}`)}
                aria-current={active === item.id ? 'page' : undefined}
                className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                  active === item.id ? 'bg-surface-950 text-surface-0' : 'border border-surface-200 bg-surface-0 text-surface-600'
                }`}
              >
                <item.icon size={13} aria-hidden="true" />
                {item.label}
              </button>
            ))}
            {visibleSections.length === 0 && (
              <p className="px-2 py-2 text-xs text-surface-500">No settings match “{search}”.</p>
            )}
          </div>

          <div className="hidden lg:block">
            {GROUP_ORDER.map((group) => {
              const items = visibleSections.filter((item) => item.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group} className="mb-5">
                  <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-surface-400">{group}</p>
                  <ul className="space-y-0.5">
                    {items.map((item) => {
                      const isActive = active === item.id;
                      const isDanger = item.id === 'danger';
                      return (
                        <li key={item.id}>
                          <Link
                            to={`/settings/${item.id}`}
                            aria-current={isActive ? 'page' : undefined}
                            className={`group relative flex items-center gap-2.5 rounded-lg py-2 pl-3 pr-2.5 text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                              isActive
                                ? isDanger
                                  ? 'bg-critical-50 text-critical-700'
                                  : 'bg-brand-50 text-brand-700'
                                : isDanger
                                  ? 'text-critical-600 hover:bg-critical-50/60'
                                  : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
                            }`}
                          >
                            {/* Accent rail — reinforces the active row beyond colour alone. */}
                            {isActive && (
                              <span
                                aria-hidden="true"
                                className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full ${
                                  isDanger ? 'bg-critical-500' : 'bg-brand-600'
                                }`}
                              />
                            )}
                            <item.icon
                              size={15}
                              aria-hidden="true"
                              className={`flex-shrink-0 transition-colors ${
                                isActive ? '' : 'text-surface-400 group-hover:text-surface-600'
                              }`}
                            />
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            {/* Unsaved-changes marker: the sections the save bar actually covers. */}
                            {isDirty && EDITABLE_SECTIONS.has(item.id) && (
                              <span
                                className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-warning-500"
                                title="Unsaved changes"
                                aria-label="Unsaved changes"
                              />
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            {visibleSections.length === 0 && (
              <p className="px-3 py-4 text-xs text-surface-500">No settings match “{search}”.</p>
            )}
          </div>
        </nav>

        {/* ── Active section ────────────────────────────────────── */}
        <div className="min-w-0">
          <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-surface-200 pb-4">
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight text-surface-950">{activeMeta.title}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-surface-500">{activeMeta.description}</p>
            </div>
            <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-surface-200 bg-surface-0 px-2.5 py-1.5 text-[11px] font-bold text-surface-600">
              <activeMeta.icon size={13} aria-hidden="true" className="text-surface-400" />
              {activeMeta.group}
            </span>
          </header>

          {saveError && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-critical-200 bg-critical-50 p-3.5"
            >
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-critical-600" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-critical-800">Changes were not saved</p>
                <p className="mt-0.5 text-xs leading-5 text-critical-700">{saveError}</p>
              </div>
              <button
                type="button"
                onClick={() => setSaveError(null)}
                aria-label="Dismiss"
                className="rounded p-1 text-critical-500 transition-colors hover:bg-critical-100 hover:text-critical-800"
              >
                <X size={13} />
              </button>
            </div>
          )}

          <div className="space-y-5">
            {active === 'profile' && (
              <ProfileSection
                profile={draft.profile}
                workspace={draft.workspace}
                errors={errors}
                onChange={(patch) => update('profile', patch)}
              />
            )}

            {active === 'workspace' && (
              <>
                <SettingsCard title="Workspace" description="The organisation this Scorelo workspace belongs to.">
                  <Field label="Workspace name" htmlFor="workspaceName" error={errors.workspaceName} hint="Shown in reports and shared exports.">
                    <TextInput
                      id="workspaceName"
                      value={draft.workspace.workspaceName}
                      onChange={(value) => update('workspace', { workspaceName: value })}
                      invalid={Boolean(errors.workspaceName)}
                      describedBy={errors.workspaceName ? 'workspaceName-error' : 'workspaceName-hint'}
                    />
                  </Field>
                </SettingsCard>

                <SettingsCard
                  title="Store"
                  description="The storefront Scorelo crawls. These values set the context for every pillar score."
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Store name" htmlFor="storeName" error={errors.storeName} hint="Displayed in the dashboard header.">
                      <TextInput
                        id="storeName"
                        value={draft.workspace.storeName}
                        onChange={(value) => update('workspace', { storeName: value })}
                        invalid={Boolean(errors.storeName)}
                        describedBy={errors.storeName ? 'storeName-error' : 'storeName-hint'}
                      />
                    </Field>
                    <Field label="Store URL" htmlFor="storeUrl" error={errors.storeUrl} hint="The domain Scorelo audits.">
                      <TextInput
                        id="storeUrl"
                        value={draft.workspace.storeUrl}
                        onChange={(value) => update('workspace', { storeUrl: value })}
                        invalid={Boolean(errors.storeUrl)}
                        prefix="https://"
                        describedBy={errors.storeUrl ? 'storeUrl-error' : 'storeUrl-hint'}
                      />
                    </Field>
                    <Field label="Platform" htmlFor="platform" hint="Determines which platform-specific checks run.">
                      <SelectInput
                        id="platform"
                        value={draft.workspace.platform}
                        options={platformOptions}
                        onChange={(value) => update('workspace', { platform: value })}
                        describedBy="platform-hint"
                      />
                    </Field>
                    <Field label="Industry" htmlFor="industry" hint="Used to benchmark your scores against similar stores.">
                      <SelectInput
                        id="industry"
                        value={draft.workspace.industry}
                        options={industryOptions}
                        onChange={(value) => update('workspace', { industry: value })}
                        describedBy="industry-hint"
                      />
                    </Field>
                    <Field label="Primary market" htmlFor="country" hint="Where most of your customers are.">
                      <SelectInput
                        id="country"
                        value={draft.workspace.country}
                        options={countryOptions}
                        onChange={(value) => update('workspace', { country: value })}
                        describedBy="country-hint"
                      />
                    </Field>
                    <Field label="Currency" htmlFor="currency" hint="Applied to revenue-related findings.">
                      <SelectInput
                        id="currency"
                        value={draft.workspace.currency}
                        options={currencyOptions}
                        onChange={(value) => update('workspace', { currency: value })}
                        describedBy="currency-hint"
                      />
                    </Field>
                    <Field label="Timezone" htmlFor="timezone" hint="Schedules and timestamps use this timezone." className="sm:col-span-2">
                      <SelectInput
                        id="timezone"
                        value={draft.workspace.timezone}
                        options={timezoneOptions}
                        onChange={(value) => update('workspace', { timezone: value })}
                        describedBy="timezone-hint"
                      />
                    </Field>
                  </div>
                </SettingsCard>
              </>
            )}

            {active === 'analysis' && (
              <>
                <SettingsCard title="Schedule" description="Keep scores current without running audits by hand.">
                  <ToggleRow
                    id="autoAnalysis"
                    label="Automatic analysis"
                    description="Run a full audit on a schedule and refresh every pillar score automatically."
                    checked={draft.analysis.autoAnalysis}
                    onChange={(next) => update('analysis', { autoAnalysis: next })}
                  />
                  <div className="border-t border-surface-100 pt-5">
                    <Field
                      label="Frequency"
                      htmlFor="frequency"
                      hint={
                        draft.analysis.autoAnalysis
                          ? 'How often the scheduled audit runs.'
                          : 'Enable automatic analysis to use a schedule.'
                      }
                      className="max-w-xs"
                    >
                      <SelectInput
                        id="frequency"
                        value={draft.analysis.frequency}
                        options={frequencyOptions}
                        onChange={(value) => update('analysis', { frequency: value })}
                        disabled={!draft.analysis.autoAnalysis}
                        describedBy="frequency-hint"
                      />
                    </Field>
                  </div>
                </SettingsCard>

                <SettingsCard title="Crawl scope" description="Control how much of the store each audit covers.">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Scope" htmlFor="crawlScope" hint="Narrower scopes finish faster but cover less.">
                      <SelectInput
                        id="crawlScope"
                        value={draft.analysis.crawlScope}
                        options={crawlScopeOptions}
                        onChange={(value) => update('analysis', { crawlScope: value })}
                        describedBy="crawlScope-hint"
                      />
                    </Field>
                    <Field label="Page limit" htmlFor="pageLimit" error={errors.pageLimit} hint="Maximum pages crawled per audit (100–10,000).">
                      <TextInput
                        id="pageLimit"
                        type="number"
                        value={String(draft.analysis.pageLimit)}
                        onChange={(value) => update('analysis', { pageLimit: Number(value) || 0 })}
                        invalid={Boolean(errors.pageLimit)}
                        describedBy={errors.pageLimit ? 'pageLimit-error' : 'pageLimit-hint'}
                      />
                    </Field>
                  </div>

                  <div className="mt-2 divide-y divide-surface-100 border-t border-surface-100">
                    <ToggleRow
                      id="includeCollections"
                      label="Include collection pages"
                      description="Audit category and collection templates alongside products."
                      checked={draft.analysis.includeCollections}
                      onChange={(next) => update('analysis', { includeCollections: next })}
                    />
                    <ToggleRow
                      id="includeBlog"
                      label="Include blog and articles"
                      description="Cover editorial content in Content and SEO checks."
                      checked={draft.analysis.includeBlog}
                      onChange={(next) => update('analysis', { includeBlog: next })}
                    />
                    <ToggleRow
                      id="respectRobots"
                      label="Respect robots.txt"
                      description="Skip paths your robots.txt disallows. Turning this off may surface pages search engines never see."
                      checked={draft.analysis.respectRobots}
                      onChange={(next) => update('analysis', { respectRobots: next })}
                    />
                  </div>
                </SettingsCard>

                <SettingsCard title="Score methodology" description="How Scorelo turns findings into scores.">
                  <PreviewNotice>
                    Pillar weighting and scoring thresholds are fixed by the Scorelo audit engine so results stay
                    comparable across audits and stores. They are not configurable.
                  </PreviewNotice>
                  <div className="mt-4">
                    <ReadOnlyRow label="Pillars scored" value="SEO, Content, Speed, CRO, AI Discovery" />
                    <ReadOnlyRow label="Score range" value="0–100 per pillar" />
                    <ReadOnlyRow
                      label="Status bands"
                      value="Excellent 90+ · Good 75–89 · Needs Work 50–74 · Critical below 50"
                    />
                  </div>
                </SettingsCard>
              </>
            )}

            {active === 'notifications' && (
              <>
                <SettingsCard title="Analysis emails" description="Updates about audits and what they find.">
                  <div className="divide-y divide-surface-100">
                    {notificationCopy
                      .filter((item) => item.group === 'Analysis')
                      .map((item) => (
                        <ToggleRow
                          key={item.key}
                          id={item.key}
                          label={item.label}
                          description={item.description}
                          checked={draft.notifications[item.key]}
                          onChange={(next) => update('notifications', { [item.key]: next })}
                        />
                      ))}
                  </div>
                </SettingsCard>

                <SettingsCard title="Account emails" description="Operational and product messages.">
                  <div className="divide-y divide-surface-100">
                    {notificationCopy
                      .filter((item) => item.group === 'Account')
                      .map((item) => (
                        <ToggleRow
                          key={item.key}
                          id={item.key}
                          label={item.label}
                          description={item.description}
                          checked={draft.notifications[item.key]}
                          onChange={(next) => update('notifications', { [item.key]: next })}
                        />
                      ))}
                  </div>
                </SettingsCard>
              </>
            )}

            {active === 'integrations' && <IntegrationsSection />}

            {active === 'appearance' && (
              <SettingsCard title="Interface" description="Presentation preferences for this workspace.">
                {/* Theme is stored per browser, not per account: it is a property of the screen
                    you are looking at, not of who you are, and the same person on a laptop and a
                    phone can reasonably want different answers. That is also why it needs no
                    column and no migration. */}
                <Field
                  label="Theme"
                  htmlFor="theme"
                  hint="System follows your operating system and keeps following it when that changes."
                  className="max-w-xs"
                >
                  <SelectInput
                    id="theme"
                    value={themeLabel[preference]}
                    options={['System', 'Light', 'Dark'] as const}
                    onChange={(value) => setPreference(labelToPreference[value])}
                    describedBy="theme-hint"
                  />
                </Field>
                <div className="mt-5 border-t border-surface-100 pt-5" />
                <Field label="Density" htmlFor="density" hint="Compact reduces padding in tables and lists." className="max-w-xs">
                  <SelectInput
                    id="density"
                    value={draft.appearance.density}
                    options={['Comfortable', 'Compact'] as const}
                    onChange={(value) => update('appearance', { density: value })}
                    describedBy="density-hint"
                  />
                </Field>
                <div className="mt-2 border-t border-surface-100">
                  <ToggleRow
                    id="reduceMotion"
                    label="Reduce motion"
                    description="Minimise transitions and animated score rings. Your operating system setting is always respected as well."
                    checked={draft.appearance.reduceMotion}
                    onChange={(next) => update('appearance', { reduceMotion: next })}
                  />
                </div>
              </SettingsCard>
            )}

            {/* Every value here used to be a string literal — "Last changed 30 days ago",
                "Windows · Chrome", "Today, 09:14 AM", "Karachi, Pakistan" — presented as fact
                about the customer's own account with nothing behind it. The PreviewNotice that
                excused them ("this build runs without an authentication backend") had also become
                untrue. SecuritySection reads real sessions and real events from the database, and
                shows an honest empty state when there are none. */}
            {active === 'security' && <SecuritySection />}

            {active === 'billing' && <BillingSection />}

            {active === 'danger' && (
              <DangerSection
                storeName={draft.workspace.storeName}
                onDisconnect={() => {
                  setConfirmWord('');
                  setConfirmOpen(true);
                }}
              />
            )}
          </div>

          {/* Save bar — only for sections that hold editable state. */}
          {EDITABLE_SECTIONS.has(active) && (
            <SaveBar
              visible={isDirty}
              saving={isSaving}
              onSave={onSave}
              onCancel={onDiscard}
              message={hasErrors ? 'Fix the highlighted fields to save' : 'You have unsaved changes'}
            />
          )}
        </div>
      </div>

      <SavedToast visible={showToast} onDismiss={() => setShowToast(false)} />

      <ConfirmDialog
        open={confirmOpen}
        title="Disconnect this store?"
        description="Scorelo will stop analyzing this storefront until a store is reconnected."
        impact={[
          'Scheduled audits stop running for this workspace.',
          'Store name and URL are cleared from your settings.',
          'Existing scores and findings remain visible until the next audit.',
        ]}
        confirmLabel="Disconnect store"
        confirmWord="DISCONNECT"
        typedValue={confirmWord}
        onTypedValueChange={setConfirmWord}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          update('workspace', { storeName: '', storeUrl: '' });
          update('analysis', { autoAnalysis: false });
          setConfirmOpen(false);
          setConfirmWord('');
          navigate('/settings/workspace');
        }}
      />
    </div>
  );
}

// ─── Integrations (reads the real records; does not duplicate the module) ──
function IntegrationsSection() {
  const [records, setRecords] = useState<IntegrationRecord[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    fetchIntegrations()
      .then((data) => { setRecords(data); setLoadState('success'); })
      .catch((error) => { console.error('Failed to load integrations', error); setLoadState('error'); });
  }, []);

  const connected = records.filter((record) => record.status === 'Connected').length;
  const attention = records.filter((record) => record.status === 'Needs Attention').length;

  if (loadState === 'loading') return <SettingsCard title="Connected data sources" description="Loading…"><div className="h-24" /></SettingsCard>;
  if (loadState === 'error') return <SettingsCard title="Connected data sources" description="Failed to load integrations."><div /></SettingsCard>;

  return (
    <>
      <SettingsCard
        title="Connected data sources"
        description="Scorelo uses these connections to enrich its analysis. Manage them in the Integrations module."
        footer={
          <Link
            to="/integrations"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
          >
            <Link2 size={14} aria-hidden="true" />
            Open Integrations
          </Link>
        }
      >
        <div className="mb-5 grid grid-cols-3 gap-3">
          {[
            { label: 'Connected', value: connected },
            { label: 'Need attention', value: attention },
            { label: 'Available', value: records.length },
          ].map((tile) => (
            <div key={tile.label} className="rounded-lg border border-surface-200 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-surface-500">{tile.label}</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-surface-950">{tile.value}</p>
            </div>
          ))}
        </div>

        <ul className="divide-y divide-surface-100">
          {records.map((record) => (
            <li key={record.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-surface-900">{record.name}</p>
                <p className="mt-0.5 text-xs text-surface-500">
                  {record.status === 'Connected' ? `Last synced ${record.lastSynced}` : record.detail}
                </p>
              </div>
              <StatusBadge
                label={record.status}
                tone={record.status === 'Connected' ? 'success' : record.status === 'Needs Attention' ? 'warning' : 'neutral'}
              />
            </li>
          ))}
        </ul>
      </SettingsCard>
    </>
  );
}

// ─── Plan & usage (no billing backend — read-only) ────────────────────
function BillingSection() {
  return (
    <>
      <SettingsCard title="Current plan" description="What this workspace is entitled to today.">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-2xl font-bold tracking-tight text-surface-950">{planInfo.name}</h4>
              <StatusBadge label="Active" tone="success" />
            </div>
            <p className="mt-1 text-sm text-surface-500">{planInfo.description}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tracking-tight text-surface-950 tabular-nums">{planInfo.price}</p>
            <p className="text-xs text-surface-500">{planInfo.cadence}</p>
          </div>
        </div>
      </SettingsCard>

      {/* This card previously rendered hard-coded meters (1,342 / 2,000 pages, 4 / 6 integrations)
          as filled progress bars, which read as measured consumption. Nothing tracks usage yet,
          so it says that instead — the same treatment the Billing card below already had. */}
      <SettingsCard title="Usage" description="Your consumption against the current plan limits.">
        <PreviewNotice>
          Usage tracking is not connected in this build. Consumption against plan limits will appear
          here once audits record it.
        </PreviewNotice>
      </SettingsCard>

      <SettingsCard title="Billing" description="Payment method and invoice history.">
        <PreviewNotice>
          Scorelo is running on the Free plan in this build. Paid plans, payment methods and invoices require the billing
          service, which is not connected here.
        </PreviewNotice>
      </SettingsCard>
    </>
  );
}

// ─── Danger zone ──────────────────────────────────────────────────────
function DangerSection({ storeName, onDisconnect }: { storeName: string; onDisconnect: () => void }) {
  return (
    <>
      <section className="overflow-hidden rounded-xl border border-critical-200 bg-surface-0">
        <div className="border-b border-critical-100 bg-critical-50/60 px-5 py-4 sm:px-6">
          <h3 className="text-base font-bold tracking-tight text-critical-900">Irreversible actions</h3>
          <p className="mt-1 text-sm leading-6 text-critical-700">
            These actions change what Scorelo analyzes. Each one asks for confirmation first.
          </p>
        </div>

        <div className="divide-y divide-surface-100">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-sm font-bold text-surface-900">Disconnect store</p>
              <p className="mt-1 max-w-xl text-xs leading-5 text-surface-500">
                Stops all scheduled analysis and clears{' '}
                <span className="font-semibold text-surface-700">{storeName || 'this store'}</span> from your workspace
                settings. Existing findings stay visible until the next audit.
              </p>
            </div>
            <Button variant="danger" onClick={onDisconnect}>
              Disconnect store
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-sm font-bold text-surface-900">Delete workspace</p>
              <p className="mt-1 max-w-xl text-xs leading-5 text-surface-500">
                Permanently removes the workspace, every audit and all historical scores.
              </p>
            </div>
            <Button variant="danger" disabled>
              Delete workspace
            </Button>
          </div>
        </div>

        <div className="border-t border-surface-200 px-5 py-4 sm:px-6">
          <PreviewNotice>
            Workspace deletion requires owner verification through the Scorelo account service, which is not connected in
            this build — so the action is disabled rather than simulated.
          </PreviewNotice>
        </div>
      </section>
    </>
  );
}

// ─── Loading ──────────────────────────────────────────────────────────
function SettingsSkeleton() {
  return (
    <div className="mx-auto max-w-[1440px] space-y-8 p-5 pb-16 md:p-8" aria-busy="true" aria-label="Loading settings">
      <div className="space-y-3 border-b border-surface-200 pb-6">
        <div className="skeleton h-3 w-28" />
        <div className="skeleton h-9 w-48" />
        <div className="skeleton h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[248px_minmax(0,1fr)]">
        <div className="space-y-2">
          <div className="skeleton h-9 w-full rounded-lg" />
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="skeleton h-9 w-full rounded-lg" />
          ))}
        </div>
        <div className="space-y-5">
          <div className="space-y-2 border-b border-surface-200 pb-4">
            <div className="skeleton h-6 w-40" />
            <div className="skeleton h-4 w-72 max-w-full" />
          </div>
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className={`${settingsCard} p-6`}>
              <div className="skeleton h-5 w-44" />
              <div className="skeleton mt-2 h-4 w-72 max-w-full" />
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, field) => (
                  <div key={field} className="space-y-2">
                    <div className="skeleton h-4 w-24" />
                    <div className="skeleton h-10 w-full rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
