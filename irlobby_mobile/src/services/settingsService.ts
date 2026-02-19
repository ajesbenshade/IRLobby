import { API_ROUTES } from '@shared/schema';

import { api } from '@services/apiClient';

export interface NotificationSettings {
  pushNotifications: boolean;
  emailNotifications: boolean;
  activityReminders: boolean;
  newMatches: boolean;
  messages: boolean;
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'friends' | 'private';
  locationSharing: boolean;
  showAge: boolean;
  showEmail: boolean;
}

export interface PreferenceSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  distanceUnit: 'miles' | 'kilometers';
  maxDistance: number;
}

export interface UserSettings {
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  preferences: PreferenceSettings;
}

interface UserProfileResponse {
  preferences?: Partial<PreferenceSettings> & {
    notifications?: NotificationSettings;
    privacy?: PrivacySettings;
  };
}

export const defaultSettings: UserSettings = {
  notifications: {
    pushNotifications: true,
    emailNotifications: true,
    activityReminders: true,
    newMatches: true,
    messages: true,
  },
  privacy: {
    profileVisibility: 'public',
    locationSharing: true,
    showAge: true,
    showEmail: false,
  },
  preferences: {
    theme: 'system',
    language: 'English',
    distanceUnit: 'miles',
    maxDistance: 25,
  },
};

const toPayload = (settings: UserSettings) => ({
  preferences: {
    ...settings.preferences,
    notifications: settings.notifications,
    privacy: settings.privacy,
  },
});

export const fetchUserSettings = async (): Promise<UserSettings> => {
  const response = await api.get<UserProfileResponse>(API_ROUTES.USER_PROFILE);
  const preferences = response.data.preferences ?? {};
  const { notifications, privacy, ...preferenceOverrides } = preferences;

  return {
    notifications: {
      ...defaultSettings.notifications,
      ...(notifications ?? {}),
    },
    privacy: {
      ...defaultSettings.privacy,
      ...(privacy ?? {}),
    },
    preferences: {
      ...defaultSettings.preferences,
      ...preferenceOverrides,
    },
  };
};

export const saveUserSettings = async (next: UserSettings): Promise<void> => {
  await api.patch(API_ROUTES.USER_PROFILE, toPayload(next));
};
