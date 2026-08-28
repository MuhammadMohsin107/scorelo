import { api } from '../lib/api';
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

export interface SignupInput extends SessionPreference {
  fullName: string;
  email: string;
  password: string;
}

export interface LoginInput extends SessionPreference {
  email: string;
  password: string;
}

/** Creates an account and starts the session in one step — no separate "now log in". */
export async function signup({ rememberMe, ...credentials }: SignupInput): Promise<UserRow> {
  const payload = await api.post<AuthPayload>('/auth/signup', credentials, { skipAuth: true });
  setTokens({ accessToken: payload.accessToken, refreshToken: payload.refreshToken }, { remember: rememberMe });
  return payload.user;
}

export async function login({ rememberMe, ...credentials }: LoginInput): Promise<UserRow> {
  const payload = await api.post<AuthPayload>('/auth/login', credentials, { skipAuth: true });
  setTokens({ accessToken: payload.accessToken, refreshToken: payload.refreshToken }, { remember: rememberMe });
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
