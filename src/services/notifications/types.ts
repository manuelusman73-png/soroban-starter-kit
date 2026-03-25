export type NotificationChannel = 'in-app' | 'push' | 'email';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';
export type AlertRuleOperator = 'equals' | 'greater' | 'less' | 'contains';

export interface Notification {
  id: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  category: string;
  timestamp: number;
  read: boolean;
  actionUrl?: string;
}

export interface UserPreferences {
  userId: string;
  enabledChannels: NotificationChannel[];
  priorityThreshold: NotificationPriority;
  quietHours?: { start: number; end: number };
  categories: Record<string, boolean>;
  frequency: 'instant' | 'hourly' | 'daily' | 'weekly';
}

export interface AlertRule {
  id: string;
  name: string;
  condition: {
    field: string;
    operator: AlertRuleOperator;
    value: unknown;
  };
  action: {
    channels: NotificationChannel[];
    priority: NotificationPriority;
    category: string;
  };
  enabled: boolean;
  createdAt: number;
}

export interface NotificationAnalytics {
  id: string;
  notificationId: string;
  action: 'sent' | 'delivered' | 'read' | 'clicked' | 'dismissed';
  channel: NotificationChannel;
  timestamp: number;
  duration?: number;
}

export interface NotificationSchedule {
  id: string;
  notificationId: string;
  scheduledTime: number;
  status: 'pending' | 'sent' | 'failed';
  retries: number;
}
