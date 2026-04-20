import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, HelperText, Switch, Text } from 'react-native-paper';
import { API_ROUTES } from '@shared/schema';

import {
  AccentPill,
  AppScrollView,
  DetailRow,
  EmptyStatePanel,
  PageHeader,
  PanelCard,
  SectionIntro,
} from '@components/AppChrome';
import { TextInput } from '@components/PaperCompat';
import { Image, View } from '@components/RNCompat';
import { useAuth } from '@hooks/useAuth';
import { api } from '@services/apiClient';
import { updateOnboarding } from '@services/authService';
import {
  deactivatePushTokens,
  registerCurrentDevicePushToken,
} from '@services/pushNotificationService';
import { appColors, radii, spacing } from '@theme/index';
import { getErrorMessage } from '@utils/error';

const MAX_INTERESTS = 20;
const MAX_PHOTOS = 12;

// Onboarding ships in 3 steps (photo, vibe, notifications). Bio, detailed
// preferences, and invites moved out: legal lives on the Register screen,
// the rest are surfaced via the Profile completion ring.
const STEP_ORDER = ['photo', 'preferences', 'notifications'] as const;

type OnboardingStepKey = (typeof STEP_ORDER)[number];

const STEP_COPY: Record<
  OnboardingStepKey,
  {
    eyebrow: string;
    title: string;
    subtitle: string;
  }
> = {
  photo: {
    eyebrow: 'Step 1 of 3',
    title: 'Add a photo',
    subtitle: 'Show up as you. Real photo, real plans.',
  },
  preferences: {
    eyebrow: 'Step 2 of 3',
    title: 'Pick your vibe',
    subtitle: 'What are you up for? Pick a few.',
  },
  notifications: {
    eyebrow: 'Step 3 of 3',
    title: 'Stay in the loop',
    subtitle: 'Get matches and plan updates without keeping the app open.',
  },
};

const resolveImageMimeType = (asset: ImagePicker.ImagePickerAsset): string => {
  if (typeof asset.mimeType === 'string' && asset.mimeType.trim()) {
    return asset.mimeType;
  }

  const uri = asset.uri ?? '';
  const extension = uri.split('?')[0]?.split('#')[0]?.split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'heic') return 'image/heic';
  return 'image/jpeg';
};

const assetToDataUrl = async (asset: ImagePicker.ImagePickerAsset): Promise<string> => {
  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: 'base64',
  });
  const mimeType = resolveImageMimeType(asset);
  return `data:${mimeType};base64,${base64}`;
};

const hasTruthyPreference = (preferences: Record<string, unknown> | undefined) =>
  Object.values(preferences ?? {}).some((value) => Boolean(value));

export const OnboardingScreen = () => {
  const { user, refreshProfile, signOut } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStepKey>('photo');
  const [stepError, setStepError] = useState<string | null>(null);

  const [interestsInput, setInterestsInput] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [photoAlbum, setPhotoAlbum] = useState<string[]>([]);
  const [indoor, setIndoor] = useState(false);
  const [outdoor, setOutdoor] = useState(false);
  const [smallGroups, setSmallGroups] = useState(false);
  const [weekendPreferred, setWeekendPreferred] = useState(false);
  const [enableNotifications, setEnableNotifications] = useState(false);

  const interests = useMemo(
    () =>
      interestsInput
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, MAX_INTERESTS),
    [interestsInput],
  );

  const selectedPreferenceCount = [indoor, outdoor, smallGroups, weekendPreferred].filter(Boolean)
    .length;

  const resolveInitialStep = (nextUser: typeof user): OnboardingStepKey => {
    if (!nextUser) {
      return 'photo';
    }

    if (!nextUser.avatarUrl?.trim()) {
      return 'photo';
    }

    if (!(nextUser.interests?.length || hasTruthyPreference(nextUser.activityPreferences))) {
      return 'preferences';
    }

    return 'notifications';
  };

  useEffect(() => {
    setInterestsInput((user?.interests ?? []).join(', '));
    setProfilePhotoUrl(user?.avatarUrl ?? '');
    setPhotoAlbum(user?.photoAlbum ?? []);

    const activityPreferences = user?.activityPreferences ?? {};
    setIndoor(Boolean(activityPreferences.indoor));
    setOutdoor(Boolean(activityPreferences.outdoor));
    setSmallGroups(Boolean(activityPreferences.smallGroups ?? activityPreferences.group_size === 'small'));
    setWeekendPreferred(Boolean(activityPreferences.weekendPreferred));
    setEnableNotifications(Boolean(user?.pushNotificationsEnabled));

    const nextStep = resolveInitialStep(user);
    setCurrentStep((previous) => {
      // Only advance forward; never bounce a user back to an earlier step.
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

  const pickProfilePhotoFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setStepError('Media library permission is required to add a profile photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.7,
    });

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    const dataUrl = await assetToDataUrl(result.assets[0]);
    setProfilePhotoUrl(dataUrl);
    setStepError(null);
  };

  const addAlbumPhotosFromLibrary = async () => {
    const remainingSlots = MAX_PHOTOS - photoAlbum.length;
    if (remainingSlots <= 0) {
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setStepError('Media library permission is required to add more photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
      quality: 0.7,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const dataUrls = await Promise.all(result.assets.map(assetToDataUrl));
    setPhotoAlbum((previous) => [...previous, ...dataUrls].slice(0, MAX_PHOTOS));
    setStepError(null);
  };

  const removeAlbumPhoto = (index: number) => {
    setPhotoAlbum((previous) => previous.filter((_, currentIndex) => currentIndex !== index));
  };

  const handlePhotoContinue = async () => {
    if (!profilePhotoUrl.trim()) {
      setStepError('Choose one profile photo before continuing.');
      return;
    }

    await saveOnboardingStep(
      {
        avatar_url: profilePhotoUrl,
        photo_album: photoAlbum,
      },
      'preferences',
    );
  };

  const handlePreferencesContinue = async () => {
    if (interests.length === 0 && selectedPreferenceCount === 0) {
      setStepError('Pick at least one vibe to continue.');
      return;
    }

    await saveOnboardingStep(
      {
        interests,
        photo_album: photoAlbum,
        activity_preferences: {
          indoor,
          outdoor,
          smallGroups,
          weekendPreferred,
        },
      },
      'notifications',
    );
  };

  const handleNotificationsContinue = async () => {
    notificationsMutation.reset();
    setStepError(null);

    try {
      await notificationsMutation.mutateAsync(enableNotifications);
      // Notifications is the last step — finish onboarding immediately.
      await saveOnboardingStep({ onboarding_completed: true });
    } catch (error) {
      setStepError(getErrorMessage(error, 'Unable to update notification access right now.'));
    }
  };

  const renderPhotoStep = () => (
    <>
      <PanelCard>
        <SectionIntro
          eyebrow="Profile photo"
          title="Add the one image people should trust"
          subtitle="Keep it recent, clear, and easy to recognize in person."
        />
        <View style={styles.photoHeroRow}>
          {profilePhotoUrl ? (
            <Image source={{ uri: profilePhotoUrl }} style={styles.avatarPreview} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>+</Text>
            </View>
          )}
          <View style={styles.photoHeroCopy}>
            <Text variant="titleMedium" style={styles.photoHeroTitle}>
              Required profile photo
            </Text>
            <Text style={styles.photoHeroSubtitle}>
              This is the only required photo. The album below is optional and can stay small.
            </Text>
            <Button mode="outlined" onPress={pickProfilePhotoFromLibrary}>
              Pick profile photo
            </Button>
          </View>
        </View>
      </PanelCard>

      <PanelCard>
        <SectionIntro
          eyebrow="Optional album"
          title="Add a few extra photos if you want"
          subtitle="These help your profile feel lived-in, but they are not required to enter the app."
        />
        <View style={styles.albumHeaderRow}>
          <Text variant="titleMedium" style={styles.albumTitle}>
            Photo album
          </Text>
          <AccentPill tone="neutral">
            {photoAlbum.length}/{MAX_PHOTOS} used
          </AccentPill>
        </View>
        <Button mode="outlined" onPress={addAlbumPhotosFromLibrary} disabled={photoAlbum.length >= MAX_PHOTOS}>
          Add album photos
        </Button>
        {photoAlbum.length > 0 ? (
          <View style={styles.albumGrid}>
            {photoAlbum.map((uri, index) => (
              <View key={`${index}-${uri.slice(0, 24)}`} style={styles.albumTile}>
                <Image source={{ uri }} style={styles.albumImage} />
                <Button mode="text" compact onPress={() => removeAlbumPhoto(index)}>
                  Remove
                </Button>
              </View>
            ))}
          </View>
        ) : (
          <EmptyStatePanel
            title="No album photos yet"
            description="This can stay empty for now. One strong profile photo is enough to continue."
          />
        )}
      </PanelCard>
    </>
  );

  const renderPreferencesStep = () => (
    <>
      <PanelCard>
        <SectionIntro
          eyebrow="Interests"
          title="Add a few interests people can understand quickly"
          subtitle="Use short comma-separated phrases. Keep them concrete so the app has useful matching signals."
        />
        <TextInput
          label="Interests"
          placeholder="Hiking, dinners, tennis, books"
          value={interestsInput}
          onChangeText={setInterestsInput}
          mode="outlined"
          style={styles.input}
        />
        {interests.length > 0 ? (
          <View style={styles.interestsWrap}>
            {interests.map((interest) => (
              <View key={interest} style={styles.interestChip}>
                <Text style={styles.interestChipText}>{interest}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.helperCopy}>No problem if you prefer toggles below. You only need at least one interest or one preference signal.</Text>
        )}
      </PanelCard>

      <PanelCard>
        <SectionIntro
          eyebrow="Activity preferences"
          title="Flip the switches that feel true now"
          subtitle="These are lightweight signals. You can evolve them later after you have used the app for a while."
        />
        <DetailRow
          title="Indoor activities"
          subtitle="Classes, dinners, workshops, game nights, and weather-proof plans."
          accessory={<Switch value={indoor} onValueChange={setIndoor} />}
        />
        <DetailRow
          title="Outdoor activities"
          subtitle="Walks, hikes, beach plans, sports, and anything that needs open air."
          accessory={<Switch value={outdoor} onValueChange={setOutdoor} />}
        />
        <DetailRow
          title="Prefer small groups"
          subtitle="Bias recommendations toward plans that feel easier to join socially."
          accessory={<Switch value={smallGroups} onValueChange={setSmallGroups} />}
        />
        <DetailRow
          title="Prefer weekends"
          subtitle="Favor Friday through Sunday when the app prioritizes recommendations."
          accessory={<Switch value={weekendPreferred} onValueChange={setWeekendPreferred} />}
        />
      </PanelCard>
    </>
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
        subtitle="Get notified about matches, messages, and relevant activity without keeping the app open."
        accessory={<Switch value={enableNotifications} onValueChange={setEnableNotifications} />}
      />
      <Text style={styles.helperCopy}>
        If you continue with notifications enabled, the app will ask the OS for permission on this step instead of surprising you earlier.
      </Text>
    </PanelCard>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'photo':
        return renderPhotoStep();
      case 'preferences':
        return renderPreferencesStep();
      case 'notifications':
        return renderNotificationsStep();
      default:
        return null;
    }
  };

  const renderFooter = () => {
    const isSaving = onboardingMutation.isPending || notificationsMutation.isPending;

    let primaryLabel = 'Next';
    let primaryAction: () => Promise<void> | void = handlePhotoContinue;
    const secondaryLabel = previousStep ? 'Back' : 'Sign out';
    const secondaryAction = () => {
      if (previousStep) {
        setStepError(null);
        setCurrentStep(previousStep);
      } else {
        void signOut();
      }
    };

    if (currentStep === 'photo') {
      primaryAction = handlePhotoContinue;
    } else if (currentStep === 'preferences') {
      primaryAction = handlePreferencesContinue;
    } else if (currentStep === 'notifications') {
      primaryLabel = enableNotifications ? "You're in" : 'Skip & enter app';
      primaryAction = handleNotificationsContinue;
    }

    return (
      <PanelCard tone="dark" style={styles.footerCard}>
        <Text variant="titleLarge" style={styles.footerTitle}>
          {currentStep === 'notifications' ? 'Almost there.' : 'Two minutes. Then you’re in.'}
        </Text>
        <Text style={styles.footerSubtitle}>
          You can polish the rest from your profile any time.
        </Text>
        {stepError ? (
          <HelperText type="error" visible style={styles.footerError}>
            {stepError}
          </HelperText>
        ) : null}
        <View style={styles.footerActions}>
          <Button mode="text" textColor={appColors.white} onPress={secondaryAction} disabled={isSaving}>
            {secondaryLabel}
          </Button>
          <Button mode="contained" onPress={() => void primaryAction()} loading={isSaving}>
            {primaryLabel}
          </Button>
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
  input: {
    backgroundColor: 'transparent',
  },
  helperCopy: {
    color: appColors.mutedInk,
    lineHeight: 20,
  },
  photoHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarPreview: {
    width: 110,
    height: 110,
    borderRadius: 28,
    backgroundColor: '#d9e5ff',
  },
  avatarFallback: {
    width: 110,
    height: 110,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dfe7fb',
  },
  avatarFallbackText: {
    color: appColors.primaryDeep,
    fontSize: 42,
    fontWeight: '800',
  },
  photoHeroCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  photoHeroTitle: {
    color: appColors.ink,
    fontWeight: '800',
  },
  photoHeroSubtitle: {
    color: appColors.mutedInk,
    lineHeight: 20,
  },
  albumHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  albumTitle: {
    color: appColors.ink,
    fontWeight: '800',
  },
  albumGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  albumTile: {
    width: '47%',
    minWidth: 140,
    gap: spacing.xs,
    borderRadius: radii.md,
    padding: spacing.sm,
    backgroundColor: '#f7f9fe',
  },
  albumImage: {
    width: '100%',
    height: 120,
    borderRadius: radii.md,
    backgroundColor: '#d9e5ff',
  },
  interestsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  interestChip: {
    borderRadius: radii.pill,
    backgroundColor: '#eef2ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  interestChipText: {
    color: appColors.primaryDeep,
    fontWeight: '700',
  },
  footerCard: {
    gap: spacing.sm,
  },
  footerTitle: {
    color: appColors.white,
    fontWeight: '800',
  },
  footerSubtitle: {
    color: '#d6ddf4',
    lineHeight: 21,
  },
  footerError: {
    color: '#ffd3d3',
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
