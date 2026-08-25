import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { UserRow } from '../data/api.types';
import * as authRepository from '../data/auth.repository';
import { resetCachedUser, updateCachedUser } from '../data/user.repository';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: UserRow | null;
  signup: (input: authRepository.SignupInput) => Promise<void>;
  login: (input: authRepository.LoginInput) => Promise<void>;
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

  const signup = useCallback(
    async (input: authRepository.SignupInput) => adoptSession(await authRepository.signup(input)),
    [adoptSession],
  );

  const login = useCallback(
    async (input: authRepository.LoginInput) => adoptSession(await authRepository.login(input)),
    [adoptSession],
  );

  const logout = useCallback(async () => {
    await authRepository.logout();
    resetCachedUser();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ status, user, signup, login, logout }), [status, user, signup, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
