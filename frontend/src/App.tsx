import { useEffect, useRef } from 'react';
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
import SchemaJsonLdPage from './pages/seo/SchemaJsonLdPage';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import RequireAuth from './components/auth/RequireAuth';
import { AuthProvider, useAuth } from './context/AuthContext';

function ResetRouteOnReload() {
  const navigate = useNavigate();
  const location = useLocation();
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const isReload = navigationEntry?.type === 'reload' || performance.navigation?.type === 1;

    // Auth routes must survive a reload — bouncing them to '/' would kick a signed-out
    // visitor into the guard and back, losing whatever they had typed.
    const isAuthRoute = location.pathname === '/login' || location.pathname === '/signup';

    if (isReload && location.pathname !== '/' && !isAuthRoute) {
      navigate('/', { replace: true });
    }
  }, [location.pathname, navigate]);

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
    <BrowserRouter>
      <AuthProvider>
        <ResetRouteOnReload />
        <Routes>
          {/* Auth routes render outside AppShell — no sidebar/header before sign-in. */}
          <Route path="/login" element={<RedirectIfAuthenticated><Login /></RedirectIfAuthenticated>} />
          <Route path="/signup" element={<RedirectIfAuthenticated><Signup /></RedirectIfAuthenticated>} />
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
          <Route path="/seo/schema" element={<SchemaJsonLdPage />} />
          <Route path="/seo/:subPillar" element={<SeoSubPillarRoute />} />

          <Route path="/content" element={<ContentDashboard />} />
          <Route path="/content/product-descriptions" element={<NonSeoSubPillarPage />} />
          <Route path="/content/collection-descriptions" element={<NonSeoSubPillarPage />} />
          <Route path="/content/metafields" element={<NonSeoSubPillarPage />} />
          <Route path="/content/dup-templated" element={<NonSeoSubPillarPage />} />
          <Route path="/content/blog-freshness" element={<NonSeoSubPillarPage />} />
          <Route path="/content/media-richness" element={<NonSeoSubPillarPage />} />

          <Route path="/speed" element={<SpeedDashboard />} />
          <Route path="/speed/cwv" element={<NonSeoSubPillarPage />} />
          <Route path="/speed/image-weight" element={<NonSeoSubPillarPage />} />
          <Route path="/speed/app-bloat" element={<NonSeoSubPillarPage />} />
          <Route path="/speed/theme-weight" element={<NonSeoSubPillarPage />} />

          <Route path="/cro" element={<CroDashboard />} />
          <Route path="/cro/:subPillar" element={<NonSeoSubPillarPage />} />

          <Route path="/ai-discovery" element={<AiDiscoveryDashboard />} />
          <Route path="/ai-discovery/agents-md" element={<NonSeoSubPillarPage />} />
          <Route path="/ai-discovery/agentic-attrs" element={<NonSeoSubPillarPage />} />
          <Route path="/ai-discovery/answerable-qa" element={<NonSeoSubPillarPage />} />
          <Route path="/ai-discovery/feed" element={<NonSeoSubPillarPage />} />
        </Routes>
      </AppShell>
    </RequireAuth>
  );
}
