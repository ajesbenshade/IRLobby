import * as Location from 'expo-location';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text } from 'react-native';
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
import { AppButton } from '@components/ui/Button';
import { Field } from '@components/ui/Field';
import { useAuth } from '@hooks/useAuth';
import { api } from '@services/apiClient';
import { track } from '@services/analytics';
import { updateOnboarding } from '@services/authService';
import {
  deactivatePushTokens,
  registerCurrentDevicePushToken,
} from '@services/pushNotificationService';
import { appColors, spacing } from '@theme/index';
import { getErrorMessage } from '@utils/error';

import { VibeQuizScreen } from './vibeQuiz/VibeQuizScreen';

// First-session onboarding: location → vibe → notifications.
// Profile photo is deferred to Profile completion after first value.
const STEP_ORDER = ['location', 'preferences', 'notifications'] as const;

type OnboardingStepKey = (typeof STEP_ORDER)[number];

const STEP_COPY: Record<
  OnboardingStepKey,
  {
    eyebrow: string;
    title: string;
    subtitle: string;
  }
> = {
  location: {
    eyebrow: 'Step 1 of 3',
    title: 'IRLobby only works nearby',
    subtitle:
      'We use your location to show plans within a few miles. You can type your city if you prefer not to share GPS yet.',
  },
  preferences: {
    eyebrow: 'Step 2 of 3',
    title: 'What are you up for?',
    subtitle: 'A quick vibe check so Discover feels personal from the first swipe.',
  },
  notifications: {
    eyebrow: 'Step 3 of 3',
    title: 'Stay in the loop',
    subtitle: 'Get matches and plan updates without keeping the app open.',
  },
};

const hasTruthyPreference = (preferences: Record<string, unknown> | undefined) =>
  Object.values(preferences ?? {}).some((value) => Boolean(value));

export const OnboardingScreen = () => {
  const { user, refreshProfile, signOut } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStepKey>('location');
  const [stepError, setStepError] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [locationStatus, setLocationStatus] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [enableNotifications, setEnableNotifications] = useState(false);

  const resolveInitialStep = (nextUser: typeof user): OnboardingStepKey => {
    if (!nextUser) {
      return 'location';
    }

    if (!nextUser.city?.trim()) {
      return 'location';
    }

    if (!(nextUser.interests?.length || hasTruthyPreference(nextUser.activityPreferences))) {
      return 'preferences';
    }

    return 'notifications';
  };

  useEffect(() => {
    setCity(user?.city ?? '');
    setEnableNotifications(Boolean(user?.pushNotificationsEnabled));

    const nextStep = resolveInitialStep(user);
    setCurrentStep((previous) => {
      const previousIndex = STEP_ORDER.indexOf(previous);
      const nextIndex = STEP_ORDER.indexOf(nextStep);
      if (previousIndex < 0 || nextIndex > previousIndex) {
        return nextStep;
      }
      return previous;
    });
  }, [user]);

  const onboardingMutation = useMutation({
    mutationFn: updateOnboarding,
    onSuccess: async () => {
      await refreshProfile();
    },
  });

  const notificationsMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (enabled) {
        await registerCurrentDevicePushToken();
      } else {
        await deactivatePushTokens();
      }

      const existingPreferences =
        user?.preferences && typeof user.preferences === 'object' ? user.preferences : {};
      const existingNotifications =
        existingPreferences.notifications && typeof existingPreferences.notifications === 'object'
          ? (existingPreferences.notifications as Record<string, unknown>)
          : {};

      await api.patch(API_ROUTES.USER_PROFILE, {
        preferences: {
          ...existingPreferences,
          notifications: {
            ...existingNotifications,
            pushNotifications: enabled,
          },
        },
      });

      return enabled;
    },
    onSuccess: async () => {
      await refreshProfile();
    },
  });

  const currentStepIndex = STEP_ORDER.indexOf(currentStep);
  const previousStep = currentStepIndex > 0 ? STEP_ORDER[currentStepIndex - 1] : null;

  const saveOnboardingStep = async (
    payload: Parameters<typeof updateOnboarding>[0],
    nextStep?: OnboardingStepKey,
  ) => {
    onboardingMutation.reset();
    setStepError(null);

    try {
      await onboardingMutation.mutateAsync(payload);
      if (nextStep) {
        setCurrentStep(nextStep);
      }
    } catch (error) {
      setStepError(getErrorMessage(error, 'Unable to save this step right now.'));
    }
  };

  const requestLocationPermission = async () => {
    setStepError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationStatus('denied');
        return;
      }

      setLocationStatus('granted');
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const places = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      const place = places[0];
      const inferredCity = [place?.city, place?.subregion, place?.region]
        .filter(Boolean)
        .join(', ');
      if (inferredCity) {
        setCity(inferredCity);
      }
    } catch (error) {
      setLocationStatus('denied');
      setStepError(getErrorMessage(error, 'Unable to read your location right now.'));
    }
  };

  const handleLocationContinue = async () => {
    const nextCity = city.trim();
    if (!nextCity) {
      setStepError('Add your city so nearby plans can load, even if GPS is off.');
      return;
    }

    await saveOnboardingStep({ city: nextCity }, 'preferences');
  };

  const handleNotificationsContinue = async () => {
    notificationsMutation.reset();
    setStepError(null);

    try {
      await notificationsMutation.mutateAsync(enableNotifications);
      await saveOnboardingStep({ onboarding_completed: true });
      track('onboarding_completed');
    } catch (error) {
      setStepError(getErrorMessage(error, 'Unable to update notification access right now.'));
    }
  };

  const renderLocationStep = () => (
    <PanelCard>
      <SectionIntro
        eyebrow="Nearby plans"
        title="Share location or type your city"
        subtitle="IRLobby is built for plans within a few miles. Location makes the feed useful on day one."
      />
      <AppButton onPress={() => void requestLocationPermission()}>
        {locationStatus === 'granted' ? 'Location enabled' : 'Use my location'}
      </AppButton>
      {locationStatus === 'denied' ? (
        <Text style={styles.hintText}>
          No problem — type your city below so Discover still has a place to start.
        </Text>
      ) : null}
      <Field
        label="City"
        value={city}
        onChangeText={setCity}
        autoCapitalize="words"
      />
    </PanelCard>
  );

  const renderPreferencesStep = () => (
    <PanelCard>
      <VibeQuizScreen
        existingActivityPreferences={user?.activityPreferences}
        existingPhotoAlbum={user?.photoAlbum}
        existingInterests={user?.interests}
        onComplete={async () => {
          await refreshProfile();
          setStepError(null);
          setCurrentStep('notifications');
        }}
        onSkip={async () => {
          await refreshProfile();
          setStepError(null);
          setCurrentStep('notifications');
        }}
        markSkippedOnSave={false}
        persistOnComplete
      />
    </PanelCard>
  );

  const renderNotificationsStep = () => (
    <PanelCard>
      <SectionIntro
        eyebrow="Optional"
        title="Choose whether you want push notifications"
        subtitle="You can skip this now and turn it on later in settings. No blocking, no penalty."
      />
      <DetailRow
        title="Enable push notifications"
        subtitle="Get notified about joins, matches, and messages without keeping the app open."
        accessory={
          <Switch value={enableNotifications} onValueChange={setEnableNotifications} />
        }
      />
      <Text style={styles.helperCopy}>
        If you continue with notifications enabled, the app will ask the OS for permission on this
        step instead of surprising you earlier.
      </Text>
    </PanelCard>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'location':
        return renderLocationStep();
      case 'preferences':
        return renderPreferencesStep();
      case 'notifications':
        return renderNotificationsStep();
      default:
        return null;
    }
  };

  const renderFooter = () => {
    if (currentStep === 'preferences') {
      return null;
    }

    const isSaving = onboardingMutation.isPending || notificationsMutation.isPending;
    const secondaryLabel = previousStep ? 'Back' : 'Sign out';
    const secondaryAction = () => {
      if (previousStep) {
        setStepError(null);
        setCurrentStep(previousStep);
      } else {
        void signOut();
      }
    };

    const primaryLabel =
      currentStep === 'notifications'
        ? enableNotifications
          ? "You're in"
          : 'Skip & enter app'
        : 'Continue';
    const primaryAction =
      currentStep === 'notifications' ? handleNotificationsContinue : handleLocationContinue;

    return (
      <PanelCard tone="dark" style={styles.footerCard}>
        <Text style={styles.footerTitle}>
          {currentStep === 'notifications' ? 'Almost there.' : 'Find something to do tonight.'}
        </Text>
        <Text style={styles.footerSubtitle}>
          {currentStep === 'notifications'
            ? 'You can polish your profile anytime after you see live plans.'
            : 'Get into Discover fast. Profile polish can wait.'}
        </Text>
        {stepError ? <Text style={styles.footerError}>{stepError}</Text> : null}
        <View style={styles.footerActions}>
          <AppButton variant="ghost" onPress={secondaryAction} disabled={isSaving} textColor={appColors.white}>
            {secondaryLabel}
          </AppButton>
          <AppButton onPress={() => void primaryAction()} loading={isSaving}>
            {primaryLabel}
          </AppButton>
        </View>
      </PanelCard>
    );
  };

  const headerCopy = STEP_COPY[currentStep];

  return (
    <AppScrollView contentContainerStyle={styles.container}>
      <PageHeader
        eyebrow={headerCopy.eyebrow}
        title={headerCopy.title}
        subtitle={headerCopy.subtitle}
        rightContent={
          <AccentPill tone="neutral">
            {currentStepIndex + 1}/{STEP_ORDER.length}
          </AccentPill>
        }
      />

      {renderCurrentStep()}
      {renderFooter()}
    </AppScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  helperCopy: {
    color: appColors.mutedInk,
    lineHeight: 20,
  },
  hintText: {
    color: appColors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
  },
  footerCard: {
    gap: spacing.sm,
  },
  footerTitle: {
    color: appColors.white,
    fontWeight: '800',
  },
  footerSubtitle: {
    color: appColors.mutedInk,
    lineHeight: 21,
  },
  footerError: {
    color: appColors.danger,
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
