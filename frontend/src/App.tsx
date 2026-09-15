import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import RequireAuth from './components/auth/RequireAuth';
import Onboarding from './pages/onboarding/Onboarding';
import OnboardingGate from './components/onboarding/OnboardingGate';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { readShopifyGrant, readShopifyLaunch } from './data/auth.repository';

/**
 * Sends an already-signed-in visitor away from /login — unless Shopify sign-in is arriving there.
 *
 * Opening Scorelo from a Shopify admin names a shop, and that shop decides which account opens. A
 * session left over in this browser (possibly for a different store) must not swallow the launch or
 * the returning grant by bouncing straight to the dashboard.
 */
function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  const shopifyArriving = Boolean(readShopifyLaunch(location.search) || readShopifyGrant(location.hash));
  if (status === 'authenticated' && !shopifyArriving) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/**
 * Shopify opens the app at its root URL with a signed query (App Store install, or Apps in the
 * admin). Wherever that lands, it is forwarded — query intact — to /login, which starts Shopify's
 * authorization. Without this, the in-app guard would redirect to /login and drop the query, and an
 * App Store install would stop at a sign-in form instead of authenticating immediately.
 */
function ShopifyLaunchForwarder({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  if (location.pathname !== '/login' && readShopifyLaunch(location.search)) {
    return <Navigate to={{ pathname: '/login', search: location.search }} replace />;
  }
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
        <ShopifyLaunchForwarder>
        <Routes>
          {/* Auth routes render outside AppShell — no sidebar/header before sign-in. */}
          <Route path="/login" element={<RedirectIfAuthenticated><Login /></RedirectIfAuthenticated>} />
          {/* New merchants get their account by signing in with Shopify, so there is no separate
              signup form. Old links land on the sign-in page, where that starts. */}
          <Route path="/signup" element={<Navigate to="/login" replace />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* Not wrapped in RedirectIfAuthenticated: while verification is enforced a signing-up
              customer holds no session, and once it is not, someone who signed up and stayed
              logged in must still be able to finish verifying. */}
          <Route path="/verify-email" element={<VerifyEmail />} />
          {/* Guided setup renders outside AppShell: a merchant answering these five questions has
              no populated dashboard to navigate to yet, and a sidebar of empty pillars competes
              with the only task on screen. Still behind RequireAuth — it reads their store. */}
          <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
          <Route path="*" element={<AuthenticatedApp />} />
          </Routes>
        </ShopifyLaunchForwarder>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
    </ErrorBoundary>
  );
}

function AuthenticatedApp() {
  return (
    <RequireAuth>
      {/* Sends a merchant with a connected, un-started setup to /onboarding once per app mount.
          Fails open — see OnboardingGate. */}
      <OnboardingGate>
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
      </OnboardingGate>
    </RequireAuth>
  );
}
