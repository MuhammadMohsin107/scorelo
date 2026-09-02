import { api } from '../lib/api';
import type { StoreRow, UserRow } from './api.types';
import type { SettingsState } from './settings.mock';
import { updateCachedUser } from './user.repository';

/** Backend `stores.url` is a full URL (Zod .url()); the UI field is a bare domain. */
const stripProtocol = (url: string) => url.replace(/^https?:\/\//i, '');
const withProtocol = (domain: string) => (/^https?:\/\//i.test(domain) ? domain : `https://${domain}`);

function toSettingsState(user: UserRow, store: StoreRow): SettingsState {
  return {
    profile: {
      fullName: user.fullName,
      email: user.email,
      jobTitle: user.jobTitle ?? '',
      role: user.role as SettingsState['profile']['role'],
      // Both come straight off the real /users/me row (users.created_at, users.email_verified_at).
      createdAt: user.createdAt,
      emailVerified: user.emailVerifiedAt !== null,
    },
    workspace: {
      workspaceName: store.workspaceName,
      storeName: store.name,
      storeUrl: stripProtocol(store.url),
      platform: store.platform,
      industry: store.industry,
      country: store.country,
      timezone: store.timezone,
      currency: store.currency,
    },
    analysis: {
      autoAnalysis: store.autoAnalysis,
      frequency: store.analysisFrequency as SettingsState['analysis']['frequency'],
      crawlScope: store.crawlScope as SettingsState['analysis']['crawlScope'],
      pageLimit: store.pageLimit,
      includeBlog: store.includeBlog,
      includeCollections: store.includeCollections,
      respectRobots: store.respectRobots,
    },
    notifications: {
      analysisComplete: user.notifyAnalysisComplete,
      criticalIssues: user.notifyCriticalIssues,
      scoreChanges: user.notifyScoreChanges,
      weeklySummary: user.notifyWeeklySummary,
      integrationAlerts: user.notifyIntegrationAlerts,
      productUpdates: user.notifyProductUpdates,
    },
    appearance: {
      density: user.density,
      reduceMotion: user.reduceMotion,
    },
  };
}

export async function fetchSettings(): Promise<SettingsState> {
  const [user, store] = await Promise.all([
    api.get<UserRow>('/users/me'),
    api.get<StoreRow>('/stores/current'),
  ]);
  return toSettingsState(user, store);
}

export async function persistSettings(next: SettingsState): Promise<SettingsState> {
  const [user, store] = await Promise.all([
    api.put<UserRow>('/users/me', {
      fullName: next.profile.fullName,
      email: next.profile.email,
      jobTitle: next.profile.jobTitle || null,
      notifyAnalysisComplete: next.notifications.analysisComplete,
      notifyCriticalIssues: next.notifications.criticalIssues,
      notifyScoreChanges: next.notifications.scoreChanges,
      notifyWeeklySummary: next.notifications.weeklySummary,
      notifyIntegrationAlerts: next.notifications.integrationAlerts,
      notifyProductUpdates: next.notifications.productUpdates,
      density: next.appearance.density,
      reduceMotion: next.appearance.reduceMotion,
    }),
    api.put<StoreRow>('/stores/current', {
      workspaceName: next.workspace.workspaceName,
      name: next.workspace.storeName,
      url: withProtocol(next.workspace.storeUrl),
      platform: next.workspace.platform,
      industry: next.workspace.industry,
      country: next.workspace.country,
      timezone: next.workspace.timezone,
      currency: next.workspace.currency,
      autoAnalysis: next.analysis.autoAnalysis,
      analysisFrequency: next.analysis.frequency,
      crawlScope: next.analysis.crawlScope,
      pageLimit: next.analysis.pageLimit,
      includeBlog: next.analysis.includeBlog,
      includeCollections: next.analysis.includeCollections,
      respectRobots: next.analysis.respectRobots,
    }),
  ]);
  updateCachedUser(user);
  return toSettingsState(user, store);
}
