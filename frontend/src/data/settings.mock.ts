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
  // Server-owned account facts. They are carried in the draft so the Profile panel can render
  // them beside the editable fields, but nothing in the UI writes them — they are echoed back
  // unchanged by every save, which keeps the dirty check (a deep compare of saved vs draft)
  // honest rather than permanently dirty.
  /** ISO timestamp of account creation. */
  createdAt: string;
  /** False while the address has never been confirmed. */
  emailVerified: boolean;
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
// `usage` was removed rather than updated: every entry was an invented consumption figure
// (1,342 of 2,000 pages, 4 of 6 integrations) rendered as a filled meter, and nothing in the
// product measures those. The Settings card now states that usage tracking is not connected.
/**
 * Scorelo has NO billing system: no provider, no subscriptions table, no plan API. Every
 * account is on the same free tier, so "Free plan" is TRUE — but the previous "PKR 0 per
 * month" invented a price and billing cadence for a system that does not exist. This object
 * now states only what is real, and must be replaced by a billing API when one is built.
 */
export const planInfo = {
  name: 'Free',
  price: '',
  cadence: '',
  description: 'All features are currently included. Paid plans are not available yet.',
};
