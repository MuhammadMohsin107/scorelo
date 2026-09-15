import { api, ApiError } from '../lib/api';
import { clearTokens, getRefreshToken, setTokens } from '../lib/authTokens';
import type { UserRow } from './api.types';

interface AuthPayload {
  user: UserRow;
  accessToken: string;
  refreshToken: string;
}

/** Client-only session preference. It is deliberately NOT part of the request body: the backend
 * schemas are `.strict()`, so an unexpected key is rejected with a 400. */
interface SessionPreference {
  /** true -> the session survives closing the browser; false -> it ends with the tab. */
  rememberMe?: boolean;
}

export interface LoginInput extends SessionPreference {
  email: string;
  password: string;
}

// ─── Sign in with Shopify ────────────────────────────────────────────
//
// New merchants get their account from Shopify rather than from a form: they approve Scorelo on
// Shopify's own screen, and the backend creates the account from the shop's records. Existing
// email-and-password accounts keep signing in the way they always have.
//
// THE NONCE is what ties the end of a sign-in to the browser that started it. It is generated here,
// kept in sessionStorage (which survives the redirect to Shopify and back in the same tab), and only
// its hash travels through Shopify. Without it, a grant copied out of one browser — or planted into
// someone else's — could start a session.

const SHOPIFY_NONCE_KEY = 'scorelo.shopifySignInNonce';

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Mints and stores a fresh nonce. Throws when storage is unavailable, because a sign-in that
 * cannot remember its nonce can never be completed and should not be started. */
function beginNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const nonce = base64Url(bytes);
  try {
    window.sessionStorage.setItem(SHOPIFY_NONCE_KEY, nonce);
  } catch {
    throw new ApiError('Your browser is blocking site storage, which Shopify sign-in needs. Allow it for this site and try again.', 0, 'STORAGE_UNAVAILABLE');
  }
  return nonce;
}

/** Reads the nonce and removes it — a nonce is good for one completion attempt only. */
function takeNonce(): string | null {
  try {
    const nonce = window.sessionStorage.getItem(SHOPIFY_NONCE_KEY);
    window.sessionStorage.removeItem(SHOPIFY_NONCE_KEY);
    return nonce;
  } catch {
    return null;
  }
}

/** Sends the merchant to Shopify for the store address they typed. */
export async function startShopifySignIn(shop: string): Promise<void> {
  const nonce = beginNonce();
  const { url } = await api.post<{ url: string }>('/auth/shopify/start', { shop, nonce }, { skipAuth: true });
  window.location.assign(url);
}

/** Sends the merchant to Shopify for the store Shopify itself named when it opened Scorelo. */
export async function startShopifyLaunch(launch: Record<string, string>): Promise<void> {
  const nonce = beginNonce();
  const { url } = await api.post<{ url: string }>('/auth/shopify/launch', { launch, nonce }, { skipAuth: true });
  window.location.assign(url);
}

/**
 * Redeems the grant Shopify sign-in returned with, in this browser.
 *
 * Returns the same two outcomes as a password sign-in, and stores tokens only when the server
 * actually issued them.
 */
export async function completeShopifySignIn(grant: string): Promise<LoginResult> {
  const nonce = takeNonce();
  if (!nonce) {
    throw new ApiError('This Shopify sign-in has expired. Please start again.', 401, 'SHOPIFY_LOGIN_INVALID');
  }

  const payload = await api.post<LoginPayload>('/auth/shopify/complete', { grant, nonce }, { skipAuth: true });
  if (payload.twoFactorRequired) return { status: 'two-factor', ticket: payload.ticket };

  setTokens({ accessToken: payload.accessToken, refreshToken: payload.refreshToken });
  return { status: 'authenticated', user: payload.user };
}

/**
 * The signed query Shopify appends when it opens Scorelo (App Store install, or the admin's Apps
 * list), or null when this is an ordinary visit. Every key is kept exactly as sent — the backend
 * verifies an HMAC over all of them.
 */
export function readShopifyLaunch(search: string): Record<string, string> | null {
  const params = new URLSearchParams(search);
  if (!params.get('shop') || !params.get('hmac')) return null;
  const launch: Record<string, string> = {};
  params.forEach((value, key) => {
    launch[key] = value;
  });
  return launch;
}

/** The grant a completed Shopify sign-in returns with, carried in the URL fragment. */
export function readShopifyGrant(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, '')).get('shopify_grant');
}

/** Merchant-facing wording for a Shopify sign-in failure — a redirect `reason` or an API error code.
 * Raw codes are never shown. */
export function describeShopifySignInFailure(code: string | null | undefined): string {
  switch (code) {
    case 'access_denied':
      return 'Shopify sign-in was cancelled. Nothing was connected.';
    case 'SHOPIFY_LOGIN_EMAIL_TAKEN':
      return 'A Scorelo account already uses this store’s email address. Sign in with your email and password, then connect the store from Integrations.';
    case 'SHOPIFY_LOGIN_NO_EMAIL':
      return 'Shopify did not share an email address for this store, so we could not create your account.';
    case 'SHOPIFY_LOGIN_INVALID':
    case 'SHOPIFY_STATE_INVALID':
      return 'This Shopify sign-in has expired. Please start again.';
    case 'SHOPIFY_HMAC_INVALID':
    case 'SHOPIFY_STATE_MISMATCH':
    case 'SHOPIFY_LAUNCH_INVALID':
      return 'Shopify sign-in failed its security check. Please try again.';
    case 'SHOPIFY_NOT_CONFIGURED':
      return 'Shopify sign-in is not configured on this server yet. Contact your administrator.';
    case 'STORAGE_UNAVAILABLE':
      return 'Your browser is blocking site storage, which Shopify sign-in needs. Allow it for this site and try again.';
    default:
      return 'We could not sign you in with Shopify. Please try again.';
  }
}

// ─── Email verification ──────────────────────────────────────────────

/**
 * Confirms an address with the emailed code.
 *
 * Returns no session on purpose — the backend issues none. Proving control of an inbox is not the
 * same as presenting the account password, so the customer signs in normally afterwards.
 */
export async function verifyEmail(email: string, code: string): Promise<string> {
  const payload = await api.post<{ message: string }>('/auth/verify-email', { email, code }, { skipAuth: true });
  return payload.message;
}

/**
 * Asks for a replacement code, invalidating the previous one.
 *
 * Resolves identically whether or not the address has an unverified account — the backend answers
 * 202 with one fixed message either way, so there is nothing here to branch on. Any difference
 * would tell a stranger which addresses are registered.
 */
export async function resendVerification(email: string): Promise<string> {
  const payload = await api.post<{ message: string }>('/auth/resend-verification', { email }, { skipAuth: true });
  return payload.message;
}

/** The two shapes /auth/login can return, discriminated by `twoFactorRequired`. */
type LoginPayload =
  | { twoFactorRequired: true; ticket: string }
  | ({ twoFactorRequired: false } & AuthPayload);

export type LoginResult =
  | { status: 'authenticated'; user: UserRow }
  /**
   * The password was right, but the sign-in is not finished. NO session exists yet, and no code has
   * been sent — the next step is confirming the address it should go to.
   */
  | { status: 'two-factor'; ticket: string };

/**
 * Signs in, or reports that a second factor is still required.
 *
 * WHETHER A SESSION STARTS IS THE SERVER'S DECISION. Tokens are stored only when the response
 * actually carries them — never on the strength of a local flag — so this client cannot
 * manufacture a session the backend withheld.
 *
 * When 2FA is required the reply carries a ticket and nothing else: no user object, no tokens.
 * The ticket is held in component state for the length of the flow and never written to storage;
 * a refresh loses it and the customer signs in again, which is the correct outcome for a
 * half-finished authentication.
 */
export async function login({ rememberMe, ...credentials }: LoginInput): Promise<LoginResult> {
  const payload = await api.post<LoginPayload>('/auth/login', credentials, { skipAuth: true });

  if (payload.twoFactorRequired) {
    return { status: 'two-factor', ticket: payload.ticket };
  }

  setTokens({ accessToken: payload.accessToken, refreshToken: payload.refreshToken }, { remember: rememberMe });
  return { status: 'authenticated', user: payload.user };
}

/**
 * Step 2a: confirms which address the sign-in code should go to, and sends it.
 *
 * THE ADDRESS IS CHECKED SERVER-SIDE against the account's own registered address, and the mail is
 * addressed from the database row rather than from this request. A caller cannot point the code at
 * an inbox they do not own — if they could, anyone holding a stolen password could have the second
 * factor delivered to themselves.
 *
 * `codeSent: false` is honest rather than a failure: the sign-in is genuinely paused and the mail
 * did not get out, so the UI offers a resend instead of claiming a delivery that never happened.
 */
export async function sendTwoFactorCode(ticket: string, email: string): Promise<boolean> {
  const payload = await api.post<{ codeSent: boolean }>('/auth/login/2fa/send', { ticket, email }, { skipAuth: true });
  return payload.codeSent;
}

/** What a completed 2FA sign-in returns. */
export interface TwoFactorLoginResult {
  user: UserRow;
  /**
   * How many recovery codes are left — present ONLY when this sign-in spent one, so the UI can warn
   * the customer to generate a new set. Null on a normal emailed-code sign-in.
   */
  recoveryCodesRemaining: number | null;
}

/**
 * Completes a sign-in that paused for a second factor, with either the emailed code or a recovery
 * code.
 *
 * Sends the ticket and exactly one credential — never the password again. The ticket already proves
 * the password step succeeded, so re-transmitting the credential would hand over more than the step
 * needs. Sending both would be ambiguous and the server rejects it.
 */
export async function completeTwoFactorLogin(
  ticket: string,
  credential: { code: string } | { recoveryCode: string },
  rememberMe?: boolean,
): Promise<TwoFactorLoginResult> {
  const payload = await api.post<AuthPayload & { recoveryCodesRemaining: number | null }>(
    '/auth/login/2fa',
    { ticket, ...credential },
    { skipAuth: true },
  );
  setTokens({ accessToken: payload.accessToken, refreshToken: payload.refreshToken }, { remember: rememberMe });
  return { user: payload.user, recoveryCodesRemaining: payload.recoveryCodesRemaining };
}

/**
 * Asks for a replacement sign-in code.
 *
 * Resolves identically whether the ticket was valid or not — the backend answers 202 with one
 * fixed message either way, so there is nothing here to branch on.
 */
export async function resendTwoFactorCode(ticket: string): Promise<string> {
  const payload = await api.post<{ message: string }>('/auth/login/2fa/resend', { ticket }, { skipAuth: true });
  return payload.message;
}

/** Clears the session locally even if the server call fails — the customer asked to sign out,
 * so the local session must not survive a network error. */
export async function logout(): Promise<void> {
  try {
    const refreshToken = getRefreshToken();
    // The refresh token identifies WHICH session is ending, so logging out on a phone does not
    // sign the customer out of their laptop. It travels in the POST body — the same path
    // /auth/refresh already uses — and the server hashes it to find the row. Without it the
    // server revokes every session, which is the safe direction to fail, never the other way.
    if (refreshToken) await api.post('/auth/logout', { refreshToken });
  } catch {
    // Intentionally ignored — local sign-out below is what the customer sees.
  } finally {
    clearTokens();
  }
}

/**
 * Resolves the signed-in customer, or null when there is no valid session.
 *
 * Works in both modes: with a real token it authenticates normally, and while the backend
 * runs with MOCK_AUTH (development only) it resolves the mock user — which is what keeps
 * local development working exactly as before without a login step.
 */
export async function fetchSession(): Promise<UserRow | null> {
  try {
    return await api.get<UserRow>('/users/me');
  } catch {
    return null;
  }
}

// ─── Password reset ──────────────────────────────────────────────────

/**
 * Asks for a reset link.
 *
 * Resolves the same way whether or not the address has an account — the backend answers 202 with
 * one fixed message either way, so the UI has nothing to branch on. That is deliberate: any
 * difference here would tell a stranger which addresses are registered.
 */
export async function requestPasswordReset(email: string): Promise<string> {
  const payload = await api.post<{ message: string }>('/auth/forgot-password', { email }, { skipAuth: true });
  return payload.message;
}

/**
 * Step two: exchanges the emailed code for the credential that can actually change the password.
 *
 * The code only proves the customer read the inbox. What comes back is a high-entropy, single-use
 * ticket — that is what the reset endpoint checks, so the strength of the reset never depends on a
 * six-digit number. The ticket is held in component state for the length of the flow and never
 * written to storage.
 */
export async function verifyResetCode(email: string, code: string): Promise<string> {
  const payload = await api.post<{ ticket: string }>('/auth/verify-reset-code', { email, code }, { skipAuth: true });
  return payload.ticket;
}

/**
 * Sets the new password.
 *
 * Accepts either the current `ticket` or a legacy emailed `token` — the backend takes exactly one,
 * and the legacy path exists only so links already sitting in inboxes still work for one release.
 *
 * No session is created. The customer signs in normally afterwards, which keeps a leaked
 * credential from being redeemable straight into an authenticated session.
 */
export async function resetPassword(
  input: { password: string; confirmPassword: string } & ({ ticket: string } | { token: string }),
): Promise<string> {
  const payload = await api.post<{ message: string }>('/auth/reset-password', input, { skipAuth: true });
  return payload.message;
}
