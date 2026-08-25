import { api } from '../lib/api';
import { clearTokens, getRefreshToken, setTokens } from '../lib/authTokens';
import type { UserRow } from './api.types';

interface AuthPayload {
  user: UserRow;
  accessToken: string;
  refreshToken: string;
}

export interface SignupInput {
  fullName: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** Creates an account and starts the session in one step — no separate "now log in". */
export async function signup(input: SignupInput): Promise<UserRow> {
  const payload = await api.post<AuthPayload>('/auth/signup', input, { skipAuth: true });
  setTokens({ accessToken: payload.accessToken, refreshToken: payload.refreshToken });
  return payload.user;
}

export async function login(input: LoginInput): Promise<UserRow> {
  const payload = await api.post<AuthPayload>('/auth/login', input, { skipAuth: true });
  setTokens({ accessToken: payload.accessToken, refreshToken: payload.refreshToken });
  return payload.user;
}

/** Clears the session locally even if the server call fails — the customer asked to sign out,
 * so the local session must not survive a network error. */
export async function logout(): Promise<void> {
  try {
    if (getRefreshToken()) await api.post('/auth/logout');
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
