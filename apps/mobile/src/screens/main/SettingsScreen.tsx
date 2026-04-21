import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { Alert, Share, StyleSheet } from 'react-native';
import { Button, HelperText, Switch, Text } from 'react-native-paper';
import { API_ROUTES } from '@shared/schema';

import {
  AccentPill,
  AppScrollView,
  DetailRow,
  PageHeader,
  PanelCard,
  SectionIntro,
} from '@components/AppChrome';
import { View } from '@components/RNCompat';
import { useAuth } from '@hooks/useAuth';
import type { MainStackParamList } from '@navigation/types';
import { api } from '@services/apiClient';
import {
  deactivatePushTokens,
  registerCurrentDevicePushToken,
} from '@services/pushNotificationService';
import { appColors, radii, spacing } from '@theme/index';
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

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export const SettingsScreen = () => {
  const { signOut } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();

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
  const isMutating = updateMutation.isPending;
  const isBusy = isMutating || exportDataMutation.isPending || deleteAccountMutation.isPending;

  const messages = [
    error ? getErrorMessage(error, 'Unable to load settings.') : null,
    updateMutation.error ? getErrorMessage(updateMutation.error, 'Unable to save settings.') : null,
    exportDataMutation.error ? getErrorMessage(exportDataMutation.error, 'Unable to export your data.') : null,
    deleteAccountMutation.error ? getErrorMessage(deleteAccountMutation.error, 'Unable to delete your account.') : null,
  ].filter((value): value is string => Boolean(value));

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

    if (section === 'notifications' && key === 'pushNotifications') {
      const nextValue = !currentValue;
      if (nextValue) {
        void registerCurrentDevicePushToken();
      } else {
        void deactivatePushTokens();
      }
    }

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

    updateMutation.mutate(next);
  };

  const cycleProfileVisibility = () => {
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
    } catch (mutationError) {
      console.warn('[SettingsScreen] Export failed', mutationError);
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
    <AppScrollView contentContainerStyle={styles.container}>
      <PageHeader
        eyebrow="Account settings"
        title="Settings"
        subtitle="Control how the app reaches you, what other people can see, and how your account behaves day to day."
        rightContent={
          <AccentPill tone="neutral">
            {deleteAccountMutation.isPending
              ? 'Deleting'
              : exportDataMutation.isPending
                ? 'Exporting'
                : isLoading || isRefetching || isMutating
                  ? 'Syncing'
                  : 'Live'}
          </AccentPill>
        }
      />

      <PanelCard tone="accent" style={styles.heroCard}>
        <AccentPill>Account controls</AccentPill>
        <Text variant="titleLarge" style={styles.heroTitle}>
          Keep the account private where it matters and active where it helps.
        </Text>
        <Text style={styles.heroSubtitle}>
          Notification delivery, profile visibility, and distance preferences all update here without changing the rest of your profile flow.
        </Text>
      </PanelCard>

      {messages.length > 0 ? (
        <PanelCard tone="warm" style={styles.feedbackCard}>
          <SectionIntro
            eyebrow="Attention"
            title="Some account actions need another pass"
            subtitle="The underlying settings logic is still intact; use retry or repeat the action after the current request settles."
          />
          {messages.map((message) => (
            <HelperText key={message} type="error" visible>
              {message}
            </HelperText>
          ))}
          <Button mode="outlined" onPress={() => void refetch()} loading={isRefetching} disabled={isBusy}>
            {isRefetching ? 'Retrying...' : 'Refresh settings'}
          </Button>
        </PanelCard>
      ) : null}

      {isLoading || isRefetching ? (
        <PanelCard>
          <Text style={styles.loadingText}>
            {isLoading ? 'Loading your settings...' : 'Refreshing your latest settings...'}
          </Text>
        </PanelCard>
      ) : null}

      <PanelCard>
        <SectionIntro
          eyebrow="Notifications"
          title="Decide what earns your attention"
          subtitle="Keep the core signals on, but reduce anything that makes the app feel noisy instead of useful."
        />
        <DetailRow
          title="Push notifications"
          subtitle="Allow timely nudges for live activity around your account."
          accessory={
            <Switch
              value={settings.notifications.pushNotifications}
              onValueChange={() => toggleSetting('notifications', 'pushNotifications')}
              disabled={isBusy}
            />
          }
        />
        <DetailRow
          title="Email notifications"
          subtitle="Receive recap-style updates when you are away from the app."
          accessory={
            <Switch
              value={settings.notifications.emailNotifications}
              onValueChange={() => toggleSetting('notifications', 'emailNotifications')}
              disabled={isBusy}
            />
          }
        />
        <DetailRow
          title="New matches"
          subtitle="Get alerted when discovery turns into a connection."
          accessory={
            <Switch
              value={settings.notifications.newMatches}
              onValueChange={() => toggleSetting('notifications', 'newMatches')}
              disabled={isBusy}
            />
          }
        />
        <DetailRow
          title="Activity reminders"
          subtitle="Stay on top of events you hosted, joined, or committed to attend."
          accessory={
            <Switch
              value={settings.notifications.activityReminders}
              onValueChange={() => toggleSetting('notifications', 'activityReminders')}
              disabled={isBusy}
            />
          }
        />
        <DetailRow
          title="Messages"
          subtitle="Receive alerts when a conversation picks up again."
          accessory={
            <Switch
              value={settings.notifications.messages}
              onValueChange={() => toggleSetting('notifications', 'messages')}
              disabled={isBusy}
            />
          }
        />
      </PanelCard>

      <PanelCard>
        <SectionIntro
          eyebrow="Privacy"
          title="Control what people can see"
          subtitle="These settings shape how visible your profile is and how much personal context you expose to others."
        />
        <DetailRow
          title="Location sharing"
          subtitle="Use location to make discovery and activity placement more relevant."
          accessory={
            <Switch
              value={settings.privacy.locationSharing}
              onValueChange={() => toggleSetting('privacy', 'locationSharing')}
              disabled={isBusy}
            />
          }
        />
        <DetailRow
          title="Show age"
          subtitle="Let other people see your age information on your profile."
          accessory={
            <Switch
              value={settings.privacy.showAge}
              onValueChange={() => toggleSetting('privacy', 'showAge')}
              disabled={isBusy}
            />
          }
        />
        <DetailRow
          title="Show email"
          subtitle="Reveal email as part of your visible profile details."
          accessory={
            <Switch
              value={settings.privacy.showEmail}
              onValueChange={() => toggleSetting('privacy', 'showEmail')}
              disabled={isBusy}
            />
          }
        />
        <DetailRow
          title="Profile visibility"
          subtitle="Cycle between public, friends-only, and private profile visibility."
          accessory={
            <Button mode="outlined" compact onPress={cycleProfileVisibility} disabled={isBusy}>
              {titleCase(settings.privacy.profileVisibility)}
            </Button>
          }
        />
      </PanelCard>

      <PanelCard>
        <SectionIntro
          eyebrow="Preferences"
          title="Tune the app to your defaults"
          subtitle="These values affect how the app feels in regular use without changing your public profile."
        />
        <DetailRow
          title="Theme"
          subtitle="Switch between light, dark, and system-following display behavior."
          accessory={
            <Button
              mode="outlined"
              compact
              onPress={() => {
                const sequence: PreferenceSettings['theme'][] = ['light', 'dark', 'system'];
                const currentIndex = sequence.indexOf(settings.preferences.theme);
                const nextTheme = sequence[(currentIndex + 1) % sequence.length];
                updatePreference('theme', nextTheme);
              }}
              disabled={isBusy}
            >
              {titleCase(settings.preferences.theme)}
            </Button>
          }
        />
        <DetailRow
          title="Distance unit"
          subtitle="Choose whether location radius values show in miles or kilometers."
          accessory={
            <Button
              mode="outlined"
              compact
              onPress={() => {
                const nextDistanceUnit =
                  settings.preferences.distanceUnit === 'miles' ? 'kilometers' : 'miles';
                updatePreference('distanceUnit', nextDistanceUnit);
              }}
              disabled={isBusy}
            >
              {titleCase(settings.preferences.distanceUnit)}
            </Button>
          }
        />
        <DetailRow
          title="Maximum distance"
          subtitle="Increase the discovery radius in 5-mile increments up to 100."
          accessory={
            <Button
              mode="outlined"
              compact
              onPress={() => {
                const nextDistance = Math.min(100, settings.preferences.maxDistance + 5);
                updatePreference('maxDistance', nextDistance);
              }}
              disabled={isBusy}
            >
              {settings.preferences.maxDistance} {settings.preferences.distanceUnit}
            </Button>
          }
        />
        <DetailRow
          title="Retake vibe quiz"
          subtitle="Refresh your personalized feed with a quick 60-second vibe check."
          accessory={
            <Button
              mode="outlined"
              compact
              onPress={() => navigation.navigate('VibeQuizModal')}
            >
              Retake
            </Button>
          }
        />
      </PanelCard>

      <PanelCard tone="dark" style={styles.actionsCard}>
        <SectionIntro
          eyebrow="Account actions"
          title="Export, sign out, or remove the account"
          subtitle="Use these actions deliberately. Export is reversible. Delete is permanent."
        />
        <View style={styles.actionStack}>
          <Button
            mode="contained-tonal"
            onPress={() => void handleExportData()}
            loading={exportDataMutation.isPending}
            disabled={isBusy}
          >
            Export my data
          </Button>
          <Button mode="outlined" textColor={appColors.white} onPress={() => void signOut()} disabled={isBusy}>
            Sign out
          </Button>
        </View>
        <View style={styles.dangerBox}>
          <Text variant="titleMedium" style={styles.dangerTitle}>
            Permanent deletion
          </Text>
          <Text style={styles.dangerCopy}>
            This removes your activities, swipes, matches, reviews, and account data. The action cannot be undone.
          </Text>
          <Button
            mode="contained"
            buttonColor={appColors.danger}
            onPress={confirmDeleteAccount}
            loading={deleteAccountMutation.isPending}
            disabled={isBusy}
          >
            Delete account
          </Button>
        </View>
      </PanelCard>
    </AppScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  heroCard: {
    gap: spacing.sm,
  },
  heroTitle: {
    color: appColors.ink,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: appColors.mutedInk,
    lineHeight: 22,
  },
  feedbackCard: {
    gap: spacing.sm,
  },
  loadingText: {
    color: appColors.mutedInk,
    lineHeight: 20,
  },
  actionsCard: {
    gap: spacing.md,
  },
  actionStack: {
    gap: spacing.sm,
  },
  dangerBox: {
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#6b1d25',
    backgroundColor: '#231014',
    padding: spacing.md,
  },
  dangerTitle: {
    color: '#ffd7dc',
    fontWeight: '800',
  },
  dangerCopy: {
    color: '#f5bcc4',
    lineHeight: 20,
  },
});
