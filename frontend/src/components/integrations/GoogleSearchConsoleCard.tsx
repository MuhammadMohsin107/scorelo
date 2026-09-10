import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, ExternalLink, Loader2, Search } from 'lucide-react';
import {
  disconnectGoogle,
  fetchGooglePerformance,
  fetchGoogleSites,
  fetchGoogleStatus,
  selectGoogleSite,
  startGoogleConnect,
  type SearchConsolePerformance,
  type SearchConsoleSite,
  type SearchConsoleStatus,
} from '../../data/google.repository';
import { ApiError } from '../../lib/api';
import { Button } from '../workflows/WorkflowPrimitives';

/**
 * ─── Google Search Console connector ─────────────────────────────────
 *
 * Every value shown here is read from the real Search Console API in the request that renders it.
 * There is no sample property, no placeholder metric, and nothing is displayed for a store that
 * has not connected — the card says so instead.
 *
 * THREE STATES, because each needs something different from the merchant and collapsing them would
 * leave someone stuck:
 *
 *   not configured          The SERVER has no Google OAuth credentials. Nothing the merchant can
 *                           do, so no Connect button is offered — an operator has to add them.
 *   connected, no property  Authorised, but the account has several verified sites and none is
 *                           chosen. Picking one automatically would silently report another
 *                           domain's traffic as this store's.
 *   connected + property    Real numbers.
 */

/** Google finalises Search Console data on a delay, so the reported range never ends today. */
const REPORT_DAYS = 28;

function formatPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(2)}%`;
}

function formatPosition(position: number): string {
  return position > 0 ? position.toFixed(1) : '—';
}

export default function GoogleSearchConsoleCard() {
  const [status, setStatus] = useState<SearchConsoleStatus | null>(null);
  const [sites, setSites] = useState<SearchConsoleSite[]>([]);
  const [performance, setPerformance] = useState<SearchConsolePerformance | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setState('loading');
      const next = await fetchGoogleStatus();
      setStatus(next);

      // Only asked for once there is a connection to ask with. Both calls reach Google, so a store
      // that has not connected must not trigger them at all.
      if (next.connected && !next.siteUrl) setSites(await fetchGoogleSites());
      if (next.connected && next.siteUrl) setPerformance(await fetchGooglePerformance(REPORT_DAYS));

      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleConnect() {
    setBusy(true);
    setError('');
    try {
      // Navigates away to Google's consent screen. Nothing is connected until Google redirects back
      // and the SERVER has exchanged the code — this client never sees a token.
      await startGoogleConnect();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 503
          ? 'Google Search Console is not configured on this server yet.'
          : 'We could not start the Google connection. Please try again.',
      );
      setBusy(false);
    }
  }

  async function handleSelectSite(siteUrl: string) {
    setBusy(true);
    setError('');
    try {
      setStatus(await selectGoogleSite(siteUrl));
      setPerformance(await fetchGooglePerformance(REPORT_DAYS));
    } catch (err) {
      setError(
        err instanceof ApiError && [400, 401, 403, 409].includes(err.status)
          ? err.message
          : 'We could not read that property. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    setBusy(true);
    setError('');
    try {
      setStatus(await disconnectGoogle());
      setSites([]);
      setPerformance(null);
    } catch {
      setError('We could not disconnect right now. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading' && !status) {
    return (
      <article className="rounded-lg border border-surface-200 bg-surface-0 p-3">
        <div className="flex items-center gap-2 text-[12px] text-surface-500">
          <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />
          Checking Google Search Console…
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-lg border border-surface-200 bg-surface-0 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 gap-2.5">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-surface-100 text-surface-700">
            <Search size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[12.5px] font-bold text-surface-950">Google Search Console</h3>
            <p className="mt-0.5 text-[11.5px] leading-[1.4] text-surface-500">
              The only source for what actually happened in search — which queries brought people in,
              how often pages were shown, and where they ranked.
            </p>
          </div>
        </div>

        {status?.connected
          ? <span className="rounded-full bg-success-50 px-2 py-0.5 text-[10.5px] font-semibold text-success-700">Connected</span>
          : <span className="rounded-full bg-surface-100 px-2 py-0.5 text-[10.5px] font-semibold text-surface-600">Not connected</span>}
      </div>

      {state === 'error' && (
        <p className="mt-2 text-[11.5px] leading-[1.4] text-surface-500">
          Could not read the connection state. <button type="button" onClick={() => void load()} className="cursor-pointer font-semibold text-brand-600 underline underline-offset-2">Retry</button>
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 rounded-md border border-critical-200 bg-critical-50 px-2.5 py-2 text-[11.5px] leading-[1.4] text-critical-800">
          <AlertCircle size={13} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {/* Google refused the last read — revoked access, or the property is gone. Surfaced because
          the alternative is a card that says "Connected" beside no data and explains nothing. */}
      {status?.lastError && (
        <p className="mt-2 rounded-md border border-warning-100 bg-warning-50 px-2.5 py-2 text-[11.5px] leading-[1.4] text-warning-800">
          {status.lastError}
        </p>
      )}

      {/* ── Not configured: an operator problem, not a merchant one ─── */}
      {status && !status.configured && (
        <p className="mt-2 rounded-md bg-surface-50 px-2.5 py-2 text-[11.5px] leading-[1.4] text-surface-600">
          Not available on this server yet — Google OAuth credentials have not been configured. No
          Connect button is shown because there is nothing behind it.
        </p>
      )}

      {/* ── Configured, not connected ─────────────────────────────── */}
      {status?.configured && !status.connected && (
        <div className="mt-2.5 border-t border-surface-100 pt-2.5">
          <p className="text-[11.5px] leading-[1.4] text-surface-500">
            Scorelo requests read-only access. It can read your search performance and cannot change
            anything in Search Console.
          </p>
          <div className="mt-2">
            <Button onClick={() => void handleConnect()} disabled={busy}>
              {busy ? 'Opening Google…' : 'Connect Google Search Console'}
            </Button>
          </div>
        </div>
      )}

      {/* ── Connected, no property chosen ─────────────────────────── */}
      {status?.connected && !status.siteUrl && (
        <div className="mt-2.5 border-t border-surface-100 pt-2.5">
          <p className="text-[12px] font-semibold text-surface-800">Choose the property for this store</p>
          <p className="mt-0.5 text-[11.5px] leading-[1.4] text-surface-500">
            {/* Never chosen automatically: an account with several verified sites would otherwise
                have another domain's traffic reported as this store's. */}
            Connected as {status.googleEmail ?? 'your Google account'}. Pick which verified property
            this store reports on.
          </p>

          {sites.length === 0 ? (
            <p className="mt-2 text-[11.5px] leading-[1.4] text-surface-500">
              This Google account has no verified Search Console properties. Verify your domain in
              Search Console first, then reload this page.
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {sites.map((site) => (
                <li key={site.siteUrl}>
                  <button
                    type="button"
                    onClick={() => void handleSelectSite(site.siteUrl)}
                    disabled={busy}
                    className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-surface-200 px-2.5 py-1.5 text-left transition-colors hover:border-brand-200 hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="min-w-0 truncate font-mono text-[11.5px] text-surface-800">{site.siteUrl}</span>
                    <span className="flex-shrink-0 text-[10.5px] text-surface-500">{site.permissionLevel}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Connected with real data ──────────────────────────────── */}
      {status?.connected && status.siteUrl && (
        <div className="mt-2.5 border-t border-surface-100 pt-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="min-w-0 truncate font-mono text-[11.5px] text-surface-700">{status.siteUrl}</p>
            {performance && (
              // The dates Google actually answered for. Search Console lags about three days, so a
              // range ending today would show an empty tail that reads as a collapse in traffic.
              <p className="text-[10.5px] text-surface-500">{performance.startDate} to {performance.endDate}</p>
            )}
          </div>

          {performance ? (
            <>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: 'Clicks', value: performance.totals.clicks.toLocaleString() },
                  { label: 'Impressions', value: performance.totals.impressions.toLocaleString() },
                  { label: 'CTR', value: formatPercent(performance.totals.ctr) },
                  { label: 'Avg position', value: formatPosition(performance.totals.position) },
                ].map((tile) => (
                  <div key={tile.label} className="rounded-md bg-surface-50 px-2.5 py-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-surface-500">{tile.label}</p>
                    <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-surface-900">{tile.value}</p>
                  </div>
                ))}
              </div>

              {performance.totals.impressions === 0 && (
                // A real zero, said plainly. Not an error, and not dressed up as one.
                <p className="mt-2 text-[11.5px] leading-[1.4] text-surface-500">
                  Google recorded no impressions for this property in this period. That is the real
                  figure, not a connection problem.
                </p>
              )}

              {performance.topQueries.length > 0 && (
                <div className="mt-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-surface-500">Top queries</p>
                  <ul className="mt-1 divide-y divide-surface-100">
                    {performance.topQueries.slice(0, 5).map((row) => (
                      <li key={row.key} className="flex items-center justify-between gap-2 py-1">
                        <span className="min-w-0 truncate text-[12px] text-surface-800">{row.key}</span>
                        <span className="flex-shrink-0 text-[11px] tabular-nums text-surface-500">
                          {row.clicks.toLocaleString()} clicks · pos {formatPosition(row.position)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="mt-2 text-[11.5px] text-surface-500">Loading search performance…</p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-surface-100 pt-2">
            <Button variant="secondary" onClick={() => void load()} disabled={busy}>Refresh</Button>
            <Button variant="danger" onClick={() => void handleDisconnect()} disabled={busy}>
              {busy ? 'Working…' : 'Disconnect'}
            </Button>
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-600 underline-offset-2 hover:underline"
            >
              {/* Disconnecting destroys Scorelo's copy of the tokens. Revoking the grant itself is
                  something only the merchant can do, and only at Google — so the link is here. */}
              Revoke at Google <ExternalLink size={11} aria-hidden="true" />
            </a>
          </div>
        </div>
      )}

      {status?.connected && status.lastSyncedAt && (
        <p className="mt-2 flex items-center gap-1 text-[10.5px] text-surface-400">
          <Check size={11} aria-hidden="true" />
          Last read {new Date(status.lastSyncedAt).toLocaleString()}
        </p>
      )}
    </article>
  );
}
