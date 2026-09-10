import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, BarChart3, Loader2 } from 'lucide-react';
import {
  fetchAnalyticsPerformance,
  fetchAnalyticsProperties,
  fetchAnalyticsStatus,
  selectAnalyticsProperty,
  type AnalyticsPerformance,
  type AnalyticsProperty,
  type AnalyticsStatus,
} from '../../data/analytics.repository';
import { startGoogleConnect } from '../../data/google.repository';
import { ApiError } from '../../lib/api';
import { Button } from '../workflows/WorkflowPrimitives';

/**
 * ─── Google Analytics 4 connector ────────────────────────────────────
 *
 * Every value shown here is read from the real GA4 API in the request that renders it. There is no
 * sample property, no placeholder metric, and nothing is displayed for a store that has not
 * connected — the card says so instead.
 *
 * FIVE STATES, one more than the Search Console card, because GA4 rides on a connection that may
 * predate it and each state needs something different from the merchant:
 *
 *   not configured          The SERVER has no Google OAuth credentials. An operator's problem.
 *   not connected           No Google connection at all. Offer the same Connect as Search Console.
 *   scope missing           Connected, but the grant was made before Analytics was requested.
 *                           A working connection that cannot read GA4 — asks for a reconnect
 *                           rather than a button that would 403 at Google.
 *   connected, no property  Authorised, but which property? Choosing automatically would report
 *                           another company's traffic as this store's.
 *   connected + property    Real numbers.
 */

/** GA4 finalises data on a delay, so the reported range never ends today. */
const REPORT_DAYS = 28;

function formatPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

/**
 * Why the status read failed, in words that point at the fix. Same reasoning as the Search Console
 * card: one generic line cannot cover a stopped API, an old build and an expired session.
 */
function describeLoadFailure(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Could not reach the Scorelo API. Check that the backend is running.';
  }
  if (error.status === 404) {
    return error.code === 'STORE_NOT_FOUND'
      ? 'This account has no store yet. Create or connect a store first.'
      : 'This server has no Google Analytics endpoint. The API is running an older build — redeploy and restart it.';
  }
  if (error.status === 401) return 'Your session has expired. Sign in again, then reopen this page.';
  return error.status >= 500
    ? `The server could not read the connection state (HTTP ${error.status}). ${error.message}`
    : error.message;
}

export default function GoogleAnalyticsCard() {
  const [status, setStatus] = useState<AnalyticsStatus | null>(null);
  const [properties, setProperties] = useState<AnalyticsProperty[]>([]);
  const [performance, setPerformance] = useState<AnalyticsPerformance | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    try {
      setState('loading');
      setLoadError('');
      const next = await fetchAnalyticsStatus();
      setStatus(next);

      // Only asked for once there is a usable grant to ask with. Both calls reach Google, so a
      // store that has not connected — or whose grant lacks the scope — must not trigger them.
      const usable = next.connected && next.scopeGranted;
      if (usable && !next.propertyId) setProperties(await fetchAnalyticsProperties());
      if (usable && next.propertyId) setPerformance(await fetchAnalyticsPerformance(REPORT_DAYS));

      setState('ready');
    } catch (err) {
      setLoadError(describeLoadFailure(err));
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
      // The SAME flow Search Console uses. Reconnecting an existing grant is how the Analytics
      // scope gets added to it — Google issues scopes only on fresh consent.
      await startGoogleConnect();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 503
          ? 'Google is not configured on this server yet.'
          : 'We could not start the Google connection. Please try again.',
      );
      setBusy(false);
    }
  }

  async function handleSelectProperty(propertyId: string) {
    setBusy(true);
    setError('');
    try {
      setStatus(await selectAnalyticsProperty(propertyId));
      setPerformance(await fetchAnalyticsPerformance(REPORT_DAYS));
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

  if (state === 'loading' && !status) {
    return (
      <article className="rounded-lg border border-surface-200 bg-surface-0 p-3">
        <div className="flex items-center gap-2 text-[12px] text-surface-500">
          <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />
          Checking Google Analytics…
        </div>
      </article>
    );
  }

  const usable = Boolean(status?.connected && status.scopeGranted);

  return (
    <article className="rounded-lg border border-surface-200 bg-surface-0 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 gap-2.5">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-surface-100 text-surface-700">
            <BarChart3 size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[12.5px] font-bold text-surface-950">Google Analytics</h3>
            <p className="mt-0.5 text-[11.5px] leading-[1.4] text-surface-500">
              What happened after the click — which landing pages held attention, where visits came
              from, and which of them converted.
            </p>
          </div>
        </div>

        {usable
          ? <span className="rounded-full bg-success-50 px-2 py-0.5 text-[10.5px] font-semibold text-success-700">Connected</span>
          : <span className="rounded-full bg-surface-100 px-2 py-0.5 text-[10.5px] font-semibold text-surface-600">Not connected</span>}
      </div>

      {state === 'error' && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 rounded-md border border-critical-200 bg-critical-50 px-2.5 py-2 text-[11.5px] leading-[1.4] text-critical-800">
          <AlertCircle size={13} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>
            {loadError}{' '}
            <button type="button" onClick={() => void load()} className="cursor-pointer font-semibold underline underline-offset-2">Retry</button>
          </span>
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 rounded-md border border-critical-200 bg-critical-50 px-2.5 py-2 text-[11.5px] leading-[1.4] text-critical-800">
          <AlertCircle size={13} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {/* ── Not configured: an operator problem, not a merchant one ─── */}
      {status && !status.configured && (
        <p className="mt-2 rounded-md bg-surface-50 px-2.5 py-2 text-[11.5px] leading-[1.4] text-surface-600">
          Not available on this server yet — Google OAuth credentials have not been configured.
        </p>
      )}

      {/* ── Configured, no Google connection at all ───────────────── */}
      {status?.configured && !status.connected && (
        <div className="mt-2.5 border-t border-surface-100 pt-2.5">
          <p className="text-[11.5px] leading-[1.4] text-surface-500">
            Scorelo requests read-only access. It can read your Analytics reports and cannot change
            anything in Google Analytics.
          </p>
          <div className="mt-2">
            <Button onClick={() => void handleConnect()} disabled={busy}>
              {busy ? 'Opening Google…' : 'Connect Google'}
            </Button>
          </div>
        </div>
      )}

      {/* ── Connected, but the grant predates Analytics support ───── */}
      {status?.connected && !status.scopeGranted && (
        <div className="mt-2.5 border-t border-surface-100 pt-2.5">
          <p className="rounded-md border border-warning-100 bg-warning-50 px-2.5 py-2 text-[11.5px] leading-[1.4] text-warning-800">
            {/* Not an error. The connection works — it just was not granted Analytics access, and
                Google only issues scopes on fresh consent, so the fix is a reconnect. */}
            This Google connection was made before Analytics access was added. Reconnect to grant
            it. Your Search Console connection is unaffected.
          </p>
          <div className="mt-2">
            <Button onClick={() => void handleConnect()} disabled={busy}>
              {busy ? 'Opening Google…' : 'Reconnect Google'}
            </Button>
          </div>
        </div>
      )}

      {/* ── Connected, no property chosen ─────────────────────────── */}
      {usable && !status?.propertyId && (
        <div className="mt-2.5 border-t border-surface-100 pt-2.5">
          <p className="text-[12px] font-semibold text-surface-800">Choose the property for this store</p>
          <p className="mt-0.5 text-[11.5px] leading-[1.4] text-surface-500">
            {/* Never chosen automatically: an agency account routinely has dozens, and a guess
                would report another client's traffic as this store's. */}
            Connected as {status?.googleEmail ?? 'your Google account'}. Pick which GA4 property this
            store reports on.
          </p>

          {properties.length === 0 ? (
            <p className="mt-2 text-[11.5px] leading-[1.4] text-surface-500">
              This Google account can read no GA4 properties. Create one in Google Analytics, or ask
              the property owner for at least Viewer access, then reload this page.
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {properties.map((property) => (
                <li key={property.propertyId}>
                  <button
                    type="button"
                    onClick={() => void handleSelectProperty(property.propertyId)}
                    disabled={busy}
                    className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-surface-200 px-2.5 py-1.5 text-left transition-colors hover:border-brand-200 hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="min-w-0 truncate text-[11.5px] text-surface-800">
                      {property.displayName}
                      <span className="ml-1.5 text-surface-500">· {property.account}</span>
                    </span>
                    <span className="flex-shrink-0 font-mono text-[10.5px] text-surface-500">{property.propertyId}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Connected with real data ──────────────────────────────── */}
      {usable && status?.propertyId && (
        <div className="mt-2.5 border-t border-surface-100 pt-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="min-w-0 truncate font-mono text-[11.5px] text-surface-700">properties/{status.propertyId}</p>
            {performance && (
              // The dates Google actually answered for. GA4 lags a day or two, so a range ending
              // today would show a partial tail that reads as a collapse in traffic.
              <p className="text-[10.5px] text-surface-500">{performance.startDate} to {performance.endDate}</p>
            )}
          </div>

          {performance ? (
            <>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: 'Sessions', value: performance.totals.sessions.toLocaleString() },
                  { label: 'Engaged', value: performance.totals.engagedSessions.toLocaleString() },
                  { label: 'Engagement', value: formatPercent(performance.totals.engagementRate) },
                  { label: 'Conversions', value: performance.totals.conversions.toLocaleString() },
                ].map((tile) => (
                  <div key={tile.label} className="rounded-md bg-surface-50 px-2.5 py-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-surface-500">{tile.label}</p>
                    <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-surface-900">{tile.value}</p>
                  </div>
                ))}
              </div>

              {performance.totals.sessions === 0 && (
                // A real zero, said plainly — and for GA4 the likeliest cause is worth naming,
                // because a property with no tag on the storefront stays empty forever and looks
                // exactly like a broken connection.
                <p className="mt-2 rounded-md bg-surface-50 px-2.5 py-2 text-[11.5px] leading-[1.4] text-surface-600">
                  Google recorded no sessions for this property in this period. That is the real
                  figure, not a connection problem. A new property stays empty until its measurement
                  tag is installed on the storefront, and then for another 24-48 hours.
                </p>
              )}

              {performance.topLandingPages.length > 0 && (
                <div className="mt-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-surface-500">Top landing pages</p>
                  <ul className="mt-1 divide-y divide-surface-100">
                    {performance.topLandingPages.slice(0, 5).map((row) => (
                      <li key={row.key} className="flex items-center justify-between gap-2 py-1">
                        <span className="min-w-0 truncate text-[12px] text-surface-800">{row.key || '(not set)'}</span>
                        <span className="flex-shrink-0 text-[11px] tabular-nums text-surface-500">
                          {row.sessions.toLocaleString()} sessions
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {performance.topChannels.length > 0 && (
                <div className="mt-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-surface-500">Channels</p>
                  <ul className="mt-1 divide-y divide-surface-100">
                    {performance.topChannels.slice(0, 5).map((row) => (
                      <li key={row.key} className="flex items-center justify-between gap-2 py-1">
                        <span className="min-w-0 truncate text-[12px] text-surface-800">{row.key || '(not set)'}</span>
                        <span className="flex-shrink-0 text-[11px] tabular-nums text-surface-500">
                          {row.sessions.toLocaleString()} sessions · {row.conversions.toLocaleString()} conv
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="mt-2 text-[11.5px] text-surface-500">Loading Analytics performance…</p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-surface-100 pt-2">
            <Button variant="secondary" onClick={() => void load()} disabled={busy}>Refresh</Button>
          </div>
        </div>
      )}

      {/* Google refused the last read — revoked access, or the property is gone. Surfaced because
          the alternative is a card that says "Connected" beside no data and explains nothing. */}
      {status?.lastError && (
        <p className="mt-2 rounded-md border border-warning-100 bg-warning-50 px-2.5 py-2 text-[11.5px] leading-[1.4] text-warning-800">
          {status.lastError}
        </p>
      )}
    </article>
  );
}
