import * as Contacts from 'expo-contacts';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Share, StyleSheet } from 'react-native';
import { Button, HelperText, RadioButton, Switch, Text } from 'react-native-paper';

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
import { config } from '@constants/config';
import { createInvite, updateOnboarding } from '@services/authService';
import { appColors, radii, spacing } from '@theme/index';
import { getErrorMessage } from '@utils/error';

const MAX_INTERESTS = 20;
const MAX_PHOTOS = 12;

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

export const OnboardingScreen = () => {
  const { refreshProfile, signOut } = useAuth();
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [interestsInput, setInterestsInput] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [photoAlbum, setPhotoAlbum] = useState<string[]>([]);
  const [indoor, setIndoor] = useState(false);
  const [outdoor, setOutdoor] = useState(false);
  const [smallGroups, setSmallGroups] = useState(true);
  const [weekendPreferred, setWeekendPreferred] = useState(true);

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

  const onboardingMutation = useMutation({
    mutationFn: async (onboardingCompleted: boolean) =>
      updateOnboarding({
        bio,
        city,
        age_range: ageRange,
        interests,
        avatar_url: profilePhotoUrl,
        photo_album: photoAlbum,
        activity_preferences: {
          indoor,
          outdoor,
          smallGroups,
          weekendPreferred,
        },
        onboarding_completed: onboardingCompleted,
      }),
    onSuccess: async () => {
      await refreshProfile();
    },
  });

  const inviteMutation = useMutation({
    mutationFn: createInvite,
  });

  const sendManualInvite = async () => {
    if (!inviteContact.trim()) {
      return;
    }

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
  };

  const pickProfilePhotoFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
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
  };

  const addAlbumPhotosFromLibrary = async () => {
    const remainingSlots = MAX_PHOTOS - photoAlbum.length;
    if (remainingSlots <= 0) {
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
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
  };

  const removeAlbumPhoto = (index: number) => {
    setPhotoAlbum((previous) => previous.filter((_, currentIndex) => currentIndex !== index));
  };

  const importContactsAndInvite = async () => {
    const permission = await Contacts.requestPermissionsAsync();
    if (permission.status !== 'granted') {
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
      return;
    }

    const contactValue =
      firstInvitable.phoneNumbers?.[0]?.number ?? firstInvitable.emails?.[0]?.email ?? '';

    if (!contactValue) {
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
  };

  return (
    <AppScrollView contentContainerStyle={styles.container}>
      <PageHeader
        eyebrow="Onboarding"
        title="Shape your first impression"
        subtitle="Finish the profile people will see across discovery, matches, and chat, then send a few invites to start your network with momentum."
      />

      <PanelCard tone="accent" style={styles.heroCard}>
        <AccentPill>Production-ready profile</AccentPill>
        <Text variant="headlineSmall" style={styles.heroTitle}>
          Complete the parts that make your account feel real.
        </Text>
        <Text style={styles.heroSubtitle}>
          Better photos, clearer interests, and a sharper preference profile lead to stronger matches and better event recommendations.
        </Text>
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatValue}>{interests.length}</Text>
            <Text style={styles.heroStatLabel}>Interests parsed</Text>
          </View>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatValue}>{1 + photoAlbum.length}</Text>
            <Text style={styles.heroStatLabel}>Photos ready</Text>
          </View>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatValue}>{[indoor, outdoor, smallGroups, weekendPreferred].filter(Boolean).length}</Text>
            <Text style={styles.heroStatLabel}>Preferences set</Text>
          </View>
        </View>
      </PanelCard>

      <PanelCard>
        <SectionIntro
          eyebrow="Identity"
          title="Tell people what kind of energy you bring"
          subtitle="Keep this concise and specific so your profile reads like a person, not an empty account shell."
        />
        <TextInput label="Short bio" value={bio} onChangeText={setBio} multiline mode="outlined" style={styles.input} />
        <View style={styles.row}>
          <TextInput label="City" value={city} onChangeText={setCity} mode="outlined" style={[styles.input, styles.halfInput]} />
          <TextInput
            label="Age range"
            placeholder="25-34"
            value={ageRange}
            onChangeText={setAgeRange}
            mode="outlined"
            style={[styles.input, styles.halfInput]}
          />
        </View>
        <TextInput
          label="Interests"
          placeholder="Hiking, brunch, tennis, books"
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
          <Text style={styles.helperCopy}>Add a few comma-separated interests so discovery starts with better context.</Text>
        )}
      </PanelCard>

      <PanelCard>
        <SectionIntro
          eyebrow="Photos"
          title="Make the profile visual"
          subtitle="A clear avatar plus a small album gives people more confidence before they swipe, match, or show up."
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
              Profile photo
            </Text>
            <Text style={styles.photoHeroSubtitle}>
              Use a recent, clear photo that feels approachable and easy to recognize in person.
            </Text>
            <Button mode="outlined" onPress={pickProfilePhotoFromLibrary}>
              Pick profile photo
            </Button>
          </View>
        </View>

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
            description="Add a few candid or activity photos to make your profile feel complete without overloading it."
          />
        )}
      </PanelCard>

      <PanelCard>
        <SectionIntro
          eyebrow="Preferences"
          title="Tune the kinds of plans you want"
          subtitle="These toggles help the app shape recommendations and make your profile feel intentional from day one."
        />
        <DetailRow
          title="Indoor activities"
          subtitle="Classes, dinners, workshops, game nights, and weather-proof plans."
          accessory={<Switch value={indoor} onValueChange={setIndoor} />}
        />
        <DetailRow
          title="Outdoor activities"
          subtitle="Walks, hikes, beach plans, sports, and any plan that needs open air."
          accessory={<Switch value={outdoor} onValueChange={setOutdoor} />}
        />
        <DetailRow
          title="Prefer small groups"
          subtitle="Keep invites tighter for easier conversation and lower social friction."
          accessory={<Switch value={smallGroups} onValueChange={setSmallGroups} />}
        />
        <DetailRow
          title="Prefer weekends"
          subtitle="Bias recommendations toward Friday through Sunday."
          accessory={<Switch value={weekendPreferred} onValueChange={setWeekendPreferred} />}
        />
      </PanelCard>

      <PanelCard>
        <SectionIntro
          eyebrow="Invites"
          title="Start with a few known people"
          subtitle="Invite friends by text or email so your first matches and events do not depend only on discovery."
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
            onPress={sendManualInvite}
            loading={inviteMutation.isPending}
            disabled={!inviteContact.trim() || inviteMutation.isPending}
          >
            Create invite link
          </Button>
          <Button mode="contained-tonal" onPress={importContactsAndInvite} loading={inviteMutation.isPending}>
            Import contacts and invite
          </Button>
        </View>
      </PanelCard>

      <PanelCard tone="dark" style={styles.footerCard}>
        <Text variant="titleLarge" style={styles.footerTitle}>
          Finish setup and start matching.
        </Text>
        <Text style={styles.footerSubtitle}>
          You can still change photos, interests, and preferences later from your profile.
        </Text>
        {onboardingMutation.error ? (
          <HelperText type="error" visible style={styles.footerError}>
            {getErrorMessage(onboardingMutation.error, 'Unable to save onboarding.')}
          </HelperText>
        ) : null}
        <View style={styles.footerActions}>
          <Button mode="text" textColor={appColors.white} onPress={() => onboardingMutation.mutate(true)} disabled={onboardingMutation.isPending}>
            Skip for now
          </Button>
          <Button mode="contained" onPress={() => onboardingMutation.mutate(true)} loading={onboardingMutation.isPending}>
            Complete setup
          </Button>
        </View>
        <Button mode="text" textColor="#cfd8f6" onPress={() => void signOut()}>
          Sign out
        </Button>
      </PanelCard>
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
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    backgroundColor: 'transparent',
  },
  halfInput: {
    flex: 1,
  },
  helperCopy: {
    color: appColors.mutedInk,
    lineHeight: 20,
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
  avatarPreview: {
    width: 108,
    height: 108,
    borderRadius: 32,
  },
  avatarFallback: {
    width: 108,
    height: 108,
    borderRadius: 32,
    backgroundColor: '#e7ecf8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: appColors.primary,
    fontSize: 44,
    fontWeight: '300',
  },
  photoHeroRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  albumTitle: {
    color: appColors.ink,
    fontWeight: '800',
  },
  albumGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  albumTile: {
    width: 92,
    gap: 4,
    alignItems: 'center',
  },
  albumImage: {
    width: 92,
    height: 92,
    borderRadius: radii.sm,
  },
  channelWrap: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  channelCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#dbe3f0',
    backgroundColor: '#f8fbff',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  channelCardActive: {
    borderColor: '#c2cbff',
    backgroundColor: '#edf0ff',
  },
  channelTitle: {
    color: appColors.ink,
    fontWeight: '700',
  },
  inviteActions: {
    gap: spacing.sm,
  },
  footerCard: {
    gap: spacing.sm,
  },
  footerTitle: {
    color: appColors.white,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  footerSubtitle: {
    color: '#cbd5ea',
    lineHeight: 21,
  },
  footerError: {
    color: '#fecaca',
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
