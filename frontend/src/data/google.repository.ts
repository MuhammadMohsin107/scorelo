import { api } from '../lib/api';

/**
 * ─── Google Search Console ───────────────────────────────────────────
 *
 * Every value here comes from the real Search Console API through Scorelo's backend. There is no
 * sample property, no placeholder metric and no fallback row: a store with no connection reports
 * `connected: false`, and a property with no traffic reports zeroes that are genuinely zero.
 *
 * No token ever reaches this client. The OAuth exchange happens entirely server-side; the browser
 * only ever visits Google's consent screen and comes back to a redirect.
 */

export interface SearchConsoleStatus {
  /** Whether the SERVER has Google OAuth credentials at all. False = hide Connect entirely. */
  configured: boolean;
  /** Whether THIS store has a live connection. */
  connected: boolean;
  /** The Google account that granted access, so the merchant can see which one is in use. */
  googleEmail: string | null;
  /** The property this store reports on. Null = connected but nothing chosen yet. */
  siteUrl: string | null;
  lastSyncedAt: string | null;
  /** Set when Google refused the last read — usually revoked access or a lost property. */
  lastError: string | null;
}

export interface SearchConsoleSite {
  siteUrl: string;
  permissionLevel: string;
}

export interface SearchConsoleRow {
  key: string;
  clicks: number;
  impressions: number;
  /** A fraction as Google returns it: 0.0432 = 4.32%. */
  ctr: number;
  position: number;
}

export interface SearchConsolePerformance {
  siteUrl: string;
  /** The dates actually queried. Search Console lags ~3 days, so this is never "today". */
  startDate: string;
  endDate: string;
  totals: { clicks: number; impressions: number; ctr: number; position: number };
  topQueries: SearchConsoleRow[];
  topPages: SearchConsoleRow[];
}

export const fetchGoogleStatus = () => api.get<SearchConsoleStatus>('/google/status');

/**
 * Starts the connect flow.
 *
 * The URL is built server-side because it carries a signed `state` that identifies the user and
 * store — Google's callback has no session of its own, so that state is the only thing that says
 * whose connection is returning. Navigating away is deliberate: nothing is connected until Google
 * redirects back and the server has exchanged the code.
 */
export async function startGoogleConnect(): Promise<void> {
  const { url } = await api.get<{ url: string }>('/google/auth-url');
  window.location.href = url;
}

/** The properties the connected account can read, for the merchant to choose between. */
export const fetchGoogleSites = () => api.get<SearchConsoleSite[]>('/google/sites');

/** Records which property this store reports on. The server verifies it against the account. */
export const selectGoogleSite = (siteUrl: string) =>
  api.post<SearchConsoleStatus>('/google/site', { siteUrl });

export const fetchGooglePerformance = (days = 28) =>
  api.get<SearchConsolePerformance>(`/google/performance?days=${days}`);

export const disconnectGoogle = () => api.post<SearchConsoleStatus>('/google/disconnect', {});

/**
 * Turns the `?google=` parameter on the post-OAuth redirect into something worth reading.
 *
 * The backend sends a CODE rather than a message, because that redirect lands in browser history
 * — Google's own error text can name the account and the property. The wording lives here.
 */
export function describeGoogleOutcome(
  outcome: string | null,
  reason: string | null,
): { tone: 'success' | 'error' | 'info'; message: string } | null {
  if (outcome === 'connected') {
    return {
      tone: 'success',
      message: 'Google Search Console connected. Choose which property this store reports on.',
    };
  }
  if (outcome !== 'failed') return null;

  const message = (() => {
    switch (reason) {
      case 'GOOGLE_ACCESS_DENIED':
        return 'Google access was not granted. Nothing was connected.';
      case 'GOOGLE_NO_REFRESH_TOKEN':
        // The one failure the merchant must act on outside Scorelo, so it says exactly where to go.
        return 'Google did not return a renewable connection. Remove Scorelo at myaccount.google.com/permissions, then connect again.';
      case 'GOOGLE_STATE_INVALID':
        return 'That connection link expired. Please try connecting again.';
      case 'GOOGLE_NOT_CONFIGURED':
        return 'Google Search Console is not configured on this server yet.';
      default:
        return 'Google Search Console could not be connected. Please try again.';
    }
  })();

  return { tone: 'error', message };
}
