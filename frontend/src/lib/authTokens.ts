// ─── Auth token storage ──────────────────────────────────────────────
// The ACCESS token is kept in memory only: it never touches web storage, so an
// XSS payload cannot read it out of storage after the fact.
//
// The REFRESH token is persisted so a page reload does not sign the customer out.
// Web storage is the pragmatic choice for a token the SPA itself must replay, but
// it is readable by injected script — moving refresh to an httpOnly, SameSite cookie
// is the intended hardening step before public launch (it requires the backend to
// set the cookie, so it is deliberately out of scope for this UI milestone).
//
// WHERE the refresh token is persisted is what "Remember me" controls:
//   remembered  -> localStorage,   survives closing the browser
//   not         -> sessionStorage, cleared when the tab is closed
// Both are per-origin and equally readable by script; the difference is lifetime, which is
// exactly what the checkbox promises. Note the server-issued refresh token is valid for 30 days
// either way — unchecking the box ends the session on THIS device sooner, it does not shorten
// the token's own lifetime server-side.

const REFRESH_STORAGE_KEY = 'scorelo.refreshToken';

let accessToken: string | null = null;

/** Ordered by preference: a session-scoped token wins, because choosing "don't remember me"
 * most recently is the more specific instruction. */
function stores(): Storage[] {
  const available: Storage[] = [];
  try {
    available.push(window.sessionStorage);
  } catch {
    // Storage disabled — fall through to whatever else is reachable.
  }
  try {
    available.push(window.localStorage);
  } catch {
    // Same.
  }
  return available;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  for (const store of stores()) {
    try {
      const token = store.getItem(REFRESH_STORAGE_KEY);
      if (token) return token;
    } catch {
      // Private browsing / storage disabled — try the next one.
    }
  }
  return null;
}

/**
 * Persists a token pair.
 *
 * `remember` defaults to true so every existing caller keeps its current behaviour. The token is
 * always removed from the OTHER store first, so switching the preference cannot leave a stale
 * copy behind that outlives the choice the customer just made.
 */
export function setTokens(tokens: { accessToken: string; refreshToken: string }, options: { remember?: boolean } = {}): void {
  const remember = options.remember ?? true;
  accessToken = tokens.accessToken;

  try {
    const target = remember ? window.localStorage : window.sessionStorage;
    const other = remember ? window.sessionStorage : window.localStorage;
    other.removeItem(REFRESH_STORAGE_KEY);
    target.setItem(REFRESH_STORAGE_KEY, tokens.refreshToken);
  } catch {
    // Non-fatal: the in-memory access token still authenticates this tab.
  }
}

export function setAccessToken(token: string): void {
  accessToken = token;
}

/** Rotates the stored refresh token in place, preserving the customer's remember-me choice —
 * a rotation must not silently promote a session-only login to a persistent one. */
export function replaceRefreshToken(refreshToken: string): void {
  for (const store of stores()) {
    try {
      if (store.getItem(REFRESH_STORAGE_KEY) !== null) {
        store.setItem(REFRESH_STORAGE_KEY, refreshToken);
        return;
      }
    } catch {
      // Try the next store.
    }
  }
}

export function clearTokens(): void {
  accessToken = null;
  for (const store of stores()) {
    try {
      store.removeItem(REFRESH_STORAGE_KEY);
    } catch {
      // Nothing to clean up.
    }
  }
}
