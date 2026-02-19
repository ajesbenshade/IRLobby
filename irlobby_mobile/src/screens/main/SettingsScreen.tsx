import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Alert, ScrollView, Share, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Button, HelperText, SegmentedButtons, Surface, Switch, Text } from 'react-native-paper';
import { API_ROUTES } from '@shared/schema';

import { useAuth } from '@hooks/useAuth';
import { api } from '@services/apiClient';
import {
  defaultSettings,
  fetchUserSettings,
  saveUserSettings,
  type PreferenceSettings,
  type PrivacySettings,
  type NotificationSettings,
  type UserSettings,
} from '@services/settingsService';
import { getErrorMessage } from '@utils/error';

export const SettingsScreen = () => {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching, error } = useQuery({
    queryKey: ['mobile-settings'],
    queryFn: fetchUserSettings,
  });

  const updateMutation = useMutation({
    mutationFn: saveUserSettings,
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: ['mobile-settings'] });
      const previous = queryClient.getQueryData<UserSettings>(['mobile-settings']);
      queryClient.setQueryData(['mobile-settings'], next);
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['mobile-settings'], context.previous);
      }
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

  const updatePreference = <Key extends keyof PreferenceSettings>(
    key: Key,
    value: PreferenceSettings[Key],
  ) => {
    const next = {
      ...settings,
      preferences: {
        ...settings.preferences,
        [key]: value,
      },
    };

    if (key === 'theme') {
      void Haptics.selectionAsync();
    }

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
        <View style={styles.errorContainer}>
          <HelperText type="error" visible>
            {getErrorMessage(error, 'Unable to load settings.')}
          </HelperText>
          <Button mode="outlined" onPress={() => void refetch()} loading={isRefetching}>
            {isRefetching ? 'Retrying...' : 'Retry'}
          </Button>
        </View>
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
        <View style={styles.row}>
          <Text>Activity reminders</Text>
          <Switch
            value={settings.notifications.activityReminders}
            onValueChange={() => toggleSetting('notifications', 'activityReminders')}
          />
        </View>
        <View style={styles.row}>
          <Text>Messages</Text>
          <Switch
            value={settings.notifications.messages}
            onValueChange={() => toggleSetting('notifications', 'messages')}
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
        <View style={styles.rowWrap}>
          <Text>Profile visibility</Text>
          <Button
            mode="outlined"
            compact
            onPress={() => {
              const sequence: PrivacySettings['profileVisibility'][] = ['public', 'friends', 'private'];
              const currentIndex = sequence.indexOf(settings.privacy.profileVisibility);
              const nextVisibility = sequence[(currentIndex + 1) % sequence.length];
              const next = {
                ...settings,
                privacy: {
                  ...settings.privacy,
                  profileVisibility: nextVisibility,
                },
              };
              updateMutation.mutate(next);
            }}
          >
            {settings.privacy.profileVisibility}
          </Button>
        </View>
      </Surface>

      <Surface elevation={1} style={styles.card}>
        <Text variant="titleMedium">Preferences</Text>
        <View style={styles.rowWrap}>
          <Text>Theme</Text>
          <SegmentedButtons
            value={settings.preferences.theme}
            onValueChange={(value) => updatePreference('theme', value as PreferenceSettings['theme'])}
            buttons={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'System' },
            ]}
            style={styles.segmented}
          />
        </View>
        <View style={styles.rowWrap}>
          <Text>Distance unit</Text>
          <Button
            mode="outlined"
            compact
            onPress={() => {
              const nextDistanceUnit =
                settings.preferences.distanceUnit === 'miles' ? 'kilometers' : 'miles';
              updatePreference('distanceUnit', nextDistanceUnit);
            }}
          >
            {settings.preferences.distanceUnit}
          </Button>
        </View>
        <View style={styles.rowWrap}>
          <Text>Maximum distance</Text>
          <Button
            mode="outlined"
            compact
            onPress={() => {
              const nextDistance = Math.min(100, settings.preferences.maxDistance + 5);
              updatePreference('maxDistance', nextDistance);
            }}
          >
            {settings.preferences.maxDistance}
          </Button>
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
        <Text variant="bodySmall" style={styles.subtitle}>
          This action cannot be undone. All your activities, swipes, matches, and reviews will be
          permanently deleted.
        </Text>
        <Button mode="text" onPress={() => void signOut()}>
          Sign Out
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
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  segmented: {
    flexShrink: 1,
  },
  actions: {
    marginTop: 8,
    gap: 8,
  },
  errorContainer: {
    gap: 8,
  },
});
