import { AlertCircle, Bell, CheckCircle2, FileText, TrendingUp, type LucideIcon } from 'lucide-react';
import { api } from '../lib/api';

export interface NotificationRecord {
  id: number;
  type: string;
  title: string;
  message: string;
  tone: 'neutral' | 'success' | 'warning' | 'critical' | 'info';
  isRead: boolean;
  createdAt: string;
}

const iconByType: Record<string, LucideIcon> = {
  analysis_complete: CheckCircle2,
  critical_issue: AlertCircle,
  score_change: TrendingUp,
  integration_alert: AlertCircle,
  weekly_summary: FileText,
};

export function iconForNotification(type: string): LucideIcon {
  return iconByType[type] ?? Bell;
}

export function formatNotificationTime(isoDate: string): string {
  const date = new Date(isoDate);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

export const fetchNotifications = () => api.get<NotificationRecord[]>('/notifications');

export const markNotificationAsRead = (id: number) => api.patch<NotificationRecord>(`/notifications/${id}/read`);

export const markAllNotificationsAsRead = () => api.patch<NotificationRecord[]>('/notifications/read-all');
