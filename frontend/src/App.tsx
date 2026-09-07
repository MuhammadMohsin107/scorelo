import { useLayoutEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import AppShell from './layouts/AppShell';
import Dashboard from './pages/Dashboard';
import SeoDashboard from './pages/seo/SeoDashboard';

import ContentDashboard from './pages/content/ContentDashboard';

import SpeedDashboard from './pages/speed/SpeedDashboard';

import AiDiscoveryDashboard from './pages/ai-discovery/AiDiscoveryDashboard';
import CroDashboard from './pages/cro/CroDashboard';
import NonSeoSubPillarPage from './pages/NonSeoSubPillarPage';
// All 8 SEO sub-pillars render through the shared master template
// established on Title Tags; each supplies its own analysis data.
import SeoSubPillarRoute from './pages/seo/SeoSubPillarRoute';
import FixCenter from './pages/FixCenter';
import Integrations from './pages/Integrations';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import NotFound from './pages/NotFound';
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import VerifyEmail from './pages/auth/VerifyEmail';
import Signup from './pages/auth/Signup';
import RequireAuth from './components/auth/RequireAuth';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

/**
 * ─── Reload starts at the dashboard ──────────────────────────────────
 *
 * Refreshing any in-app page returns to the dashboard, by product decision.
 *
 * ONLY A RELOAD. This distinguishes how the page was ENTERED, using the Navigation Timing API:
 *
 *   reload        F5 / Ctrl-R / the browser's reload button  ->  go to the dashboard
 *   navigate      a pasted URL, a bookmark, a shared link    ->  stay exactly where asked
 *   back_forward  the browser's back and forward buttons     ->  stay, or history breaks
 *
 * That distinction is the whole design. An earlier version of this redirected on every entry and
 * had to be deleted, because it also broke deep links and the back button — a customer sent a
 * colleague a link to /seo/title-tags and the colleague landed on the dashboard.
 *
 * It reads `performance.getEntriesByType('navigation')`, NOT the long-deprecated
 * `performance.navigation.type` the deleted version used.
 *
 * Runs once, before paint, and replaces the history entry rather than pushing one — so pressing
 * back after a refresh does not bounce between the dashboard and the page you refreshed.
 */
function ResetRouteOnReload() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // A ref, not state: this must fire once per page load, and re-running it on every navigation
  // would send the customer home the moment they clicked anything.
  const handled = useRef(false);

  useLayoutEffect(() => {
    if (handled.current) return;
    handled.current = true;
    if (pathname === '/') return;

    let wasReload = false;
    try {
      const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      wasReload = entry?.type === 'reload';
    } catch {
      // Timing API unavailable (old browser, restricted context). Staying put is the safe
      // default: showing the page that was asked for is never wrong.
    }

    if (wasReload) navigate('/', { replace: true });
  }, [navigate, pathname]);

  return null;
}

/** Sends an already-signed-in visitor away from /login and /signup. */
function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Auth routes render outside AppShell — no sidebar/header before sign-in. */}
          <Route path="/login" element={<RedirectIfAuthenticated><Login /></RedirectIfAuthenticated>} />
          <Route path="/signup" element={<RedirectIfAuthenticated><Signup /></RedirectIfAuthenticated>} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* Not wrapped in RedirectIfAuthenticated: while verification is enforced a signing-up
              customer holds no session, and once it is not, someone who signed up and stayed
              logged in must still be able to finish verifying. */}
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="*" element={<AuthenticatedApp />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

function AuthenticatedApp() {
  return (
    <RequireAuth>
      {/* Inside RequireAuth so a signed-out visitor is sent to /login first — being redirected to
          the dashboard only to be bounced to the sign-in screen would lose the page they wanted
          to return to after signing in. */}
      <ResetRouteOnReload />
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/fix-center" element={<FixCenter />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/:section" element={<Settings />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/seo" element={<SeoDashboard />} />
          {/* /seo/schema used to be served by a bespoke page that rendered a hard-coded score,
              three invented findings and fourteen fabricated evidence rows without ever calling
              the API. It now falls through to the same real-data route as the other seven SEO
              sub-pillars. */}
          <Route path="/seo/:subPillar" element={<SeoSubPillarRoute />} />

          {/* Content / Speed / CRO / AI Discovery all use one `:subPillar` wildcard, matching
              how /seo already worked. Enumerating each slug meant an unknown one (a typo, a stale
              link) matched NO route and rendered a blank page inside the shell; NonSeoSubPillarPage
              now owns that case and redirects to the pillar dashboard, exactly as
              SeoSubPillarRoute does. The valid slugs are defined once, in the pillar catalogs. */}
          <Route path="/content" element={<ContentDashboard />} />
          <Route path="/content/:subPillar" element={<NonSeoSubPillarPage />} />

          <Route path="/speed" element={<SpeedDashboard />} />
          <Route path="/speed/:subPillar" element={<NonSeoSubPillarPage />} />

          <Route path="/cro" element={<CroDashboard />} />
          <Route path="/cro/:subPillar" element={<NonSeoSubPillarPage />} />

          <Route path="/ai-discovery" element={<AiDiscoveryDashboard />} />
          <Route path="/ai-discovery/:subPillar" element={<NonSeoSubPillarPage />} />

          {/* Anything else. Without this, an unmatched in-app URL rendered the shell with an
              empty main area and only a console warning to explain it. */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppShell>
    </RequireAuth>
  );
}
