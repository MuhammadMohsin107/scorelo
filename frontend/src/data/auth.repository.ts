import { api } from '../lib/api';
import { clearTokens, getRefreshToken, setTokens } from '../lib/authTokens';
import type { UserRow } from './api.types';

interface AuthPayload {
  user: UserRow;
  accessToken: string;
  refreshToken: string;
}

/**
 * Signup's reply. The shape is the same whether or not the server enforces verification — only
 * `emailVerificationRequired` and the presence of tokens change — so this client keeps working
 * across a flag flip on the server without a redeploy.
 */
interface SignupPayload {
  user: UserRow;
  emailVerificationRequired: boolean;
  /** False when the account was created but the code could not be mailed. Not a failure: the
   * account exists and the customer needs the resend flow. */
  verificationSent: boolean;
  accessToken?: string;
  refreshToken?: string;
}

export interface SignupResult {
  user: UserRow;
  /** True when the customer must verify before they can sign in — no session was created. */
  needsVerification: boolean;
  verificationSent: boolean;
}

/** Client-only session preference. It is deliberately NOT part of the request body: the backend
 * schemas are `.strict()`, so an unexpected key is rejected with a 400. */
interface SessionPreference {
  /** true -> the session survives closing the browser; false -> it ends with the tab. */
  rememberMe?: boolean;
}

export interface SignupInput extends SessionPreference {
  fullName: string;
  email: string;
  password: string;
}

export interface LoginInput extends SessionPreference {
  email: string;
  password: string;
}

/**
 * Creates an account and sends a verification code.
 *
 * Whether a session starts here is the SERVER's decision, not this client's: tokens arrive only
 * while verification is not enforced. Storing them is conditional on their presence rather than on
 * any local flag, so the browser can never manufacture a session the backend did not grant.
 */
export async function signup({ rememberMe, ...credentials }: SignupInput): Promise<SignupResult> {
  const payload = await api.post<SignupPayload>('/auth/signup', credentials, { skipAuth: true });

  if (payload.accessToken && payload.refreshToken) {
    setTokens({ accessToken: payload.accessToken, refreshToken: payload.refreshToken }, { remember: rememberMe });
  }

  return {
    user: payload.user,
    needsVerification: payload.emailVerificationRequired,
    verificationSent: payload.verificationSent,
  };
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
  | { twoFactorRequired: true; ticket: string; codeSent: boolean }
  | ({ twoFactorRequired: false } & AuthPayload);

export type LoginResult =
  | { status: 'authenticated'; user: UserRow }
  /** The password was right, but the sign-in is not finished. NO session exists yet. */
  | { status: 'two-factor'; ticket: string; codeSent: boolean };

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
    return { status: 'two-factor', ticket: payload.ticket, codeSent: payload.codeSent };
  }

  setTokens({ accessToken: payload.accessToken, refreshToken: payload.refreshToken }, { remember: rememberMe });
  return { status: 'authenticated', user: payload.user };
}

/**
 * Completes a sign-in that paused for a second factor.
 *
 * Sends the ticket and the code — never the password again. The ticket already proves the password
 * step succeeded, so re-transmitting the credential would hand over more than the step needs.
 */
export async function completeTwoFactorLogin(
  ticket: string,
  code: string,
  rememberMe?: boolean,
): Promise<UserRow> {
  const payload = await api.post<AuthPayload>('/auth/login/2fa', { ticket, code }, { skipAuth: true });
  setTokens({ accessToken: payload.accessToken, refreshToken: payload.refreshToken }, { remember: rememberMe });
  return payload.user;
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
