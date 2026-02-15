import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Alert, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Button, HelperText, Surface, Switch, Text } from 'react-native-paper';
import { API_ROUTES } from '@shared/schema';

import { useAuth } from '@hooks/useAuth';
import { api } from '@services/apiClient';
import { getErrorMessage } from '@utils/error';

interface NotificationSettings {
  pushNotifications: boolean;
  emailNotifications: boolean;
  activityReminders: boolean;
  newMatches: boolean;
  messages: boolean;
}

interface PrivacySettings {
  profileVisibility: 'public' | 'friends' | 'private';
  locationSharing: boolean;
  showAge: boolean;
  showEmail: boolean;
}

interface PreferenceSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  distanceUnit: 'miles' | 'kilometers';
  maxDistance: number;
}

interface UserSettings {
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

const defaultSettings: UserSettings = {
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

const loadSettings = async (): Promise<UserSettings> => {
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

export const SettingsScreen = () => {
  const { signOut } = useAuth();

  const { data, isLoading, refetch, isRefetching, error } = useQuery({
    queryKey: ['mobile-settings'],
    queryFn: loadSettings,
  });

  const updateMutation = useMutation({
    mutationFn: async (next: UserSettings) => {
      await api.patch(API_ROUTES.USER_PROFILE, toPayload(next));
    },
    onSuccess: async () => {
      await refetch();
    },
  });

  const exportDataMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get<Record<string, unknown>>(API_ROUTES.USER_PROFILE_EXPORT);
      return response.data;
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      await api.delete(API_ROUTES.USER_PROFILE_DELETE);
    },
    onSuccess: async () => {
      await signOut();
    },
  });

  const settings = useMemo(() => data ?? defaultSettings, [data]);

  const toggleSetting = (
    section: 'notifications' | 'privacy',
    key: keyof NotificationSettings | keyof PrivacySettings,
  ) => {
    const currentValue =
      section === 'notifications'
        ? settings.notifications[key as keyof NotificationSettings]
        : settings.privacy[key as keyof PrivacySettings];

    const next = {
      ...settings,
      [section]: {
        ...settings[section],
        [key]: !currentValue,
      },
    } as UserSettings;

    updateMutation.mutate(next);
  };

  const handleExportData = async () => {
    try {
      const payload = await exportDataMutation.mutateAsync();
      const exportDate = new Date().toISOString().split('T')[0];
      await Share.share({
        title: 'IRLobby Data Export',
        message: JSON.stringify(
          {
            exportDate,
            data: payload,
          },
          null,
          2,
        ),
      });
    } catch (error) {
      console.warn('[SettingsScreen] Export failed', error);
    }
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteAccountMutation.mutate();
          },
        },
      ],
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text variant="headlineSmall">Settings</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Manage notification and privacy preferences.
      </Text>

      {(isLoading || isRefetching) && <Text>Loading settings...</Text>}

      {error && (
        <HelperText type="error" visible>
          {getErrorMessage(error, 'Unable to load settings.')}
        </HelperText>
      )}

      {updateMutation.error && (
        <HelperText type="error" visible>
          {getErrorMessage(updateMutation.error, 'Unable to save settings.')}
        </HelperText>
      )}

      {exportDataMutation.error && (
        <HelperText type="error" visible>
          {getErrorMessage(exportDataMutation.error, 'Unable to export your data.')}
        </HelperText>
      )}

      {deleteAccountMutation.error && (
        <HelperText type="error" visible>
          {getErrorMessage(deleteAccountMutation.error, 'Unable to delete your account.')}
        </HelperText>
      )}

      <Surface elevation={1} style={styles.card}>
        <Text variant="titleMedium">Notifications</Text>
        <View style={styles.row}>
          <Text>Push notifications</Text>
          <Switch
            value={settings.notifications.pushNotifications}
            onValueChange={() => toggleSetting('notifications', 'pushNotifications')}
          />
        </View>
        <View style={styles.row}>
          <Text>Email notifications</Text>
          <Switch
            value={settings.notifications.emailNotifications}
            onValueChange={() => toggleSetting('notifications', 'emailNotifications')}
          />
        </View>
        <View style={styles.row}>
          <Text>New matches</Text>
          <Switch
            value={settings.notifications.newMatches}
            onValueChange={() => toggleSetting('notifications', 'newMatches')}
          />
        </View>
      </Surface>

      <Surface elevation={1} style={styles.card}>
        <Text variant="titleMedium">Privacy</Text>
        <View style={styles.row}>
          <Text>Location sharing</Text>
          <Switch
            value={settings.privacy.locationSharing}
            onValueChange={() => toggleSetting('privacy', 'locationSharing')}
          />
        </View>
        <View style={styles.row}>
          <Text>Show age</Text>
          <Switch
            value={settings.privacy.showAge}
            onValueChange={() => toggleSetting('privacy', 'showAge')}
          />
        </View>
        <View style={styles.row}>
          <Text>Show email</Text>
          <Switch
            value={settings.privacy.showEmail}
            onValueChange={() => toggleSetting('privacy', 'showEmail')}
          />
        </View>
      </Surface>

      <View style={styles.actions}>
        <Button mode="outlined" onPress={() => void refetch()} loading={isRefetching}>
          Refresh settings
        </Button>
        <Button
          mode="contained-tonal"
          onPress={() => void handleExportData()}
          loading={exportDataMutation.isPending}
          disabled={exportDataMutation.isPending || deleteAccountMutation.isPending}
        >
          Export my data
        </Button>
        <Button
          mode="contained"
          onPress={confirmDeleteAccount}
          loading={deleteAccountMutation.isPending}
          disabled={deleteAccountMutation.isPending || exportDataMutation.isPending}
        >
          Delete account
        </Button>
        <Button mode="text" onPress={() => void signOut()}>
          Sign out
        </Button>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  subtitle: {
    opacity: 0.75,
  },
  card: {
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actions: {
    marginTop: 8,
    gap: 8,
  },
});
