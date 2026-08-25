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
  ShieldAlert,
  UserRound,
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
import { Button, ModuleHeader, StatusBadge } from '../components/workflows/WorkflowPrimitives';
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

const GROUP_ORDER: SectionMeta['group'][] = ['Account', 'Workspace', 'Platform'];

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const isDomain = (value: string) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value.trim());

export default function Settings() {
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();

  const [saved, setSaved] = useState<SettingsState | null>(null);
  const [draft, setDraft] = useState<SettingsState | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [search, setSearch] = useState('');
  const [confirmWord, setConfirmWord] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const active: SectionId = useMemo(() => {
    const match = SECTIONS.find((item) => item.id === section);
    return match ? match.id : 'profile';
  }, [section]);
  const activeMeta = SECTIONS.find((item) => item.id === active) ?? SECTIONS[0];

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

  const onSave = async () => {
    if (!draft || hasErrors) return;
    setIsSaving(true);
    const result = await persistSettings(draft);
    setSaved(structuredClone(result));
    setDraft(structuredClone(result));
    setIsSaving(false);
    setShowToast(true);
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

      <div className="grid gap-6 lg:grid-cols-[248px_minmax(0,1fr)] lg:items-start">
        {/* ── Navigation ────────────────────────────────────────── */}
        <nav className="lg:sticky lg:top-6" aria-label="Settings sections">
          <label className="relative mb-3 block">
            <span className="sr-only">Search settings</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search settings…"
              className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm outline-none transition-colors placeholder:text-surface-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </label>

          {/* Mobile / tablet: horizontal pills. Desktop: grouped list. */}
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2 lg:hidden">
            {visibleSections.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(`/settings/${item.id}`)}
                aria-current={active === item.id ? 'page' : undefined}
                className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                  active === item.id ? 'bg-slate-950 text-white' : 'border border-surface-200 bg-white text-surface-600'
                }`}
              >
                <item.icon size={13} aria-hidden="true" />
                {item.label}
              </button>
            ))}
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
                            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                              isActive
                                ? isDanger
                                  ? 'bg-critical-50 text-critical-700'
                                  : 'bg-brand-50 text-brand-700'
                                : isDanger
                                  ? 'text-critical-600 hover:bg-critical-50/60'
                                  : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
                            }`}
                          >
                            <item.icon size={15} aria-hidden="true" className="flex-shrink-0" />
                            {item.label}
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
          <header className="mb-5 border-b border-surface-200 pb-4">
            <h2 className="text-xl font-bold tracking-tight text-surface-950">{activeMeta.title}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-surface-500">{activeMeta.description}</p>
          </header>

          <div className="space-y-5">
            {active === 'profile' && (
              <SettingsCard title="Personal information" description="Shown on your account and used for Scorelo emails.">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-lg font-bold text-brand-700">
                    {draft.profile.fullName
                      .split(' ')
                      .map((part) => part[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join('')
                      .toUpperCase() || 'S'}
                  </div>
                  <p className="text-xs leading-5 text-surface-500">
                    Your avatar is generated from your name. Image uploads are not part of this build.
                  </p>
                </div>

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <Field label="Full name" htmlFor="fullName" error={errors.fullName} hint="Used across your Scorelo workspace.">
                    <TextInput
                      id="fullName"
                      value={draft.profile.fullName}
                      onChange={(value) => update('profile', { fullName: value })}
                      invalid={Boolean(errors.fullName)}
                      describedBy={errors.fullName ? 'fullName-error' : 'fullName-hint'}
                    />
                  </Field>
                  <Field label="Email address" htmlFor="email" error={errors.email} hint="Where analysis and alert emails are sent.">
                    <TextInput
                      id="email"
                      type="email"
                      value={draft.profile.email}
                      onChange={(value) => update('profile', { email: value })}
                      invalid={Boolean(errors.email)}
                      describedBy={errors.email ? 'email-error' : 'email-hint'}
                    />
                  </Field>
                  <Field label="Job title" htmlFor="jobTitle" hint="Optional. Helps tailor recommendations.">
                    <TextInput
                      id="jobTitle"
                      value={draft.profile.jobTitle}
                      onChange={(value) => update('profile', { jobTitle: value })}
                      describedBy="jobTitle-hint"
                    />
                  </Field>
                  <Field label="Role" htmlFor="role" hint="Roles are assigned by the workspace owner.">
                    <TextInput id="role" value={draft.profile.role} onChange={() => {}} disabled describedBy="role-hint" />
                  </Field>
                </div>
              </SettingsCard>
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
                <div className="mt-4">
                  <PreviewNotice>
                    Scorelo currently ships a single light theme, tuned for long analysis sessions. A dark theme is not
                    available in this build.
                  </PreviewNotice>
                </div>
              </SettingsCard>
            )}

            {active === 'security' && (
              <>
                <SettingsCard title="Authentication" description="How you sign in to Scorelo.">
                  <PreviewNotice>
                    This build runs without an authentication backend, so password and session management are shown for
                    reference and cannot be changed here.
                  </PreviewNotice>
                  <div className="mt-4">
                    <ReadOnlyRow label="Sign-in method" value="Email and password" hint="Managed by your workspace owner" />
                    <ReadOnlyRow label="Password" value="Last changed 30 days ago" />
                    <ReadOnlyRow label="Two-factor authentication" value={<StatusBadge label="Not enabled" tone="warning" />} />
                  </div>
                </SettingsCard>

                <SettingsCard title="Active sessions" description="Devices currently signed in to this account.">
                  <div>
                    <ReadOnlyRow label="This device" value={<StatusBadge label="Current session" tone="success" />} hint="Windows · Chrome" />
                    <ReadOnlyRow label="Last sign-in" value="Today, 09:14 AM" hint="Karachi, Pakistan" />
                  </div>
                </SettingsCard>
              </>
            )}

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
          {active !== 'integrations' && active !== 'billing' && active !== 'danger' && (
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

      <SettingsCard title="Usage" description="Your consumption against the current plan limits.">
        <ul className="space-y-4">
          {planInfo.usage.map((item) => {
            const pct = Math.min((item.used / item.limit) * 100, 100);
            const nearLimit = pct >= 80;
            return (
              <li key={item.label}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold text-surface-800">{item.label}</span>
                  <span className="text-xs tabular-nums text-surface-600">
                    <span className="font-bold text-surface-900">{item.used.toLocaleString()}</span> / {item.limit.toLocaleString()}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-100">
                  <div
                    className={`h-full rounded-full ${nearLimit ? 'bg-warning-500' : 'bg-brand-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
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
      <section className="overflow-hidden rounded-xl border border-critical-200 bg-white">
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
