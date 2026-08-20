import { dashboardMockData, type DashboardData } from './dashboard.mock';

/**
 * Simulates an async API call to fetch dashboard data.
 * In production, this would call the actual Scorelo API.
 */
export async function fetchDashboardData(): Promise<DashboardData> {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 800));
  return dashboardMockData;
}

/**
 * Formats relative time from an ISO date string.
 */
export function formatLastUpdated(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

/**
 * Returns semantic color class prefix for a score status.
 */
export function getScoreColorClass(score: number): string {
  if (score >= 90) return 'success';
  if (score >= 75) return 'brand';
  if (score >= 50) return 'warning';
  return 'critical';
}
