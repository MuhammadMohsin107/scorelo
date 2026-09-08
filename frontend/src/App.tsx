import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
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

/** Sends an already-signed-in visitor away from /login and /signup. */
function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    // Outermost, so a render crash anywhere below shows a recoverable screen instead of unmounting
    // the tree and leaving a blank page. See components/ErrorBoundary.tsx.
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}

function AuthenticatedApp() {
  return (
    <RequireAuth>
      {/* ─── Reload stays on the page you were on ──────────────────────
          A refresh re-renders the route in the address bar and nothing redirects it.

          A `ResetRouteOnReload` component used to sit here and send every refresh back to the
          dashboard. It is gone by product decision: pressing F5 on /seo/title-tags is how a
          person reloads the data in front of them, and answering that by throwing away the page
          they were reading costs them the scroll position, the filters and the row they had open.

          Deep links, bookmarks and the back/forward buttons behaved correctly under that
          component too — this simply makes reload behave the same as all three. */}
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
