import { clearTokens, getAccessToken, getRefreshToken, setAccessToken, setTokens } from './authTokens';

// Default to a same-origin '/api' path: in production the static server (server.cjs) proxies
// /api to the backend, so the browser never needs a separate API hostname. Dev uses the Vite
// proxy for the same reason. Set VITE_API_BASE_URL only to point at a genuinely separate host.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends RequestInit {
  /** Skips both the Authorization header and the 401-refresh retry. Used by the auth
   * endpoints themselves, so a failed login can never trigger a refresh loop. */
  skipAuth?: boolean;
}

/** Refresh is shared: if several requests 401 at once they await one refresh, not N. */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        clearTokens();
        return false;
      }
      const payload = await response.json();
      const data = payload?.data;
      if (!data?.accessToken) {
        clearTokens();
        return false;
      }
      // The backend rotates refresh tokens, so store the new pair, not just the access token.
      if (data.refreshToken) setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      else setAccessToken(data.accessToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function rawRequest(path: string, options: RequestOptions): Promise<Response> {
  const token = options.skipAuth ? null : getAccessToken();
  const { skipAuth: _skipAuth, ...init } = options;

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await rawRequest(path, options);

  // An expired access token is recoverable: refresh once, then replay the request.
  if (response.status === 401 && !options.skipAuth && getRefreshToken()) {
    if (await refreshAccessToken()) {
      response = await rawRequest(path, options);
    }
  }

  if (!response.ok) {
    let message = 'Request failed';
    let code: string | undefined;
    try {
      const payload = await response.json();
      if (payload && typeof payload.error === 'string') message = payload.error;
      if (payload && typeof payload.code === 'string') code = payload.code;
    } catch {
      // ignore JSON parse errors and fall back to the default message
    }
    throw new ApiError(message, response.status, code);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json();
  // Every Scorelo controller responds with `{ data: ... }` — unwrap it once here
  // so call sites can work with the resource shape directly.
  return (payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload) as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, {
    ...options,
    method: 'POST',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }),
  put: <T>(path: string, body: unknown, options?: RequestOptions) => request<T>(path, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, {
    ...options,
    method: 'PATCH',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }),
};
