/**
 * Web Settings stores the same `preferences` blob native Foyer Settings does.
 * PATCH /profile/ replaces the whole object, so hidden values (privacy editors,
 * theme, distance, newMatches) are carried through and never rewritten from defaults
 * the screen no longer shows.
 */

export interface NotificationSettings {
  pushNotifications: boolean;
  emailNotifications: boolean;
  activityReminders: boolean;
  /** Kept for the stored blob. Foyer Settings does not show or edit this. */
  newMatches: boolean;
  messages: boolean;
  [key: string]: unknown;
}

/** Opaque pass-through of `preferences.privacy`. Settings does not edit it. */
export type StoredPrivacy = Record<string, unknown>;

export interface PreferenceSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  distanceUnit: 'miles' | 'kilometers';
  maxDistance: number;
  [key: string]: unknown;
}

export interface UserSettings {
  notifications: NotificationSettings;
  /** Undefined when the account has no stored privacy blob. */
  privacy?: StoredPrivacy;
  preferences: PreferenceSettings;
}

export const SUPPORT_EMAIL = 'support@irlobby.com';
export const FEEDBACK_SUBJECT = 'The Foyer beta feedback';

export const defaultNotificationSettings: NotificationSettings = {
  pushNotifications: true,
  emailNotifications: true,
  activityReminders: true,
  newMatches: true,
  messages: true,
};

export const defaultPreferenceSettings: PreferenceSettings = {
  theme: 'system',
  language: 'English',
  distanceUnit: 'miles',
  maxDistance: 25,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const settingsFromProfilePreferences = (preferences: unknown): UserSettings => {
  const record = isRecord(preferences) ? preferences : {};
  const { notifications, privacy, ...preferenceOverrides } = record;
  const notificationOverrides = isRecord(notifications) ? notifications : {};
  // Match native: keep a stored object (including unknown keys); never invent one.
  const storedPrivacy =
    privacy && typeof privacy === 'object' ? (privacy as StoredPrivacy) : undefined;

  return {
    notifications: {
      ...defaultNotificationSettings,
      ...notificationOverrides,
    },
    ...(storedPrivacy ? { privacy: storedPrivacy } : {}),
    preferences: {
      ...defaultPreferenceSettings,
      ...preferenceOverrides,
    },
  };
};

export const toSettingsPayload = (settings: UserSettings) => ({
  preferences: {
    ...settings.preferences,
    notifications: settings.notifications,
    ...(settings.privacy ? { privacy: settings.privacy } : {}),
  },
});

/** Same address and subject as native Foyer Settings and the public /support page. */
export const feedbackMailto = () => {
  const body = ['', '', '---', 'The Foyer web'].join('\n');
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(FEEDBACK_SUBJECT)}&body=${encodeURIComponent(body)}`;
};
