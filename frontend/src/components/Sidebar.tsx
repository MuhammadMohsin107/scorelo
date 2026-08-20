import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  FileText,
  Zap,
  Target,
  Sparkles,
  Wrench,
  Puzzle,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';
import { dashboardMockData } from '../data/dashboard/dashboard.mock';
import type { PillarScore } from '../data/dashboard/dashboard.mock';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

// Map pillar keys to icons
const pillarIcons: Record<string, React.ReactNode> = {
  seo: <Search size={16} strokeWidth={2} />,
  content: <FileText size={16} strokeWidth={2} />,
  speed: <Zap size={16} strokeWidth={2} />,
  cro: <Target size={16} strokeWidth={2} />,
  'ai-discovery': <Sparkles size={16} strokeWidth={2} />,
};

// Map pillar keys to routes
const pillarRoutes: Record<string, string> = {
  seo: '/seo',
  content: '/content',
  speed: '/speed',
  cro: '/cro',
  'ai-discovery': '/ai-discovery',
};

// SEO sub-pillar routes - mapped from dashboard.mock.ts subPillars
const seoSubRoutes: { id: string; label: string; path: string }[] = [
  { id: 'title-tags', label: 'Title tags', path: '/seo/title-tags' },
  { id: 'meta-descriptions', label: 'Meta descriptions', path: '/seo/meta-descriptions' },
  { id: 'schema', label: 'Schema / JSON-LD', path: '/seo/schema' },
  { id: 'alt-text', label: 'Image alt text', path: '/seo/image-alt-text' },
  { id: 'canonicals', label: 'Canonicals & duplicates', path: '/seo/canonicals' },
  { id: 'handles', label: 'Handles & redirects', path: '/seo/handles-redirects' },
  { id: 'sitemap', label: 'Sitemap & indexability', path: '/seo/sitemap' },
  { id: 'internal-links', label: 'Internal links & 404s', path: '/seo/internal-links' },
];

// Content sub-pillar routes
// Only routes that have a page registered in App.tsx are listed here,
// so the sidebar never links to an empty route. Add entries as pages land.
const contentSubRoutes: { id: string; label: string; path: string }[] = [
  { id: 'product-descriptions', label: 'Product descriptions', path: '/content/product-descriptions' },
  { id: 'collection-descriptions', label: 'Collection descriptions', path: '/content/collection-descriptions' },
  { id: 'metafields', label: 'Metafield completeness', path: '/content/metafields' },
  { id: 'dup-templated', label: 'Duplicate/templated copy', path: '/content/dup-templated' },
  { id: 'blog-freshness', label: 'Blog freshness', path: '/content/blog-freshness' },
  { id: 'media-richness', label: 'Media richness', path: '/content/media-richness' },
];

// Speed sub-pillar routes
const speedSubRoutes: { id: string; label: string; path: string }[] = [
  { id: 'cwv', label: 'Core Web Vitals', path: '/speed/cwv' },
  { id: 'image-weight', label: 'Image weight & format', path: '/speed/image-weight' },
  { id: 'app-bloat', label: 'App & script bloat', path: '/speed/app-bloat' },
  { id: 'theme-weight', label: 'Theme weight / fonts / lazy-load', path: '/speed/theme-weight' },
];

// CRO sub-pillar routes
const croSubRoutes: { id: string; label: string; path: string }[] = [
  { id: 'clarity', label: 'Clarity / behavior readiness', path: '/cro/clarity' },
  { id: 'cart-recovery', label: 'Cart recovery', path: '/cro/cart-recovery' },
  { id: 'trust', label: 'Trust & social proof', path: '/cro/trust' },
  { id: 'returns', label: 'Returns flow', path: '/cro/returns' },
  { id: 'tracking', label: 'Order tracking', path: '/cro/tracking' },
  { id: 'cod', label: 'COD checkout quality', path: '/cro/cod' },
  { id: 'options', label: 'Product options / add-ons', path: '/cro/options' },
  { id: 'subscription', label: 'Subscription opportunity', path: '/cro/subscription' },
  { id: 'wishlist', label: 'Wishlist', path: '/cro/wishlist' },
  { id: 'locator', label: 'Store locator', path: '/cro/locator' },
  { id: 'mobile-ux', label: 'Mobile UX', path: '/cro/mobile-ux' },
];

// AI Discovery sub-pillar routes
const aiDiscoverySubRoutes: { id: string; label: string; path: string }[] = [
  { id: 'agents-md', label: 'agents.md / llms.txt', path: '/ai-discovery/agents-md' },
  { id: 'agentic-attrs', label: 'Agentic commerce attributes', path: '/ai-discovery/agentic-attrs' },
  { id: 'answerable-qa', label: 'Answerable Q&A + FAQ schema', path: '/ai-discovery/answerable-qa' },
  { id: 'feed', label: 'Catalog / feed readiness', path: '/ai-discovery/feed' },
];

// Bottom utility links
const utilityLinks = [
  { id: 'fix-center', label: 'Fix Center', icon: <Wrench size={16} strokeWidth={2} /> },
  { id: 'integrations', label: 'Integrations', icon: <Puzzle size={16} strokeWidth={2} /> },
  { id: 'reports', label: 'Reports', icon: <BarChart3 size={16} strokeWidth={2} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={16} strokeWidth={2} /> },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const pillars = dashboardMockData.pillars;
  const [expandedPillars, setExpandedPillars] = useState<Record<string, boolean>>({});

  const isSeoSection = location.pathname.startsWith('/seo');

  // Map pillar keys to their sub-routes
  const pillarSubRoutes: Record<string, Array<{ id: string; label: string; path: string }>> = {
    seo: seoSubRoutes,
    content: contentSubRoutes,
    speed: speedSubRoutes,
    cro: croSubRoutes,
    'ai-discovery': aiDiscoverySubRoutes,
  };

  // Auto-expand SEO if we're on an SEO route
  const isSeoExpanded = expandedPillars['seo'] ?? isSeoSection;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-[260px] bg-surface-100 flex flex-col
          border-r border-surface-200
          transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Logo Area */}
        <div className="flex items-center justify-between h-16 px-5 flex-shrink-0 border-b border-surface-200">
          <NavLink to="/" className="flex items-center gap-3">
            <div className="w-7 h-7 bg-indigo-600 rounded flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-xs tracking-tight">S</span>
            </div>
            <span className="text-surface-900 font-extrabold tracking-tight text-lg">
              Scorelo
            </span>
          </NavLink>
          <button
            onClick={onClose}
            className="lg:hidden text-surface-500 hover:text-surface-900 p-1 rounded-md hover:bg-surface-200 transition-colors"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto sidebar-scroll py-4 px-3">
          {/* Dashboard Link */}
          <div className="mb-4">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `
                flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13px] font-semibold
                transition-colors duration-150
                ${isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-surface-600 hover:text-surface-900 hover:bg-surface-200/50'
                }
              `}
            >
              <span className="flex-shrink-0">
                <LayoutDashboard size={16} strokeWidth={2} />
              </span>
              Dashboard
            </NavLink>
          </div>

          {/* Pillar Navigation */}
          <div className="space-y-0.5">
            {pillars.map((pillar: PillarScore) => {
              const icon = pillarIcons[pillar.key];
              const route = pillarRoutes[pillar.key];
              const isPillarActive = location.pathname.startsWith(route);

              // Special handling for SEO — it has sub-routes
              if (pillar.key === 'seo') {
                return (
                  <div key={pillar.key}>
                    {/* SEO Pillar Row */}
                    <button
                      onClick={() => {
                        navigate('/seo');
                        setExpandedPillars((prev) => ({ ...prev, seo: true }));
                      }}
                      className={`
                        flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13px] font-semibold
                        transition-colors duration-150 group
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-surface-300
                        ${isSeoSection
                          ? 'bg-surface-100 text-surface-800'
                          : 'text-surface-600 hover:text-surface-900 hover:bg-surface-200/50'
                        }
                      `}
                    >
                      <span className={`flex-shrink-0 ${isSeoSection ? 'text-surface-700' : 'text-surface-500 group-hover:text-surface-700'}`}>
                        {icon}
                      </span>
                      <span className="flex-1 text-left">{pillar.label}</span>
                      <span className="text-surface-400 flex-shrink-0">
                        {isSeoExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                    </button>

                    {/* SEO Sub-Pillar Routes */}
                    {isSeoExpanded && (
                      <ul className="mt-1 mb-2 ml-4 pl-4 border-l-2 border-surface-200 space-y-0.5">
                        {seoSubRoutes.map((sub) => (
                          <li key={sub.id}>
                            <NavLink
                              to={sub.path}
                              end={sub.path === '/seo'}
                              className={({ isActive }) => `
                                block w-full text-left px-3 py-1.5 rounded-md text-[12px] font-medium
                                transition-colors duration-150
                                focus:outline-none focus-visible:ring-2 focus-visible:ring-surface-300
                                ${isActive
                                  ? 'text-surface-800 bg-surface-100/60 font-semibold'
                                  : 'text-surface-500 hover:text-surface-800 hover:bg-surface-200/40'
                                }
                              `}
                            >
                              {sub.label}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              }

              // Other pillars with sub-routes
              const subRoutes = pillarSubRoutes[pillar.key];
              return (
                <div key={pillar.key}>
                  <button
                    onClick={() => {
                      navigate(route);
                      setExpandedPillars((prev) => ({ ...prev, [pillar.key]: true }));
                    }}
                    className={`
                      flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13px] font-semibold
                      transition-colors duration-150 group
                      ${isPillarActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-surface-600 hover:text-surface-900 hover:bg-surface-200/50'
                      }
                    `}
                  >
                    <span className={`flex-shrink-0 ${isPillarActive ? 'text-indigo-600' : 'text-surface-500 group-hover:text-surface-700'}`}>
                      {icon}
                    </span>
                    <span className="flex-1 text-left">{pillar.label}</span>
                    <span className="text-surface-400 flex-shrink-0">
                      {expandedPillars[pillar.key] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  </button>

                  {/* Sub-Pillar Routes */}
                  {expandedPillars[pillar.key] && subRoutes && subRoutes.length > 0 && (
                    <ul className="mt-1 mb-2 ml-4 pl-4 border-l-2 border-surface-200 space-y-0.5">
                      {subRoutes.map((sub) => (
                        <li key={sub.id}>
                          <NavLink
                            to={sub.path}
                            className={({ isActive }) => `
                              block w-full text-left px-3 py-1.5 rounded-md text-[12px] font-medium
                              transition-colors duration-150
                              ${isActive
                                ? 'text-indigo-700 bg-indigo-50/60 font-semibold'
                                : 'text-surface-500 hover:text-surface-800 hover:bg-surface-200/40'
                              }
                            `}
                          >
                            {sub.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          {/* Separator */}
          <div className="my-4 border-t border-surface-200" />

          {/* Utility Links */}
          <div className="space-y-0.5">
            {utilityLinks.map((link) => (
              <NavLink
                key={link.id}
                to={`/${link.id}`}
                className={({ isActive }) => `flex items-center gap-3 w-full px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 group ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-surface-500 hover:text-surface-900 hover:bg-surface-200/50'}`}
              >
                <span className="text-surface-400 group-hover:text-surface-600 flex-shrink-0">
                  {link.icon}
                </span>
                {link.label}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* User Profile Bottom Area */}
        <div className="flex-shrink-0 border-t border-surface-200 p-3">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-surface-200/50 transition-colors cursor-pointer group">
            <div className="w-8 h-8 rounded bg-surface-200 flex items-center justify-center flex-shrink-0 border border-surface-300 text-surface-700">
              <span className="text-[11px] font-bold">JD</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-surface-900 truncate">
                John Doe
              </p>
              <p className="text-[11px] font-medium text-surface-500 truncate">
                Free Plan
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
