import React, { useState, useEffect } from 'react';
import { UserPreferences, NotificationChannel, NotificationPriority } from '../services/notifications/types';
import { notificationManager } from '../services/notifications';

interface PreferencesProps {
  userId: string;
  onSave?: (preferences: UserPreferences) => void;
}

export function NotificationPreferences({ userId, onSave }: PreferencesProps): JSX.Element {
  const [preferences, setPreferences] = useState<UserPreferences>({
    userId,
    enabledChannels: ['in-app'],
    priorityThreshold: 'medium',
    categories: {},
    frequency: 'instant',
  });

  useEffect(() => {
    loadPreferences();
  }, [userId]);

  const loadPreferences = async () => {
    const saved = await notificationManager.getPreferences(userId);
    if (saved) setPreferences(saved);
  };

  const handleSave = async () => {
    await notificationManager.savePreferences(preferences);
    onSave?.(preferences);
  };

  const toggleChannel = (channel: NotificationChannel) => {
    const channels = preferences.enabledChannels.includes(channel)
      ? preferences.enabledChannels.filter(c => c !== channel)
      : [...preferences.enabledChannels, channel];
    setPreferences({ ...preferences, enabledChannels: channels });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Notification Preferences</h3>

      {/* Channels */}
      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
          Delivery Channels
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {(['in-app', 'push', 'email'] as NotificationChannel[]).map(channel => (
            <label key={channel} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={preferences.enabledChannels.includes(channel)}
                onChange={() => toggleChannel(channel)}
              />
              {channel.charAt(0).toUpperCase() + channel.slice(1)}
            </label>
          ))}
        </div>
      </div>

      {/* Priority Threshold */}
      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
          Minimum Priority
        </label>
        <select
          value={preferences.priorityThreshold}
          onChange={(e) => setPreferences({ ...preferences, priorityThreshold: e.target.value as NotificationPriority })}
          style={{
            width: '100%',
            padding: '6px',
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      {/* Frequency */}
      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
          Notification Frequency
        </label>
        <select
          value={preferences.frequency}
          onChange={(e) => setPreferences({ ...preferences, frequency: e.target.value as any })}
          style={{
            width: '100%',
            padding: '6px',
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        >
          <option value="instant">Instant</option>
          <option value="hourly">Hourly</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
      </div>

      {/* Quiet Hours */}
      <div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
          <input
            type="checkbox"
            checked={!!preferences.quietHours}
            onChange={(e) => setPreferences({
              ...preferences,
              quietHours: e.target.checked ? { start: 22, end: 8 } : undefined,
            })}
          />
          Enable Quiet Hours
        </label>
        {preferences.quietHours && (
          <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
            <input
              type="number"
              min="0"
              max="23"
              value={preferences.quietHours.start}
              onChange={(e) => setPreferences({
                ...preferences,
                quietHours: { ...preferences.quietHours!, start: parseInt(e.target.value) },
              })}
              style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
            />
            <span>to</span>
            <input
              type="number"
              min="0"
              max="23"
              value={preferences.quietHours.end}
              onChange={(e) => setPreferences({
                ...preferences,
                quietHours: { ...preferences.quietHours!, end: parseInt(e.target.value) },
              })}
              style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
            />
          </div>
        )}
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        style={{
          padding: '8px 12px',
          backgroundColor: 'var(--color-accent)',
          border: 'none',
          color: 'white',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 600,
        }}
      >
        Save Preferences
      </button>
    </div>
  );
}
