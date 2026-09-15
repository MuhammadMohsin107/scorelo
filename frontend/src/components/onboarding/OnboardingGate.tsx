import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { fetchOnboarding } from '../../data/onboarding.repository';

/**
 * Routes a merchant into guided setup the first time they land in the app with a connected store.
 *
 * Runs once per app mount, not per navigation — a merchant who chose "Finish later" has answered
 * this question, and asking again on every route change is a nag rather than a flow.
 *
 * FAILS OPEN. If the check errors, times out, or the store is not connected, the app renders
 * normally. Setup is worth interrupting someone for; it is not worth locking them out of their
 * own dashboard when an endpoint is down.
 */
export default function OnboardingGate({ children }: { children: ReactNode }) {
  const [decision, setDecision] = useState<'checking' | 'allow' | 'redirect'>('checking');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const state = await fetchOnboarding();
        if (cancelled) return;
        // Redirect only for a connected store whose setup has been neither finished nor deferred.
        const needsSetup = state.connected && !state.completedAt && !state.deferredAt;
        setDecision(needsSetup ? 'redirect' : 'allow');
      } catch {
        if (!cancelled) setDecision('allow');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Held for one same-origin request rather than flashing the dashboard and yanking it away.
  if (decision === 'checking') return null;
  if (decision === 'redirect') return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}
