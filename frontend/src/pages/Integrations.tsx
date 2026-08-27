import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, Check, CheckCircle2, Cloud, Database, Info, Link2, RefreshCw, ShieldCheck, Unplug } from 'lucide-react';
import { fetchIntegrations, type IntegrationRecord } from '../data/integrations.repository';
import {
  beginShopifyInstall,
  describeConnectOutcome,
  describeShopifyError,
  disconnectShopify,
  fetchShopifyStatus,
  normalizeShopDomain,
  syncShopifyStore,
  type ShopifyStatus,
} from '../data/shopify.repository';
import { Button, Drawer, MetricTile, ModuleHeader, SectionHeading, StatusBadge } from '../components/workflows/WorkflowPrimitives';

type IntegrationStatus = IntegrationRecord['status'];

const statusTone: Record<IntegrationStatus, 'success' | 'warning' | 'neutral'> = { Connected: 'success', 'Needs Attention': 'warning', 'Not Connected': 'neutral' };
const iconMap: Record<string, typeof Cloud> = { Store: Database, Analytics: Cloud, Performance: ShieldCheck, 'AI / Discovery': Link2 };

interface Banner {
  tone: 'success' | 'error' | 'info';
  message: string;
}

const bannerStyles: Record<Banner['tone'], { wrap: string; icon: typeof Info }> = {
  success: { wrap: 'border-success-100 bg-success-50 text-success-800', icon: CheckCircle2 },
  error: { wrap: 'border-critical-100 bg-critical-50 text-critical-800', icon: AlertCircle },
  info: { wrap: 'border-info-100 bg-info-50 text-info-800', icon: Info },
};

export default function Integrations() {
  const [records, setRecords] = useState<IntegrationRecord[]>([]);
  const [shopify, setShopify] = useState<ShopifyStatus | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'success' | 'error'>('loading');
  const [selected, setSelected] = useState<IntegrationRecord | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [busy, setBusy] = useState<'connecting' | 'syncing' | 'disconnecting' | null>(null);
  const [shopInput, setShopInput] = useState('');
  const [shopInputError, setShopInputError] = useState<string | null>(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const load = useCallback(async () => {
    try {
      const [integrationRecords, shopifyStatus] = await Promise.all([fetchIntegrations(), fetchShopifyStatus()]);
      setRecords(integrationRecords);
      setShopify(shopifyStatus);
      setLoadState('success');
    } catch (error) {
      console.error('Failed to load integrations', error);
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The OAuth callback redirects the browser back here with the outcome. Read it once, show it,
  // then strip it from the URL so a refresh does not replay a stale "connected" banner.
  useEffect(() => {
    const outcome = searchParams.get('shopify');
    if (!outcome) return;
    const described = describeConnectOutcome(outcome, searchParams.get('reason'));
    if (described) setBanner(described);
    const next = new URLSearchParams(searchParams);
    next.delete('shopify');
    next.delete('reason');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const groups = useMemo(() => [...new Set(records.map((record) => record.group))], [records]);
  const connected = records.filter((record) => record.status === 'Connected').length;
  const attention = records.filter((record) => record.status === 'Needs Attention').length;
  const availableCount = records.filter((record) => record.available).length;

  const startConnect = async () => {
    const shopDomain = normalizeShopDomain(shopInput);
    if (!shopDomain) {
      setShopInputError('Enter your store address, for example my-store.myshopify.com');
      return;
    }
    setShopInputError(null);
    setBusy('connecting');
    try {
      // Navigates away to Shopify's permission screen; nothing is connected until Shopify
      // redirects back and the backend verifies the signed callback.
      await beginShopifyInstall(shopDomain);
    } catch (error) {
      setBusy(null);
      setBanner({ tone: 'error', message: describeShopifyError(error) });
    }
  };

  const runSync = async () => {
    setBusy('syncing');
    setBanner(null);
    try {
      const summary = await syncShopifyStore();
      const partial = summary.truncated.length > 0 ? ` Scope limit reached for ${summary.truncated.join(', ')}.` : '';
      setBanner({
        tone: 'success',
        message:
          `Synced ${summary.products} products, ${summary.collections} collections, ` +
          `${summary.pages} pages and ${summary.articles} articles from your store.${partial}`,
      });
      await load();
    } catch (error) {
      // A failed sync says so. It never leaves the previous success on screen.
      setBanner({ tone: 'error', message: describeShopifyError(error) });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const runDisconnect = async () => {
    setBusy('disconnecting');
    try {
      setShopify(await disconnectShopify());
      setConfirmingDisconnect(false);
      setSelected(null);
      setBanner({ tone: 'info', message: 'Shopify disconnected. Your previous audit history has been kept.' });
      await load();
    } catch (error) {
      setBanner({ tone: 'error', message: describeShopifyError(error) });
    } finally {
      setBusy(null);
    }
  };

  if (loadState === 'loading') {
    return <div className="mx-auto max-w-[1440px] p-8 text-sm text-surface-500">Loading integrations…</div>;
  }

  if (loadState === 'error') {
    return <div className="mx-auto max-w-[1440px] p-8 text-sm text-critical-600">Failed to load integrations. Please try again.</div>;
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-8 p-5 pb-16 md:p-8">
      <ModuleHeader
        eyebrow="Data connections"
        title="Integrations"
        description="Connect your data sources to give Scorelo the information it needs to analyze your store."
        actions={<Button onClick={() => setIsAdding(true)}><Link2 size={15} />Add integration</Button>}
      />

      {banner && <BannerNotice banner={banner} onDismiss={() => setBanner(null)} />}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Integration summary">
        <MetricTile label="Connected" value={connected} detail="Data sources active" tone="success" />
        <MetricTile label="Needs attention" value={attention} detail="Action recommended" tone="warning" />
        <MetricTile label="Available now" value={availableCount} detail="Connectors you can use" />
        <MetricTile label="Last Shopify sync" value={shopify?.lastSyncedAt ? new Date(shopify.lastSyncedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never'} detail="Most recent store read" tone="info" />
      </section>

      <ShopifyPanel
        status={shopify}
        busy={busy}
        shopInput={shopInput}
        shopInputError={shopInputError}
        onShopInputChange={(value) => { setShopInput(value); setShopInputError(null); }}
        onConnect={startConnect}
        onSync={runSync}
        onRequestDisconnect={() => setConfirmingDisconnect(true)}
      />

      {groups.map((group) => {
        const GroupIcon = iconMap[group] ?? Database;
        const groupRecords = records.filter((record) => record.group === group);
        return (
          <section key={group} className="space-y-4" aria-labelledby={`${group}-integrations`}>
            <SectionHeading eyebrow="Connection group" title={group} />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {groupRecords.map((record) => (
                <article key={record.id} className="group rounded-xl border border-surface-200 bg-white p-5 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:border-brand-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-100 text-surface-700"><GroupIcon size={19} /></div>
                    {record.available
                      ? <StatusBadge label={record.status} tone={statusTone[record.status]} />
                      : <StatusBadge label="Coming soon" tone="neutral" />}
                  </div>
                  <h3 className="mt-5 text-base font-bold text-surface-950">{record.name}</h3>
                  <p className="mt-1 min-h-10 text-sm leading-5 text-surface-500">{record.description}</p>
                  {record.notice && <p className="mt-4 rounded-lg bg-warning-50 px-3 py-2 text-xs font-medium leading-5 text-warning-700">{record.notice}</p>}
                  <div className="mt-5 border-t border-surface-100 pt-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-surface-500">{record.status === 'Connected' ? 'Last synced' : 'Connection'}</p>
                    <p className="mt-1 text-sm font-semibold text-surface-800">{record.status === 'Connected' ? record.lastSynced : record.detail}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {record.data.slice(0, 2).map((item) => <span key={item} className="rounded-md bg-surface-100 px-2 py-1 text-[11px] text-surface-600">{item}</span>)}
                    </div>
                  </div>
                  <div className="mt-5 flex items-center gap-2">
                    {record.available
                      ? <Button variant="secondary" onClick={() => setSelected(record)}>View details</Button>
                      // No Connect action without a connector behind it. The previous build offered
                      // one for all six providers and "connected" them by writing a status column.
                      : <p className="text-xs leading-5 text-surface-500">Connector not available yet.</p>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}

      <Drawer open={Boolean(selected)} title={selected?.name ?? ''} eyebrow="Integration detail" onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <StatusBadge label={selected.status} tone={statusTone[selected.status]} />
              <StatusBadge label={selected.group} tone="neutral" />
            </div>
            <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-surface-500">Account / store</p>
              <p className="mt-1 text-sm font-bold text-surface-900">{selected.detail}</p>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-surface-500">Last sync</p>
              <p className="mt-1 text-sm text-surface-700">{selected.lastSynced}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-surface-500">Data received</p>
              <ul className="mt-3 space-y-2">
                {selected.data.map((item) => <li key={item} className="flex gap-2 text-sm text-surface-700"><Check size={15} className="mt-0.5 text-success-600" />{item}</li>)}
              </ul>
            </div>
            {selected.id === 'shopify' && shopify?.scopes.length ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-surface-500">Permissions granted</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {shopify.scopes.map((scope) => <span key={scope} className="rounded-md bg-surface-100 px-2 py-1 font-mono text-[11px] text-surface-600">{scope}</span>)}
                </div>
              </div>
            ) : null}
            <p className="text-xs leading-5 text-surface-500">
              {selected.id === 'shopify'
                ? 'Manage this connection from the Shopify panel above.'
                : 'This connector is not available yet. Nothing is connected.'}
            </p>
          </div>
        )}
      </Drawer>

      <Drawer open={isAdding} title="Add an integration" eyebrow="Available data sources" onClose={() => setIsAdding(false)}>
        <div className="space-y-4">
          {records.filter((record) => record.available && record.status === 'Not Connected').map((record) => (
            <button
              key={record.id}
              onClick={() => { setIsAdding(false); setSelected(null); document.getElementById('shopify-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
              className="flex w-full items-center gap-3 rounded-xl border border-surface-200 p-4 text-left transition hover:border-brand-200 hover:bg-brand-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-100"><Database size={18} /></div>
              <div className="flex-1">
                <p className="text-sm font-bold text-surface-900">{record.name}</p>
                <p className="mt-1 text-xs text-surface-500">{record.description}</p>
              </div>
              <span aria-hidden="true" className="text-surface-400">&#8250;</span>
            </button>
          ))}
          <div className="rounded-lg bg-surface-50 p-4 text-xs leading-5 text-surface-500">
            {records.some((record) => record.available && record.status === 'Not Connected')
              ? 'Only Shopify has a live connector today. The remaining providers are listed on this page and will become connectable as their connectors ship.'
              : 'Every available connector is already set up. The remaining providers will become connectable as their connectors ship.'}
          </div>
        </div>
      </Drawer>

      <Drawer open={confirmingDisconnect} title="Disconnect Shopify?" eyebrow="Confirm" onClose={() => setConfirmingDisconnect(false)}>
        <div className="space-y-6">
          <p className="text-sm leading-6 text-surface-700">
            Scorelo will delete its stored Shopify credentials and stop reading data from
            <span className="font-semibold text-surface-900"> {shopify?.shopDomain}</span>. New audits cannot run until you reconnect.
          </p>
          <p className="text-sm leading-6 text-surface-700">
            Your existing audit history, findings and reports are kept — disconnecting does not delete past analysis.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" onClick={runDisconnect} disabled={busy === 'disconnecting'}>
              <Unplug size={15} />{busy === 'disconnecting' ? 'Disconnecting…' : 'Yes, disconnect'}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmingDisconnect(false)}>Cancel</Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}

function BannerNotice({ banner, onDismiss }: { banner: Banner; onDismiss: () => void }) {
  const { wrap, icon: Icon } = bannerStyles[banner.tone];
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 ${wrap}`} role="status">
      <Icon size={18} className="mt-0.5 shrink-0" />
      <p className="flex-1 text-sm leading-5">{banner.message}</p>
      <button type="button" onClick={onDismiss} className="text-xs font-semibold underline underline-offset-2">Dismiss</button>
    </div>
  );
}

interface ShopifyPanelProps {
  status: ShopifyStatus | null;
  busy: 'connecting' | 'syncing' | 'disconnecting' | null;
  shopInput: string;
  shopInputError: string | null;
  onShopInputChange: (value: string) => void;
  onConnect: () => void;
  onSync: () => void;
  onRequestDisconnect: () => void;
}

/**
 * The one connector with a real backend. Every value shown here comes from GET /shopify/status —
 * the page has no local notion of "connected", so it cannot display a connection that does not
 * exist, or a sync time for a sync that never ran.
 */
function ShopifyPanel({ status, busy, shopInput, shopInputError, onShopInputChange, onConnect, onSync, onRequestDisconnect }: ShopifyPanelProps) {
  if (!status) return null;

  const summary = status.lastSyncSummary;

  return (
    <section id="shopify-panel" className="scroll-mt-6 rounded-xl border border-surface-200 bg-white p-5 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-100 text-surface-700"><Database size={21} /></div>
          <div>
            <h2 className="text-lg font-bold text-surface-950">Shopify</h2>
            <p className="mt-1 max-w-xl text-sm leading-5 text-surface-500">
              Connect your Shopify store to analyze SEO, content, performance, CRO and AI readiness.
            </p>
          </div>
        </div>
        <StatusBadge
          label={
            status.status === 'connected' ? 'Connected'
              : status.status === 'reauthorization_required' ? 'Reauthorization required'
              : status.status === 'error' ? 'Sync failed'
              : 'Not connected'
          }
          tone={status.status === 'connected' ? 'success' : status.status === 'not_connected' ? 'neutral' : 'warning'}
        />
      </div>

      {!status.configured && (
        <p className="mt-5 rounded-lg border border-warning-100 bg-warning-50 px-3 py-2 text-xs leading-5 text-warning-800">
          Shopify is not configured on this server yet. An administrator needs to add the app credentials before stores can be connected.
        </p>
      )}

      {status.status === 'not_connected' ? (
        <div className="mt-6 max-w-lg">
          <label htmlFor="shop-domain" className="text-[10px] font-bold uppercase tracking-[0.14em] text-surface-500">Your Shopify store address</label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              id="shop-domain"
              value={shopInput}
              onChange={(event) => onShopInputChange(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') onConnect(); }}
              placeholder="my-store.myshopify.com"
              disabled={!status.configured || busy === 'connecting'}
              className="h-[38px] min-w-[16rem] flex-1 rounded-lg border border-surface-200 px-3 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:bg-surface-50"
            />
            <Button onClick={onConnect} disabled={!status.configured || busy === 'connecting'}>
              <Link2 size={15} />{busy === 'connecting' ? 'Opening Shopify…' : 'Connect Shopify'}
            </Button>
          </div>
          {shopInputError && <p className="mt-2 text-xs text-critical-600">{shopInputError}</p>}
          {/* The address only tells Shopify which admin to open. Approval happens in Shopify's own
              UI, and only its signed callback creates a connection here. */}
          <p className="mt-3 text-xs leading-5 text-surface-500">
            You'll be taken to Shopify to review the permissions Scorelo requests and approve them. Nothing is connected until you do.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Store" value={status.shopDomain ?? '—'} />
            <Field label="Connected since" value={status.installedAt ? new Date(status.installedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'} />
            <Field label="Last synced" value={status.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never synced'} />
          </div>

          {status.status === 'reauthorization_required' && (
            <p className="rounded-lg border border-warning-100 bg-warning-50 px-3 py-2 text-xs leading-5 text-warning-800">
              Shopify authorization has expired. Reconnect your store to resume audits.
            </p>
          )}
          {status.lastSyncError && (
            <p className="rounded-lg border border-critical-100 bg-critical-50 px-3 py-2 text-xs leading-5 text-critical-800">{status.lastSyncError}</p>
          )}

          {summary ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-surface-500">Data read from your store</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Field label="Products" value={String(summary.products)} />
                <Field label="Collections" value={String(summary.collections)} />
                <Field label="Pages" value={String(summary.pages)} />
                <Field label="Articles" value={String(summary.articles)} />
                <Field label="Policies" value={String(summary.policies)} />
              </div>
              {summary.truncated.length > 0 && (
                <p className="mt-3 text-xs leading-5 text-warning-700">
                  Your crawl scope limit was reached for {summary.truncated.join(', ')} — these counts are partial. Raise the page limit in Settings → Analysis to read more.
                </p>
              )}
              {summary.unavailable.length > 0 && (
                <p className="mt-2 text-xs leading-5 text-surface-500">Could not read: {summary.unavailable.join(', ')}.</p>
              )}
            </div>
          ) : (
            <p className="rounded-lg bg-surface-50 px-3 py-2 text-xs leading-5 text-surface-500">
              No data has been read from this store yet. Run a sync to pull your catalog and content.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={onSync} disabled={busy === 'syncing' || status.status === 'reauthorization_required'}>
              <RefreshCw size={15} className={busy === 'syncing' ? 'animate-spin' : ''} />{busy === 'syncing' ? 'Syncing…' : 'Sync now'}
            </Button>
            {status.storeUrl && (
              <a href={status.storeUrl} target="_blank" rel="noreferrer noopener" className="btn-secondary"><Link2 size={15} />View store</a>
            )}
            <Button variant="danger" onClick={onRequestDisconnect}><Unplug size={15} />Disconnect</Button>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-surface-200 bg-surface-50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-surface-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-surface-900" title={value}>{value}</p>
    </div>
  );
}
