import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Share, StyleSheet } from 'react-native';
import { HelperText, Text } from 'react-native-paper';
import { API_ROUTES } from '@shared/schema';

import {
  AccentPill,
  AppScrollView,
  DetailRow,
  PageHeader,
  PanelCard,
  SectionIntro,
} from '@components/AppChrome';
import { Switch } from '@components/foyer/Switch';
import { View } from '@components/RNCompat';
import { AppButton } from '@components/ui/Button';
import { account as accountCopy } from '@constants/copy';
import { useAuth } from '@hooks/useAuth';
import type { MainStackParamList } from '@navigation/types';
import { api } from '@services/apiClient';
import {
  deactivatePushTokens,
  registerCurrentDevicePushToken,
} from '@services/pushNotificationService';
import { appColors, spacing } from '@theme/index';
import { getErrorMessage } from '@utils/error';

interface NotificationSettings {
  pushNotifications: boolean;
  emailNotifications: boolean;
  activityReminders: boolean;
  newMatches: boolean;
  messages: boolean;
}

/**
 * Whatever is stored under `preferences.privacy` on the server. Settings no longer shows or edits it (the Privacy and
 * Location cards were removed), but PATCH /profile/ replaces the whole `preferences` object, so it is carried through
 * untouched (unknown keys included) whenever another setting is saved.
 */
type StoredPrivacy = Record<string, unknown>;

interface PreferenceSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  distanceUnit: 'miles' | 'kilometers';
  maxDistance: number;
}

interface UserSettings {
  notifications: NotificationSettings;
  /** Opaque pass-through of the stored `preferences.privacy` blob; undefined when the account has none. */
  privacy?: StoredPrivacy;
  preferences: PreferenceSettings;
}

interface UserProfileResponse {
  preferences?: Partial<PreferenceSettings> & {
    notifications?: NotificationSettings;
    privacy?: StoredPrivacy;
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
  preferences: {
    theme: 'system',
    language: 'English',
    distanceUnit: 'miles',
    maxDistance: 25,
  },
};

export const toPayload = (settings: UserSettings) => ({
  preferences: {
    ...settings.preferences,
    notifications: settings.notifications,
    // Preserve the stored privacy blob exactly as loaded; never synthesize defaults into it.
    ...(settings.privacy ? { privacy: settings.privacy } : {}),
  },
});

export const loadSettings = async (): Promise<UserSettings> => {
  const response = await api.get<UserProfileResponse>(API_ROUTES.USER_PROFILE);
  const preferences = response.data.preferences ?? {};
  const { notifications, privacy, ...preferenceOverrides } = preferences;

  return {
    notifications: {
      ...defaultSettings.notifications,
      ...(notifications ?? {}),
    },
    ...(privacy && typeof privacy === 'object' ? { privacy } : {}),
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

  const settings = useMemo(() => data ?? defaultSettings, [data]);
  const isMutating = updateMutation.isPending;
  const isBusy = isMutating || exportDataMutation.isPending;

  const messages = [
    error ? getErrorMessage(error, 'Unable to load settings.') : null,
    updateMutation.error ? getErrorMessage(updateMutation.error, 'Unable to save settings.') : null,
    exportDataMutation.error ? getErrorMessage(exportDataMutation.error, 'Unable to export your data.') : null,
  ].filter((value): value is string => Boolean(value));

  const toggleNotification = (key: keyof NotificationSettings) => {
    const nextValue = !settings.notifications[key];
    const next: UserSettings = {
      ...settings,
      notifications: { ...settings.notifications, [key]: nextValue },
    };

    if (key === 'pushNotifications') {
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

  const handleExportData = async () => {
    try {
      const payload = await exportDataMutation.mutateAsync();
      const exportDate = new Date().toISOString().split('T')[0];
      await Share.share({
        title: 'The Foyer Data Export',
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

  return (
    <AppScrollView contentContainerStyle={styles.container}>
      <PageHeader
        eyebrow="Account settings"
        title="Settings"
        subtitle="Control how the app reaches you and how your account behaves day to day."
        rightContent={
          <AccentPill tone="neutral">
            {exportDataMutation.isPending
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
          Notification delivery and distance preferences update here without changing the rest of your profile flow.
        </Text>
      </PanelCard>

      <PanelCard>
        <SectionIntro
          eyebrow="Account"
          title="Your account on The Foyer"
          subtitle="Open Account to permanently delete your profile. Sign out stays here."
        />
        <DetailRow
          title={accountCopy.settingsRowTitle}
          subtitle={accountCopy.settingsRowSubtitle}
          onPress={() => navigation.navigate('Account')}
          accessory={
            <MaterialCommunityIcons name="chevron-right" size={22} color={appColors.softInk} />
          }
        />
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
          <AppButton variant="outline" onPress={() => void refetch()} loading={isRefetching} disabled={isBusy}>
            {isRefetching ? 'Retrying...' : 'Try again'}
          </AppButton>
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
          dimmed={isBusy}
          subtitle="Allow timely nudges for live activity around your account."
          accessory={
            <Switch
              accessibilityLabel="Push notifications"
              value={settings.notifications.pushNotifications}
              onValueChange={() => toggleNotification('pushNotifications')}
              disabled={isBusy}
            />
          }
        />
        <DetailRow
          title="Email notifications"
          dimmed={isBusy}
          subtitle="Receive recap-style updates when you are away from the app."
          accessory={
            <Switch
              accessibilityLabel="Email notifications"
              value={settings.notifications.emailNotifications}
              onValueChange={() => toggleNotification('emailNotifications')}
              disabled={isBusy}
            />
          }
        />
        <DetailRow
          title="New matches"
          dimmed={isBusy}
          subtitle="Get alerted when discovery turns into a connection."
          accessory={
            <Switch
              accessibilityLabel="New matches"
              value={settings.notifications.newMatches}
              onValueChange={() => toggleNotification('newMatches')}
              disabled={isBusy}
            />
          }
        />
        <DetailRow
          title="Activity reminders"
          dimmed={isBusy}
          subtitle="Stay on top of events you hosted, joined, or committed to attend."
          accessory={
            <Switch
              accessibilityLabel="Activity reminders"
              value={settings.notifications.activityReminders}
              onValueChange={() => toggleNotification('activityReminders')}
              disabled={isBusy}
            />
          }
        />
        <DetailRow
          title="Messages"
          dimmed={isBusy}
          subtitle="Receive alerts when a conversation picks up again."
          accessory={
            <Switch
              accessibilityLabel="Messages"
              value={settings.notifications.messages}
              onValueChange={() => toggleNotification('messages')}
              disabled={isBusy}
            />
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
            <AppButton
              variant="outline"
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
            </AppButton>
          }
        />
        <DetailRow
          title="Distance unit"
          subtitle="Choose whether location radius values show in miles or kilometers."
          accessory={
            <AppButton
              variant="outline"
              compact
              onPress={() => {
                const nextDistanceUnit =
                  settings.preferences.distanceUnit === 'miles' ? 'kilometers' : 'miles';
                updatePreference('distanceUnit', nextDistanceUnit);
              }}
              disabled={isBusy}
            >
              {titleCase(settings.preferences.distanceUnit)}
            </AppButton>
          }
        />
        <DetailRow
          title="Maximum distance"
          subtitle="Increase the discovery radius in 5-mile increments up to 100."
          accessory={
            <AppButton
              variant="outline"
              compact
              onPress={() => {
                const nextDistance = Math.min(100, settings.preferences.maxDistance + 5);
                updatePreference('maxDistance', nextDistance);
              }}
              disabled={isBusy}
            >
              {settings.preferences.maxDistance} {settings.preferences.distanceUnit}
            </AppButton>
          }
        />
        <DetailRow
          title="Retake vibe quiz"
          subtitle="Refresh your personalized feed with a quick 60-second vibe check."
          accessory={
            <AppButton
              variant="outline"
              compact
              onPress={() => navigation.navigate('VibeQuizModal')}
            >
              Retake
            </AppButton>
          }
        />
      </PanelCard>

      <PanelCard tone="dark" style={styles.actionsCard}>
        <SectionIntro
          eyebrow="Account actions"
          title="Export or sign out"
          subtitle="Use these actions deliberately. Export is reversible. Delete lives under Account."
        />
        <View style={styles.actionStack}>
          <AppButton
            onPress={() => void handleExportData()}
            loading={exportDataMutation.isPending}
            disabled={isBusy}
          >
            Export my data
          </AppButton>
          <AppButton variant="outline" onPress={() => void signOut()} disabled={isBusy}>
            Sign out
          </AppButton>
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
});
