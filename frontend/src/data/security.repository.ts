import { api } from '../lib/api';
import { getRefreshToken } from '../lib/authTokens';

/**
 * ─── Settings → Security ─────────────────────────────────────────────
 *
 * Every value on the Security page comes through here, from the real API, from real MySQL rows.
 * There is no fallback list, no placeholder session and no sample event — when the backend returns
 * nothing, the page says there is nothing, because that is the truth about the account.
 */

export type SecurityEventType =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'password_changed'
  | 'password_reset'
  | 'email_verified'
  | 'session_revoked'
  | 'sessions_revoked'
  | 'two_factor_enabled'
  | 'two_factor_disabled'
  | 'two_factor_admin_disabled'
  | 'two_factor_challenges_revoked'
  | 'two_factor_recovery_used'
  | 'recovery_codes_generated';

export interface SessionRecord {
  id: number;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  /** Null when the request genuinely carried no usable address. Rendered as "Unknown", never
   * substituted with a plausible-looking one. */
  ipAddress: string | null;
  /** The raw User-Agent header, or null. Deliberately NOT parsed into a device name — that would
   * be a guess dressed as a fact. */
  userAgent: string | null;
}

export interface SecurityEventRecord {
  id: number;
  type: SecurityEventType;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  context: Record<string, number | boolean | null> | null;
}

/**
 * `password_changed_at` is a column on the user row, so /users/me already returns it — no
 * dedicated overview endpoint was added for a single field. The shape is declared locally rather
 * than widened in api.types.ts, which is outside this phase's scope.
 */
export interface SecurityProfile {
  /** The address 2FA codes and verification mail go to — GET /users/me has always returned it,
   * this contract simply did not declare it, so the Security page could not name or use it. */
  email: string;
  passwordChangedAt: string | null;
  emailVerifiedAt: string | null;
  /** Non-null means email 2FA is on. There is no secret here — the factor is the verified inbox. */
  twoFactorEnabledAt: string | null;
  createdAt: string;
}

export const fetchSessions = () => api.get<SessionRecord[]>('/security/sessions');

export const fetchSecurityEvents = () => api.get<SecurityEventRecord[]>('/security/events');

export const fetchSecurityProfile = () => api.get<SecurityProfile>('/users/me');

/** Ends one session. The server verifies ownership; a session belonging to anyone else 404s. */
export const revokeSession = (id: number) => api.post<void>(`/security/sessions/${id}/revoke`, {});

/**
 * Ends every session except this one.
 *
 * The caller's own refresh token is sent so the server knows which row to spare. If it is missing
 * the server revokes everything — including this device — which is the safe failure.
 */
export function revokeOtherSessions() {
  const refreshToken = getRefreshToken();
  return api.post<{ revoked: number }>('/security/sessions/revoke-others', refreshToken ? { refreshToken } : {});
}

/**
 * Changes the password.
 *
 * The refresh token rides along for the same reason: the current session survives, every other
 * one is revoked. Passwords are sent once, over TLS, and never stored anywhere on the client.
 */
export function changePassword(input: { currentPassword: string; newPassword: string; confirmPassword: string }) {
  const refreshToken = getRefreshToken();
  return api.post<{ message: string; otherSessionsRevoked: number }>('/security/password', {
    ...input,
    ...(refreshToken ? { refreshToken } : {}),
  });
}

/**
 * Turns email 2FA on or off.
 *
 * The current password is required both ways — an access token alone must not be enough to remove
 * a protection, which is the first thing an attacker holding a session would try. The password is
 * sent once, over TLS, and never held in client state beyond the request.
 */
export interface EnableTwoFactorResult {
  twoFactorEnabled: boolean;
  /** True when 2FA was already on and nothing changed — no codes were issued. */
  alreadyEnabled: boolean;
  /**
   * The plaintext recovery codes, present ONLY in this one response and never retrievable again.
   * After this the server holds hashes only, so a set the customer does not save is gone.
   */
  recoveryCodes: string[] | null;
}

export const enableTwoFactor = (currentPassword: string) =>
  api.post<EnableTwoFactorResult>('/security/two-factor/enable', { currentPassword });

export const disableTwoFactor = (currentPassword: string) =>
  api.post<{ twoFactorEnabled: boolean }>('/security/two-factor/disable', { currentPassword });

/**
 * What a verification resend actually did.
 *
 * More specific than the public /auth/resend-verification, which answers uniformly so a stranger
 * cannot use it to find out which addresses have accounts. That concern does not apply here: the
 * caller is authenticated and asking about their own address, which this page already displays.
 */
export type VerificationResendResult =
  | { sent: true }
  | { sent: false; reason: 'already_verified' | 'delivery_unavailable' | 'delivery_failed' };

/** Re-sends the verification code to the signed-in customer's own address. Takes no address — the
 * server resolves it from the session, so it cannot be aimed at someone else's inbox. */
export const resendMyVerificationEmail = () =>
  api.post<VerificationResendResult>('/security/verify-email/resend', {});

// ─── Recovery codes ──────────────────────────────────────────────────

export interface RecoveryCodeStatus {
  /** How many are still unused. */
  remaining: number;
  /** How many are issued in a full set, so the UI can render "3 of 10 left". */
  total: number;
}

/** A COUNT only. No endpoint anywhere can read a stored recovery code back — they are hashed. */
export const fetchRecoveryCodeStatus = () =>
  api.get<RecoveryCodeStatus>('/security/two-factor/recovery-codes');

/**
 * Mints a fresh set, voiding every previous one.
 *
 * Password-gated: minting recovery codes creates working second-factor bypasses, so a stolen
 * access token must not be enough to do it quietly.
 */
export const regenerateRecoveryCodes = (currentPassword: string) =>
  api.post<{ recoveryCodes: string[] }>('/security/two-factor/recovery-codes/regenerate', { currentPassword });

/** Wording for each event type. Describes the action; never mentions a credential. */
const EVENT_LABELS: Record<SecurityEventType, string> = {
  login_success: 'Signed in',
  login_failed: 'Failed sign-in attempt',
  logout: 'Signed out',
  password_changed: 'Password changed',
  password_reset: 'Password reset',
  email_verified: 'Email address verified',
  session_revoked: 'Device signed out',
  sessions_revoked: 'Other devices signed out',
  two_factor_enabled: 'Two-factor authentication turned on',
  two_factor_disabled: 'Two-factor authentication turned off',
  // Kept distinct from the line above: "you switched this off" and "an operator switched this off
  // for you" are different facts, and an owner reading their own history needs to tell them apart.
  two_factor_admin_disabled: 'Two-factor authentication turned off by support',
  two_factor_challenges_revoked: 'Sign-in codes cancelled by support',
  // Worth its own line rather than folding into "Signed in": it says the second factor itself was
  // unreachable, which is exactly what an owner scans this list for.
  two_factor_recovery_used: 'Signed in with a recovery code',
  recovery_codes_generated: 'New recovery codes generated',
};

export function eventLabel(type: SecurityEventType): string {
  return EVENT_LABELS[type] ?? type;
}

/** Absolute date and time — a security log is read for exactly when something happened, so
 * "2 hours ago" is the wrong unit here. */
export function formatSecurityDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
