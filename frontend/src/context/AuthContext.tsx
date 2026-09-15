import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { UserRow } from '../data/api.types';
import * as authRepository from '../data/auth.repository';
import { resetCachedUser, updateCachedUser } from '../data/user.repository';
import { resetNotifications } from '../data/notifications';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: UserRow | null;
  /** Resolves with whether the sign-in completed or is waiting on a second factor. */
  login: (input: authRepository.LoginInput) => Promise<authRepository.LoginResult>;
  /** Finishes a Shopify sign-in from the grant it returned with. Same two outcomes as `login`. */
  completeShopifySignIn: (grant: string) => Promise<authRepository.LoginResult>;
  /**
   * Finishes a 2FA sign-in with either the emailed code or a recovery code. Resolves with how many
   * recovery codes are left when one was spent, so the page can warn the customer.
   */
  completeTwoFactorLogin: (
    ticket: string,
    credential: { code: string } | { recoveryCode: string },
    rememberMe?: boolean,
  ) => Promise<number | null>;
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
    // The notification store is module state that outlives a sign-out, so without this the next
    // person to sign in on this browser would see the previous account's bell until it refetched.
    resetNotifications();
    updateCachedUser(session);
    setUser(session);
    setStatus('authenticated');
  }, []);

  /** Adopts a session only when Shopify sign-in actually produced one — a second factor pauses it
   * exactly as it pauses a password sign-in. */
  const completeShopifySignIn = useCallback(
    async (grant: string) => {
      const result = await authRepository.completeShopifySignIn(grant);
      if (result.status === 'authenticated') adoptSession(result.user);
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
    async (
      ticket: string,
      credential: { code: string } | { recoveryCode: string },
      rememberMe?: boolean,
    ) => {
      const result = await authRepository.completeTwoFactorLogin(ticket, credential, rememberMe);
      adoptSession(result.user);
      return result.recoveryCodesRemaining;
    },
    [adoptSession],
  );

  const logout = useCallback(async () => {
    await authRepository.logout();
    resetCachedUser();
    resetNotifications();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, completeShopifySignIn, completeTwoFactorLogin, logout }),
    [status, user, login, completeShopifySignIn, completeTwoFactorLogin, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
