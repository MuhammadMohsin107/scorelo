import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import Signup from './pages/auth/Signup';
import RequireAuth from './components/auth/RequireAuth';
import { AuthProvider, useAuth } from './context/AuthContext';

/**
 * NOTE — reload behaviour
 *
 * A `ResetRouteOnReload` component used to live here. On any page reload it force-navigated to
 * '/', so pressing F5 on /seo/title-tags or /settings/billing silently threw the customer back to
 * the dashboard and lost their place. It also branched on `performance.navigation.type`, which is
 * deprecated.
 *
 * It has been removed rather than patched: every route resolves its own data on mount, so there
 * is nothing about a reload that requires starting from the dashboard. The current location now
 * survives a refresh, which is what a deep link, a bookmark and the browser's back button all
 * already assumed.
 */

/** Sends an already-signed-in visitor away from /login and /signup. */
function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Auth routes render outside AppShell — no sidebar/header before sign-in. */}
          <Route path="/login" element={<RedirectIfAuthenticated><Login /></RedirectIfAuthenticated>} />
          <Route path="/signup" element={<RedirectIfAuthenticated><Signup /></RedirectIfAuthenticated>} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<AuthenticatedApp />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

function AuthenticatedApp() {
  return (
    <RequireAuth>
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
