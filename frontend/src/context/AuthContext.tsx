import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { UserRow } from '../data/api.types';
import * as authRepository from '../data/auth.repository';
import { resetCachedUser, updateCachedUser } from '../data/user.repository';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: UserRow | null;
  /** Resolves with what the server decided — whether verification is needed, and whether the code
   * actually reached the customer's inbox. */
  signup: (input: authRepository.SignupInput) => Promise<authRepository.SignupResult>;
  /** Resolves with whether the sign-in completed or is waiting on a second factor. */
  login: (input: authRepository.LoginInput) => Promise<authRepository.LoginResult>;
  completeTwoFactorLogin: (ticket: string, code: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<UserRow | null>(null);

  // Resolve the session once on mount. `status` stays 'loading' until this settles so the
  // router never flashes the login screen at an already-signed-in customer.
  useEffect(() => {
    let active = true;
    authRepository.fetchSession().then((session) => {
      if (!active) return;
      if (session) {
        updateCachedUser(session);
        setUser(session);
        setStatus('authenticated');
      } else {
        setStatus('unauthenticated');
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const adoptSession = useCallback((session: UserRow) => {
    resetCachedUser();
    updateCachedUser(session);
    setUser(session);
    setStatus('authenticated');
  }, []);

  /**
   * Signs up, and adopts a session ONLY if the server actually granted one.
   *
   * When email verification is enforced the backend deliberately withholds tokens from an
   * unverified account, so the customer stays unauthenticated until they verify and sign in. The
   * decision is read from the server's answer rather than from any local flag — a client that
   * marked itself authenticated here would be inventing a session the API will not honour.
   *
   * The result is returned so the signup page can route to verification.
   */
  const signup = useCallback(
    async (input: authRepository.SignupInput) => {
      const result = await authRepository.signup(input);
      if (!result.needsVerification) adoptSession(result.user);
      return result;
    },
    [adoptSession],
  );

  /**
   * Signs in, adopting a session ONLY when the server actually issued one.
   *
   * A login that stops for a second factor returns no tokens and no user, so the context stays
   * unauthenticated until the code is verified. The result is handed back so the login page can
   * show the code step.
   */
  const login = useCallback(
    async (input: authRepository.LoginInput) => {
      const result = await authRepository.login(input);
      if (result.status === 'authenticated') adoptSession(result.user);
      return result;
    },
    [adoptSession],
  );

  /** Finishes a 2FA sign-in. This is where the session begins for a customer with 2FA on. */
  const completeTwoFactorLogin = useCallback(
    async (ticket: string, code: string, rememberMe?: boolean) =>
      adoptSession(await authRepository.completeTwoFactorLogin(ticket, code, rememberMe)),
    [adoptSession],
  );

  const logout = useCallback(async () => {
    await authRepository.logout();
    resetCachedUser();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, signup, login, completeTwoFactorLogin, logout }),
    [status, user, signup, login, completeTwoFactorLogin, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
