import { ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

const routeLabels: Record<string, string> = {
  seo: 'SEO',
  content: 'Content',
  speed: 'Speed',
  cro: 'CRO',
  'ai-discovery': 'AI Discovery',
  'title-tags': 'Title Tags',
  'meta-descriptions': 'Meta Descriptions',
  schema: 'Schema / JSON-LD',
  'image-alt-text': 'Image Alt Text',
  canonicals: 'Canonicals & Duplicates',
  'handles-redirects': 'Handles & Redirects',
  sitemap: 'Sitemap & Indexability',
  'internal-links': 'Internal Links & 404s',
  'product-descriptions': 'Product Descriptions',
  'collection-descriptions': 'Collection Descriptions',
  metafields: 'Metafield Completeness',
  'dup-templated': 'Duplicate / Templated Copy',
  'blog-freshness': 'Blog Freshness',
  'media-richness': 'Media Richness',
  cwv: 'Core Web Vitals',
  'image-weight': 'Image Optimization',
  'app-bloat': 'App & Script Bloat',
  'theme-weight': 'Theme Weight / Fonts / Lazy-load',
  clarity: 'Clarity / Behavior Readiness',
  'cart-recovery': 'Cart Recovery',
  trust: 'Trust & Social Proof',
  returns: 'Returns Flow',
  tracking: 'Order Tracking',
  cod: 'COD Checkout Quality',
  options: 'Product Options / Add-ons',
  subscription: 'Subscription Opportunity',
  wishlist: 'Wishlist',
  locator: 'Store Locator',
  'mobile-ux': 'Mobile UX',
  'agents-md': 'agents.md / llms.txt',
  'agentic-attrs': 'Agentic Commerce Attributes',
  'answerable-qa': 'Answerable Q&A + FAQ Schema',
  feed: 'Catalog / Feed Readiness',
  'fix-center': 'Fix Center',
  integrations: 'Integrations',
  reports: 'Reports',
  settings: 'Settings',
  notifications: 'Notifications',
};

function labelFor(segment: string) {
  return routeLabels[segment] ?? segment.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

interface BreadcrumbsProps {
  compact?: boolean;
}

export default function Breadcrumbs({ compact = false }: BreadcrumbsProps) {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);
  const items: BreadcrumbItem[] = [{ label: 'Dashboard', href: '/' }];

  segments.forEach((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join('/')}`;
    items.push({ label: labelFor(segment), href: index === segments.length - 1 ? undefined : href });
  });

  return (
    <nav aria-label="Breadcrumb" className={compact ? 'min-w-0' : 'mx-auto w-full max-w-7xl px-5 pt-4 md:px-8'}>
      <ol className="flex min-w-0 items-center gap-1 overflow-hidden text-xs text-surface-500">
        {items.map((item, index) => (
          <li key={item.href ?? item.label} className="flex min-w-0 items-center gap-1">
            {index > 0 && <ChevronRight size={13} className="flex-shrink-0 text-surface-300" aria-hidden="true" />}
            {item.href ? (
              <Link to={item.href} className="truncate rounded px-1 py-0.5 transition-colors hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                {item.label}
              </Link>
            ) : (
              <span className="truncate px-1 py-0.5 font-medium text-surface-800" aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}