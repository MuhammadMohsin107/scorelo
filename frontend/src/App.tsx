import { BrowserRouter, Routes, Route } from 'react-router-dom';
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

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
