// ─── Settings · data model ───────────────────────────────────────────
// Types and static option lists / copy only. The actual settings values
// (profile/workspace/analysis/notifications/appearance) are fetched
// from the real API — see data/settings.repository.ts.

/**
 * Whether a settings group is backed by real behaviour in this build.
 * Anything 'preview' renders read-only with an explanation — never a
 * button that looks functional but does nothing.
 */
export type Availability = 'live' | 'preview';

export interface ProfileSettings {
  fullName: string;
  email: string;
  jobTitle: string;
  role: 'Administrator' | 'Editor' | 'Viewer';
}

export interface WorkspaceSettings {
  workspaceName: string;
  storeName: string;
  storeUrl: string;
  platform: string;
  industry: string;
  country: string;
  timezone: string;
  currency: string;
}

export type AnalysisFrequency = 'Daily' | 'Weekly' | 'Fortnightly' | 'Monthly';
export type CrawlScope = 'Entire store' | 'Products & collections only' | 'Key templates only';

export interface AnalysisSettings {
  autoAnalysis: boolean;
  frequency: AnalysisFrequency;
  crawlScope: CrawlScope;
  pageLimit: number;
  includeBlog: boolean;
  includeCollections: boolean;
  respectRobots: boolean;
}

export interface NotificationSettings {
  analysisComplete: boolean;
  criticalIssues: boolean;
  scoreChanges: boolean;
  weeklySummary: boolean;
  integrationAlerts: boolean;
  productUpdates: boolean;
}

export interface AppearanceSettings {
  density: 'Comfortable' | 'Compact';
  reduceMotion: boolean;
}

export interface SettingsState {
  profile: ProfileSettings;
  workspace: WorkspaceSettings;
  analysis: AnalysisSettings;
  notifications: NotificationSettings;
  appearance: AppearanceSettings;
}

// ─── Option lists ────────────────────────────────────────────────────
export const platformOptions = ['Shopify', 'Shopify Plus', 'WooCommerce', 'BigCommerce', 'Magento', 'Custom'];

export const industryOptions = [
  'Consumer Electronics',
  'Fashion & Apparel',
  'Beauty & Personal Care',
  'Home & Living',
  'Health & Wellness',
  'Sports & Outdoors',
  'Food & Beverage',
  'Other',
];

export const countryOptions = ['Pakistan', 'United States', 'United Kingdom', 'United Arab Emirates', 'Canada', 'Australia', 'Germany'];

export const timezoneOptions = [
  '(UTC+05:00) Karachi',
  '(UTC+00:00) London',
  '(UTC-05:00) New York',
  '(UTC-08:00) Los Angeles',
  '(UTC+04:00) Dubai',
  '(UTC+01:00) Berlin',
];

export const currencyOptions = [
  'PKR — Pakistani Rupee',
  'USD — US Dollar',
  'GBP — British Pound',
  'EUR — Euro',
  'AED — UAE Dirham',
];

export const frequencyOptions: AnalysisFrequency[] = ['Daily', 'Weekly', 'Fortnightly', 'Monthly'];
export const crawlScopeOptions: CrawlScope[] = ['Entire store', 'Products & collections only', 'Key templates only'];

// ─── Notification copy ───────────────────────────────────────────────
// Each toggle carries microcopy explaining exactly what it changes.
export const notificationCopy: {
  key: keyof NotificationSettings;
  group: 'Analysis' | 'Account';
  label: string;
  description: string;
}[] = [
  {
    key: 'analysisComplete',
    group: 'Analysis',
    label: 'Analysis completed',
    description: 'Email you when a scheduled or manual audit finishes and new scores are available.',
  },
  {
    key: 'criticalIssues',
    group: 'Analysis',
    label: 'Critical issues detected',
    description: 'Alert you as soon as an audit finds a critical-severity issue on any pillar.',
  },
  {
    key: 'scoreChanges',
    group: 'Analysis',
    label: 'Significant score changes',
    description: 'Notify you when any pillar score moves by more than 5 points between audits.',
  },
  {
    key: 'weeklySummary',
    group: 'Analysis',
    label: 'Weekly performance summary',
    description: 'A Monday digest covering score movement, resolved issues and what to fix next.',
  },
  {
    key: 'integrationAlerts',
    group: 'Account',
    label: 'Integration problems',
    description: 'Tell you when a connected data source fails to sync or its authorization expires.',
  },
  {
    key: 'productUpdates',
    group: 'Account',
    label: 'Scorelo product updates',
    description: 'Occasional emails about new checks, pillars and features. No marketing.',
  },
];

// ─── Plan (no billing backend — presented read-only) ─────────────────
export const planInfo = {
  name: 'Free',
  price: 'PKR 0',
  cadence: 'per month',
  description: 'One store, weekly audits and the full pillar breakdown.',
  usage: [
    { label: 'Stores', used: 1, limit: 1 },
    { label: 'Pages per audit', used: 1342, limit: 2000 },
    { label: 'Connected integrations', used: 4, limit: 6 },
    { label: 'Team members', used: 1, limit: 1 },
  ],
};
