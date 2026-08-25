// ─── Auth token storage ──────────────────────────────────────────────
// The ACCESS token is kept in memory only: it never touches localStorage, so an
// XSS payload cannot read it out of storage after the fact.
//
// The REFRESH token is persisted so a page reload does not sign the customer out.
// localStorage is the pragmatic choice for a token the SPA itself must replay, but
// it is readable by injected script — moving refresh to an httpOnly, SameSite cookie
// is the intended hardening step before public launch (it requires the backend to
// set the cookie, so it is deliberately out of scope for this UI milestone).

const REFRESH_STORAGE_KEY = 'scorelo.refreshToken';

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_STORAGE_KEY);
  } catch {
    // Private browsing / storage disabled — the session simply won't survive reload.
    return null;
  }
}

export function setTokens(tokens: { accessToken: string; refreshToken: string }): void {
  accessToken = tokens.accessToken;
  try {
    localStorage.setItem(REFRESH_STORAGE_KEY, tokens.refreshToken);
  } catch {
    // Non-fatal: the in-memory access token still authenticates this tab.
  }
}

export function setAccessToken(token: string): void {
  accessToken = token;
}

export function clearTokens(): void {
  accessToken = null;
  try {
    localStorage.removeItem(REFRESH_STORAGE_KEY);
  } catch {
    // Nothing to clean up.
  }
}
