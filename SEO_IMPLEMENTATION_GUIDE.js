#!/usr/bin/env node
/**
 * SEO Pillar Pages - Implementation Guide & Component Template
 * 
 * This guide provides:
 * 1. Complete component patterns for each sub-pillar page
 * 2. Data source references
 * 3. Color usage guidelines (light, not colorful)
 * 4. Responsive layout patterns
 * 5. Interaction patterns
 */

// ─── PATTERN 1: PAGE STRUCTURE ──────────────────────────────────────
/*
Every SEO sub-pillar page follows this structure:

1. HEADER SECTION (sticky, z-40)
   - Back button
   - Page title (h1)
   - Description
   - Score component (right-aligned)

2. MAIN CONTENT (max-w-7xl mx-auto, px-8, py-8)
   
   A. Primary Metrics Row
      - 4-6 KPI cards
      - Grid: md:grid-cols-2 lg:grid-cols-3
      - Use SeoKpiCard component
   
   B. Dual Analysis Sections (if applicable)
      - Grid: lg:grid-cols-2 gap-6
      - White cards with border-surface-200
      - Clear section headings
   
   C. Deep Dive Analysis
      - Full-width card
      - Table or detailed breakdown
   
   D. Issues/Data Table
      - Overflow-x-auto for mobile
      - Hover effects (hover:bg-surface-50)
      - Severity badges with consistent colors
*/

// ─── PATTERN 2: COLOR USAGE (Light Only) ────────────────────────────
const colorPattern = {
  // Backgrounds
  backgrounds: {
    page: 'bg-surface-50',      // Entire page
    card: 'bg-white',           // Card/section backgrounds
    section: 'bg-surface-50',   // Within card sections
    hover: 'hover:bg-surface-50', // Interactive elements
  },
  
  // Borders
  borders: {
    primary: 'border-surface-200',   // Card borders
    divider: 'border-surface-100',   // Between items
  },
  
  // Status Colors (Semantic, NOT rainbow)
  status: {
    success: 'bg-success-100 text-success-700',    // Optimized, good
    warning: 'bg-warning-100 text-warning-700',    // Issues, needs work
    critical: 'bg-critical-100 text-critical-700', // Errors, critical
    info: 'bg-info-100 text-info-700',             // Information, neutral
  },
  
  // Accent
  accent: 'text-brand-600 hover:text-brand-700',    // Links, CTAs
};

// ─── PATTERN 3: COMPONENT USAGE ─────────────────────────────────────
const componentUsage = {
  SeoScore: {
    purpose: 'Large circular score with status',
    usage: '<SeoScore score={84} label="On-Page SEO" size="md" />',
    props: {
      score: 'number (0-100)',
      label: 'string',
      size: '"sm" | "md" | "lg"',
    },
  },
  
  SeoKpiCard: {
    purpose: 'Small metric card with trend',
    usage: `<SeoKpiCard 
      label="Optimized Pages" 
      value="1,128" 
      subtitle="following best practices"
    />`,
    props: {
      label: 'string (KPI name)',
      value: 'string (with formatting)',
      trend: 'string (optional, e.g. "+12.5%")',
      trendDirection: '"up" | "down" | "stable"',
      subtitle: 'string (optional, secondary text)',
      breakdown: 'array (optional, for breakdowns)',
    },
  },
  
  SeoHealthBar: {
    purpose: 'Horizontal progress bar for health metrics',
    usage: `<SeoHealthBar 
      pillar="On-Page SEO" 
      score={84} 
      status="Good"
      change={5}
    />`,
  },
};

// ─── PATTERN 4: DATA SOURCES ────────────────────────────────────────
const dataSources = {
  overview: 'seoDashboardMockData.kpis',
  health: 'seoDashboardMockData.healthCategories',
  trends: 'seoDashboardMockData.trendData',
  
  // Specific sub-pillar data:
  technical: 'technicalSeoData (from seo.mock.ts)',
  onPage: 'onPageSeoData (from seo.mock.ts)',
  content: 'contentSeoData (from seo.mock.ts)',
  linking: 'internalLinkingData (from seo.mock.ts)',
  authority: 'authorityData (from seo.mock.ts)',
  local: 'localSeoData (from seo.mock.ts)',
  ai: 'aiVisibilityData (from seo.mock.ts)',
  
  // Cross-cutting data:
  issues: 'priorityIssues (filtered by pillar)',
  pages: 'topPerformingPages',
  keywords: 'keywordPerformance',
};

// ─── PATTERN 5: PAGE-SPECIFIC SECTIONS ──────────────────────────────

const pagePatterns = {
  Technical_SEO: {
    metrics: ['Indexed Pages', 'Crawl Errors', 'Critical Issues', 'Warnings', 'Passed Checks'],
    sections: [
      {
        title: 'Crawlability',
        data: 'technicalSeoData.crawlability',
        layout: 'key-value pairs with icons',
      },
      {
        title: 'Indexability',
        data: 'technicalSeoData.indexability',
        layout: 'key-value pairs with coverage percentage',
      },
      {
        title: 'Core Web Vitals',
        data: 'technicalSeoData.coreWebVitals',
        layout: 'grid of 3 metrics (LCP, INP, CLS)',
      },
      {
        title: 'Technical Issues',
        data: 'priorityIssues filtered by Technical SEO',
        layout: 'detailed list with severity badges',
      },
    ],
  },

  OnPage_SEO: {
    metrics: ['Pages Analyzed', 'Optimized Pages', 'Needs Attention', 'Duplicate Metadata', 'Optimization Rate'],
    sections: [
      {
        title: 'Title Tag Health',
        data: 'onPageSeoData.titleTags',
        layout: 'breakdown: optimized, missing, too long, too short, duplicate',
      },
      {
        title: 'Meta Description Health',
        data: 'onPageSeoData.metaDescriptions',
        layout: 'same breakdown as title tags',
      },
      {
        title: 'On-Page Issues',
        data: 'priorityIssues filtered by On-Page SEO',
        layout: 'detailed list with affected pages',
      },
      {
        title: 'Pages Needing Optimization',
        data: 'topPerformingPages with optimization status',
        layout: 'table with title, meta, h1, images status columns',
      },
    ],
  },

  Content_SEO: {
    metrics: ['Content Pages', 'Thin Content', 'Content Gaps', 'Outdated Pages', 'Avg Word Count'],
    sections: [
      {
        title: 'Content Quality Distribution',
        data: 'contentSeoData quality breakdown',
        layout: 'grid of 4 cards: Excellent, Good, Needs Work, Poor',
      },
      {
        title: 'Topic Coverage',
        data: 'contentSeoData topics',
        layout: 'topic clusters with coverage percentage',
      },
      {
        title: 'Content Gaps',
        data: 'seoOpportunities filtered by content',
        layout: 'list of missing topics with search volume',
      },
      {
        title: 'Underperforming Content',
        data: 'topPerformingPages with traffic decline indicators',
        layout: 'table showing traffic, content score, recommendations',
      },
    ],
  },

  Internal_Linking: {
    metrics: ['Internal Links', 'Orphan Pages', 'Broken Links', 'Link Opportunities', 'Avg Links/Page'],
    sections: [
      {
        title: 'Internal Link Health',
        data: 'internalLinkingData',
        layout: 'key-value breakdown',
      },
      {
        title: 'Orphan Pages',
        data: 'calculated from topPerformingPages',
        layout: 'table: URL, Traffic, Importance, Recommendations',
      },
      {
        title: 'Broken Internal Links',
        data: 'priorityIssues filtering',
        layout: 'table: Source, Target, Status, Impact',
      },
      {
        title: 'Internal Link Opportunities',
        data: 'seoOpportunities filtered by linking',
        layout: 'list: Source, Target, Relevance, Opportunity Level',
      },
    ],
  },

  Authority_Backlinks: {
    metrics: ['Backlinks', 'Referring Domains', 'New Backlinks', 'Lost Backlinks', 'Authority Score'],
    sections: [
      {
        title: 'Backlink Growth',
        data: 'authorityData.backlinksGrowth',
        layout: 'line chart with dual axis (backlinks, domains)',
      },
      {
        title: 'Referring Domains',
        data: 'backlinks array',
        layout: 'table: Domain, Authority, Backlinks, Traffic, First Seen',
      },
      {
        title: 'New Backlinks',
        data: 'backlinks filtered by status: new',
        layout: 'table with trend indicators',
      },
      {
        title: 'High-Value Backlinks',
        data: 'backlinks filtered by authority > 75',
        layout: 'featured list with authority scores',
      },
    ],
  },

  Local_SEO: {
    metrics: ['Local Visibility', 'Locations', 'Listings Complete', 'Reviews', 'Avg Rating'],
    sections: [
      {
        title: 'Local Visibility Trend',
        data: 'localSeoData',
        layout: 'line chart over time',
      },
      {
        title: 'Local Rankings by Location',
        data: 'localSeoData.locations_data',
        layout: 'table: Location, Visibility %, Keywords, Reviews',
      },
      {
        title: 'Business Listings Status',
        data: 'localSeoData.listingsComplete',
        layout: 'progress: Complete %, Incomplete %, Inconsistent %',
      },
      {
        title: 'Reviews Summary',
        data: 'localSeoData',
        layout: 'summary cards: Total, Avg Rating, New This Month, Trend',
      },
    ],
  },

  AI_Search_Visibility: {
    metrics: ['AI Visibility Score', 'AI Mentions', 'Citation Rate', 'Queries Tracked', 'Competitor Mentions'],
    sections: [
      {
        title: 'AI Visibility Trend',
        data: 'aiVisibilityData.aiVisibilityTrend',
        layout: 'line chart showing growth over time',
      },
      {
        title: 'AI Search Queries Tracked',
        data: 'calculated from queries',
        layout: 'list: Query, Brand Mentioned (Yes/No), Position, Competitors',
      },
      {
        title: 'AI Competitor Comparison',
        data: 'competitors array',
        layout: 'table: Brand, Mentions, Citations, Visibility',
      },
      {
        title: 'Missing AI Visibility Opportunities',
        data: 'seoOpportunities filtered by AI',
        layout: 'cards showing gaps vs competitors',
      },
    ],
  },
};

// ─── PATTERN 6: RESPONSIVE GRID SYSTEM ──────────────────────────────
const responsivePatterns = {
  KPISixColumn: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
  TwoPanelLayout: 'grid lg:grid-cols-2 gap-6',
  ThreePanelLayout: 'grid lg:grid-cols-3 gap-6',
  FourPanelLayout: 'grid md:grid-cols-2 lg:grid-cols-4 gap-4',
  FullWidthTable: 'overflow-x-auto for mobile', // Tables scroll horizontally on mobile
};

// ─── PATTERN 7: STYLING CONSTANTS ───────────────────────────────────
const stylingConstants = {
  card: 'bg-white rounded-lg border border-surface-200 overflow-hidden',
  cardHeader: 'px-6 py-5 border-b border-surface-200',
  cardContent: 'p-6',
  headerTitle: 'text-lg font-bold text-surface-900',
  headerSubtitle: 'text-xs text-surface-500 mt-1',
  sectionGap: 'mb-8',
  tableHeader: 'bg-surface-50 border-b border-surface-200',
  tableRow: 'hover:bg-surface-50 transition-colors',
  badge: 'px-2 py-1 rounded text-xs font-bold',
};

// ─── PATTERN 8: INTERACTION STATES ──────────────────────────────────
const interactionStates = {
  buttons: {
    primary: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
    secondary: 'bg-surface-100 text-surface-700 hover:bg-surface-200',
  },
  links: {
    default: 'text-brand-600 hover:text-brand-700',
  },
  rows: {
    default: 'hover:bg-surface-50 transition-colors cursor-pointer',
  },
};

// ─── CHECKLIST FOR IMPLEMENTING EACH PAGE ───────────────────────────
const implementationChecklist = `
For each sub-pillar page (Technical, On-Page, Content, Internal Linking, Authority, Local, AI):

□ Create page file in src/pages/seo/[SubpillarName]Page.tsx
□ Import: useNavigate, SeoScore, SeoKpiCard, data from seo.mock
□ Build header with back button and page title
□ Display main score using SeoScore component
□ Create 4-6 KPI cards with relevant metrics
□ Add 2-3 specialized analysis sections
□ Add detailed issues table/list filtered by pillar
□ Ensure all data comes from seoDashboardMockData or specific pillar data
□ Use light colors only (surface, success, warning, critical, info)
□ Test responsive: 390px, 768px, 1024px, 1440px
□ Verify no dead navigation
□ Check all hover states work
□ Ensure consistency with other sub-pillar pages
`;

console.log('SEO Pillar Implementation Guide Ready');
console.log('See implementation-guide.txt for full patterns and templates');
