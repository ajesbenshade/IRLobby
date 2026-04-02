import * as Contacts from 'expo-contacts';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Share, StyleSheet } from 'react-native';
import { Button, HelperText, RadioButton, Switch, Text } from 'react-native-paper';
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
import { config } from '@constants/config';
import { useAuth } from '@hooks/useAuth';
import { api } from '@services/apiClient';
import { createInvite, updateOnboarding } from '@services/authService';
import {
  deactivatePushTokens,
  registerCurrentDevicePushToken,
} from '@services/pushNotificationService';
import { appColors, radii, spacing } from '@theme/index';
import { getErrorMessage } from '@utils/error';

const MAX_INTERESTS = 20;
const MAX_PHOTOS = 12;
const TERMS_URL = 'https://liyf.app/terms-of-service';
const PRIVACY_URL = 'https://liyf.app/privacy-policy';

const STEP_ORDER = [
  'welcome',
  'basics',
  'photo',
  'preferences',
  'legal',
  'notifications',
  'invites',
] as const;

type OnboardingStepKey = (typeof STEP_ORDER)[number];

const STEP_COPY: Record<
  OnboardingStepKey,
  {
    eyebrow: string;
    title: string;
    subtitle: string;
  }
> = {
  welcome: {
    eyebrow: 'First-time setup',
    title: 'Set up your account with less friction',
    subtitle:
      'Get into discovery fast. Only the essentials block entry, and the rest can wait until you have context.',
  },
  basics: {
    eyebrow: 'Step 1',
    title: 'Start with the profile basics',
    subtitle:
      'A short bio and your city give people enough context to understand who you are before they match or chat.',
  },
  photo: {
    eyebrow: 'Step 2',
    title: 'Add a recognizable profile photo',
    subtitle:
      'One clear photo is the minimum trust signal. Your album can stay light and you can add more later.',
  },
  preferences: {
    eyebrow: 'Step 3',
    title: 'Tell the app what you want to do',
    subtitle:
      'Add interests or a few activity preferences so recommendations and introductions feel intentional from day one.',
  },
  legal: {
    eyebrow: 'Step 4',
    title: 'Review the policies that matter',
    subtitle:
      'Terms and privacy acceptance are required before the account can fully enter the app.',
  },
  notifications: {
    eyebrow: 'Optional',
    title: 'Decide whether IRLobby can notify you',
    subtitle:
      'This is optional. Turn it on now if you want match, chat, and invite activity to reach you on device.',
  },
  invites: {
    eyebrow: 'Optional',
    title: 'Invite a few people to make the app feel alive',
    subtitle:
      'You can skip this and enter the app now, or send a couple of invites so your first matches do not depend only on discovery.',
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
  const [currentStep, setCurrentStep] = useState<OnboardingStepKey>('welcome');
  const [stepError, setStepError] = useState<string | null>(null);

  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [interestsInput, setInterestsInput] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [photoAlbum, setPhotoAlbum] = useState<string[]>([]);
  const [indoor, setIndoor] = useState(false);
  const [outdoor, setOutdoor] = useState(false);
  const [smallGroups, setSmallGroups] = useState(false);
  const [weekendPreferred, setWeekendPreferred] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [enableNotifications, setEnableNotifications] = useState(false);

  const [inviteName, setInviteName] = useState('');
  const [inviteContact, setInviteContact] = useState('');
  const [inviteChannel, setInviteChannel] = useState<'sms' | 'email'>('sms');

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
      return 'welcome';
    }

    const hasStarted = Boolean(
      nextUser.bio?.trim() ||
        nextUser.city?.trim() ||
        nextUser.avatarUrl?.trim() ||
        nextUser.interests?.length ||
        hasTruthyPreference(nextUser.activityPreferences),
    );

    if (!hasStarted && !nextUser.legalAccepted) {
      return 'welcome';
    }

    if (!nextUser.bio?.trim() || !nextUser.city?.trim()) {
      return 'basics';
    }

    if (!nextUser.avatarUrl?.trim()) {
      return 'photo';
    }

    if (!(nextUser.interests?.length || hasTruthyPreference(nextUser.activityPreferences))) {
      return 'preferences';
    }

    if (!nextUser.legalAccepted) {
      return 'legal';
    }

    return 'notifications';
  };

  useEffect(() => {
    setBio(user?.bio ?? '');
    setCity(user?.city ?? '');
    setInterestsInput((user?.interests ?? []).join(', '));
    setProfilePhotoUrl(user?.avatarUrl ?? '');
    setPhotoAlbum(user?.photoAlbum ?? []);

    const activityPreferences = user?.activityPreferences ?? {};
    setIndoor(Boolean(activityPreferences.indoor));
    setOutdoor(Boolean(activityPreferences.outdoor));
    setSmallGroups(Boolean(activityPreferences.smallGroups ?? activityPreferences.group_size === 'small'));
    setWeekendPreferred(Boolean(activityPreferences.weekendPreferred));
    setAcceptTerms(Boolean(user?.termsAccepted));
    setAcceptPrivacy(Boolean(user?.privacyAccepted));
    setEnableNotifications(Boolean(user?.pushNotificationsEnabled));

    const nextStep = resolveInitialStep(user);
    setCurrentStep((previous) => {
      const previousIndex = STEP_ORDER.indexOf(previous);
      const nextIndex = STEP_ORDER.indexOf(nextStep);
      return previous === 'welcome' || nextIndex > previousIndex ? nextStep : previous;
    });
  }, [user]);

  const onboardingMutation = useMutation({
    mutationFn: updateOnboarding,
    onSuccess: async () => {
      await refreshProfile();
    },
  });

  const inviteMutation = useMutation({
    mutationFn: createInvite,
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

  const sendManualInvite = async () => {
    if (!inviteContact.trim()) {
      return;
    }

    try {
      const invite = await inviteMutation.mutateAsync({
        contact_name: inviteName,
        contact_value: inviteContact.trim(),
        channel: inviteChannel,
      });

      const inviteLink = `${config.apiBaseUrl.replace('/api', '')}/invite/${invite.token}`;
      await Share.share({
        message: `Join me on IRLobby: ${inviteLink}`,
      });

      setInviteName('');
      setInviteContact('');
    } catch (error) {
      setStepError(getErrorMessage(error, 'Unable to create invite.'));
    }
  };

  const importContactsAndInvite = async () => {
    try {
      const permission = await Contacts.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        setStepError('Contacts permission was not granted. You can still invite by email or phone number.');
        return;
      }

      const result = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
        pageSize: 200,
      });

      const firstInvitable = result.data.find(
        (contact) =>
          (contact.phoneNumbers && contact.phoneNumbers.length > 0) ||
          (contact.emails && contact.emails.length > 0),
      );

      if (!firstInvitable) {
        setStepError('No invitable contacts were found on this device.');
        return;
      }

      const contactValue =
        firstInvitable.phoneNumbers?.[0]?.number ?? firstInvitable.emails?.[0]?.email ?? '';

      if (!contactValue) {
        setStepError('The selected contact does not have a phone number or email address.');
        return;
      }

      const invite = await inviteMutation.mutateAsync({
        contact_name: firstInvitable.name,
        contact_value: contactValue,
        channel: firstInvitable.phoneNumbers?.length ? 'sms' : 'email',
      });

      const inviteLink = `${config.apiBaseUrl.replace('/api', '')}/invite/${invite.token}`;
      await Share.share({
        message: `Join me on IRLobby: ${inviteLink}`,
      });
      setStepError(null);
    } catch (error) {
      setStepError(getErrorMessage(error, 'Unable to import contacts right now.'));
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

  const handleWelcomeContinue = () => {
    setStepError(null);
    setCurrentStep('basics');
  };

  const handleBasicsContinue = async () => {
    if (!bio.trim() || !city.trim()) {
      setStepError('Add a short bio and your city to continue.');
      return;
    }

    await saveOnboardingStep(
      {
        bio: bio.trim(),
        city: city.trim(),
      },
      'photo',
    );
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
      setStepError('Add at least one interest or turn on one activity preference to continue.');
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
      'legal',
    );
  };

  const handleLegalContinue = async () => {
    if (!acceptTerms || !acceptPrivacy) {
      setStepError('Accept both the terms of service and privacy policy to continue.');
      return;
    }

    await saveOnboardingStep(
      {
        terms_accepted: true,
        privacy_accepted: true,
      },
      'notifications',
    );
  };

  const handleNotificationsContinue = async () => {
    notificationsMutation.reset();
    setStepError(null);

    try {
      await notificationsMutation.mutateAsync(enableNotifications);
      setCurrentStep('invites');
    } catch (error) {
      setStepError(getErrorMessage(error, 'Unable to update notification access right now.'));
    }
  };

  const handleFinish = async () => {
    await saveOnboardingStep(
      {
        onboarding_completed: true,
      },
    );
  };

  const openLegalUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      setStepError(getErrorMessage(error, 'Unable to open that link right now.'));
    }
  };

  const renderWelcomeStep = () => (
    <>
      <PanelCard tone="accent" style={styles.heroCard}>
        <AccentPill>Fast path</AccentPill>
        <Text variant="headlineSmall" style={styles.heroTitle}>
          The app only needs the essentials before you can start exploring.
        </Text>
        <Text style={styles.heroSubtitle}>
          We will guide you through the minimum setup that makes your account feel real, then give
          you a clean chance to enable notifications and invite people without forcing either one.
        </Text>
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatValue}>4</Text>
            <Text style={styles.heroStatLabel}>Required steps</Text>
          </View>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatValue}>2</Text>
            <Text style={styles.heroStatLabel}>Optional steps</Text>
          </View>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatValue}>1</Text>
            <Text style={styles.heroStatLabel}>Photo required</Text>
          </View>
        </View>
      </PanelCard>

      <PanelCard>
        <SectionIntro
          eyebrow="What this unlocks"
          title="Enough context to make discovery useful"
          subtitle="The goal is not to create a perfect profile in one sitting. The goal is to avoid an empty account shell."
        />
        <DetailRow
          title="Profile basics"
          subtitle="Bio and city give people a quick read on who you are and where you show up."
        />
        <DetailRow
          title="A recognizable photo"
          subtitle="One clear image raises trust far more than a long text profile."
        />
        <DetailRow
          title="Interests or activity preferences"
          subtitle="The app needs at least one signal to personalize recommendations."
        />
        <DetailRow
          title="Policy acceptance"
          subtitle="Terms and privacy need to be accepted before onboarding can complete."
        />
      </PanelCard>
    </>
  );

  const renderBasicsStep = () => (
    <PanelCard>
      <SectionIntro
        eyebrow="Profile basics"
        title="Tell people what kind of energy you bring"
        subtitle="Keep this concise and human. You can refine it later once you know how you want to use the app."
      />
      <TextInput
        label="Short bio"
        value={bio}
        onChangeText={setBio}
        multiline
        mode="outlined"
        style={styles.input}
      />
      <TextInput
        label="City"
        value={city}
        onChangeText={setCity}
        mode="outlined"
        style={styles.input}
      />
      <Text style={styles.helperCopy}>Your name already comes from account creation. This step only needs the context that helps people place you.</Text>
    </PanelCard>
  );

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

  const renderLegalStep = () => (
    <PanelCard>
      <SectionIntro
        eyebrow="Required acceptance"
        title="Review the terms and privacy policy"
        subtitle="Both need to be accepted before onboarding can finish. Each link opens the current hosted policy."
      />
      <View style={styles.legalCardWrap}>
        <View style={styles.legalCard}>
          <View style={styles.legalCopy}>
            <Text style={styles.legalTitle}>Terms of Service</Text>
            <Text style={styles.legalSubtitle}>Read the rules that govern account use, participation, and platform behavior.</Text>
          </View>
          <Button mode="text" onPress={() => void openLegalUrl(TERMS_URL)}>
            Open
          </Button>
        </View>
        <DetailRow
          title="I accept the terms of service"
          subtitle="Required before your account can finish onboarding."
          accessory={<Switch value={acceptTerms} onValueChange={setAcceptTerms} />}
        />
      </View>
      <View style={styles.legalCardWrap}>
        <View style={styles.legalCard}>
          <View style={styles.legalCopy}>
            <Text style={styles.legalTitle}>Privacy Policy</Text>
            <Text style={styles.legalSubtitle}>Review how the app stores profile data, preferences, and account information.</Text>
          </View>
          <Button mode="text" onPress={() => void openLegalUrl(PRIVACY_URL)}>
            Open
          </Button>
        </View>
        <DetailRow
          title="I accept the privacy policy"
          subtitle="Required before your account can finish onboarding."
          accessory={<Switch value={acceptPrivacy} onValueChange={setAcceptPrivacy} />}
        />
      </View>
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
        subtitle="Get notified about matches, messages, and relevant activity without keeping the app open."
        accessory={<Switch value={enableNotifications} onValueChange={setEnableNotifications} />}
      />
      <Text style={styles.helperCopy}>
        If you continue with notifications enabled, the app will ask the OS for permission on this step instead of surprising you earlier.
      </Text>
    </PanelCard>
  );

  const renderInvitesStep = () => (
    <PanelCard>
      <SectionIntro
        eyebrow="Optional"
        title="Invite people now or skip and enter the app"
        subtitle="A couple of invites can make your first sessions feel less empty, but this is intentionally not a hard gate."
      />
      <RadioButton.Group value={inviteChannel} onValueChange={(value) => setInviteChannel(value as 'sms' | 'email')}>
        <View style={styles.channelWrap}>
          <View style={[styles.channelCard, inviteChannel === 'sms' ? styles.channelCardActive : null]}>
            <RadioButton value="sms" />
            <Text style={styles.channelTitle}>SMS</Text>
          </View>
          <View style={[styles.channelCard, inviteChannel === 'email' ? styles.channelCardActive : null]}>
            <RadioButton value="email" />
            <Text style={styles.channelTitle}>Email</Text>
          </View>
        </View>
      </RadioButton.Group>
      <TextInput
        label="Friend name"
        placeholder="Optional"
        value={inviteName}
        onChangeText={setInviteName}
        mode="outlined"
        style={styles.input}
      />
      <TextInput
        label={inviteChannel === 'sms' ? 'Phone number' : 'Email address'}
        value={inviteContact}
        onChangeText={setInviteContact}
        mode="outlined"
        style={styles.input}
      />
      {inviteMutation.error ? (
        <HelperText type="error" visible>
          {getErrorMessage(inviteMutation.error, 'Unable to create invite.')}
        </HelperText>
      ) : null}
      <View style={styles.inviteActions}>
        <Button
          mode="outlined"
          onPress={() => void sendManualInvite()}
          loading={inviteMutation.isPending}
          disabled={!inviteContact.trim() || inviteMutation.isPending}
        >
          Create invite link
        </Button>
        <Button mode="contained-tonal" onPress={() => void importContactsAndInvite()} loading={inviteMutation.isPending}>
          Import contacts and invite
        </Button>
      </View>
    </PanelCard>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'welcome':
        return renderWelcomeStep();
      case 'basics':
        return renderBasicsStep();
      case 'photo':
        return renderPhotoStep();
      case 'preferences':
        return renderPreferencesStep();
      case 'legal':
        return renderLegalStep();
      case 'notifications':
        return renderNotificationsStep();
      case 'invites':
        return renderInvitesStep();
      default:
        return null;
    }
  };

  const renderFooter = () => {
    if (currentStep === 'welcome') {
      return (
        <PanelCard tone="dark" style={styles.footerCard}>
          <Text variant="titleLarge" style={styles.footerTitle}>
            Start with the essentials.
          </Text>
          <Text style={styles.footerSubtitle}>
            You can refine photos, interests, and settings later from your profile.
          </Text>
          {stepError ? (
            <HelperText type="error" visible style={styles.footerError}>
              {stepError}
            </HelperText>
          ) : null}
          <View style={styles.footerActions}>
            <Button mode="text" textColor={appColors.white} onPress={() => void signOut()}>
              Sign out
            </Button>
            <Button mode="contained" onPress={handleWelcomeContinue}>
              Start setup
            </Button>
          </View>
        </PanelCard>
      );
    }

    const isSaving = onboardingMutation.isPending || notificationsMutation.isPending;

    let primaryLabel = 'Continue';
    let primaryAction = handleBasicsContinue;
    let secondaryLabel = previousStep ? 'Back' : 'Cancel';
    let secondaryAction = () => {
      if (previousStep) {
        setStepError(null);
        setCurrentStep(previousStep);
      }
    };

    if (currentStep === 'photo') {
      primaryAction = handlePhotoContinue;
    } else if (currentStep === 'preferences') {
      primaryAction = handlePreferencesContinue;
    } else if (currentStep === 'legal') {
      primaryAction = handleLegalContinue;
    } else if (currentStep === 'notifications') {
      primaryLabel = enableNotifications ? 'Continue and ask permission' : 'Skip for now';
      primaryAction = handleNotificationsContinue;
    } else if (currentStep === 'invites') {
      primaryLabel = 'Finish setup';
      primaryAction = handleFinish;
      secondaryLabel = 'Skip and enter app';
      secondaryAction = handleFinish;
    }

    return (
      <PanelCard tone="dark" style={styles.footerCard}>
        <Text variant="titleLarge" style={styles.footerTitle}>
          {currentStep === 'invites' ? 'You are one tap away from the app.' : 'Keep the setup moving.'}
        </Text>
        <Text style={styles.footerSubtitle}>
          {currentStep === 'invites'
            ? 'Send invites if you want, or finish now and do the rest later from your profile and settings.'
            : 'Each required step is saved as you go so the flow can recover if you leave and come back.'}
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
  heroCard: {
    gap: spacing.md,
  },
  heroTitle: {
    color: appColors.ink,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  heroSubtitle: {
    color: appColors.mutedInk,
    lineHeight: 22,
  },
  heroStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  heroStatCard: {
    flexGrow: 1,
    minWidth: 96,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#ffffffc7',
    borderWidth: 1,
    borderColor: '#e2ecf2',
  },
  heroStatValue: {
    color: appColors.ink,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  heroStatLabel: {
    color: appColors.mutedInk,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
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
  legalCardWrap: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  legalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radii.md,
    backgroundColor: '#f7f9fe',
    padding: spacing.md,
  },
  legalCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  legalTitle: {
    color: appColors.ink,
    fontWeight: '800',
  },
  legalSubtitle: {
    color: appColors.mutedInk,
    lineHeight: 20,
  },
  channelWrap: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  channelCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d8deeb',
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  channelCardActive: {
    borderColor: appColors.primary,
    backgroundColor: '#eef2ff',
  },
  channelTitle: {
    color: appColors.ink,
    fontWeight: '700',
  },
  inviteActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
