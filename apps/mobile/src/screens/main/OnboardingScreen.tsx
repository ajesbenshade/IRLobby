import * as Contacts from 'expo-contacts';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Image, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Button, HelperText, RadioButton, Surface, Switch, Text, TextInput } from 'react-native-paper';

import { useAuth } from '@hooks/useAuth';
import { config } from '@constants/config';
import { createInvite, updateOnboarding } from '@services/authService';
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
    <ScrollView contentContainerStyle={styles.container}>
      <Surface elevation={2} style={styles.card}>
        <Text variant="headlineSmall">Finish your profile</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Tell us what you enjoy so we can improve your matches.
        </Text>

        <TextInput label="Short bio" value={bio} onChangeText={setBio} multiline style={styles.input} />
        <TextInput label="City" value={city} onChangeText={setCity} style={styles.input} />
        <TextInput
          label="Age range (e.g. 25-34)"
          value={ageRange}
          onChangeText={setAgeRange}
          style={styles.input}
        />
        <TextInput
          label="Hobbies (comma separated)"
          value={interestsInput}
          onChangeText={setInterestsInput}
          style={styles.input}
        />

        <Text variant="titleMedium">Profile photo</Text>
        {profilePhotoUrl ? (
          <Image source={{ uri: profilePhotoUrl }} style={styles.avatarPreview} />
        ) : (
          <Text style={styles.secondaryText}>No photo selected</Text>
        )}
        <Button mode="outlined" onPress={pickProfilePhotoFromLibrary}>
          Pick profile photo
        </Button>

        <Text variant="titleMedium">Photo album ({photoAlbum.length}/{MAX_PHOTOS})</Text>
        <Button mode="outlined" onPress={addAlbumPhotosFromLibrary} disabled={photoAlbum.length >= MAX_PHOTOS}>
          Add album photos
        </Button>
        {photoAlbum.length > 0 && (
          <View style={styles.albumGrid}>
            {photoAlbum.map((uri, index) => (
              <View key={`${index}-${uri.slice(0, 24)}`} style={styles.albumItem}>
                <Image source={{ uri }} style={styles.albumImage} />
                <Button mode="text" compact onPress={() => removeAlbumPhoto(index)}>
                  Remove
                </Button>
              </View>
            ))}
          </View>
        )}

        <View style={styles.preferenceRow}>
          <Text>Indoor activities</Text>
          <Switch value={indoor} onValueChange={setIndoor} />
        </View>
        <View style={styles.preferenceRow}>
          <Text>Outdoor activities</Text>
          <Switch value={outdoor} onValueChange={setOutdoor} />
        </View>
        <View style={styles.preferenceRow}>
          <Text>Prefer small groups</Text>
          <Switch value={smallGroups} onValueChange={setSmallGroups} />
        </View>
        <View style={styles.preferenceRow}>
          <Text>Prefer weekends</Text>
          <Switch value={weekendPreferred} onValueChange={setWeekendPreferred} />
        </View>

        {onboardingMutation.error && (
          <HelperText type="error" visible>
            {getErrorMessage(onboardingMutation.error, 'Unable to save onboarding.')}
          </HelperText>
        )}

        <View style={styles.actionRow}>
          <Button
            mode="text"
            onPress={() => onboardingMutation.mutate(true)}
            disabled={onboardingMutation.isPending}
          >
            Skip for now
          </Button>
          <Button
            mode="contained"
            onPress={() => onboardingMutation.mutate(true)}
            loading={onboardingMutation.isPending}
          >
            Complete
          </Button>
        </View>

        <View style={styles.divider} />

        <Text variant="titleMedium">Invite friends</Text>
        <RadioButton.Group value={inviteChannel} onValueChange={(value) => setInviteChannel(value as 'sms' | 'email')}>
          <View style={styles.inviteChannelRow}>
            <RadioButton.Item label="SMS" value="sms" />
            <RadioButton.Item label="Email" value="email" />
          </View>
        </RadioButton.Group>
        <TextInput
          label="Friend name (optional)"
          value={inviteName}
          onChangeText={setInviteName}
          style={styles.input}
        />
        <TextInput
          label="Phone or email"
          value={inviteContact}
          onChangeText={setInviteContact}
          style={styles.input}
        />

        {inviteMutation.error && (
          <HelperText type="error" visible>
            {getErrorMessage(inviteMutation.error, 'Unable to create invite.')}
          </HelperText>
        )}

        <Button mode="outlined" onPress={sendManualInvite} loading={inviteMutation.isPending}>
          Create invite link
        </Button>
        <Button mode="outlined" onPress={importContactsAndInvite} loading={inviteMutation.isPending}>
          Allow contacts and invite
        </Button>
        <Button mode="text" onPress={() => void signOut()}>
          Sign out
        </Button>
      </Surface>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  subtitle: {
    opacity: 0.75,
  },
  secondaryText: {
    opacity: 0.75,
  },
  input: {
    backgroundColor: 'transparent',
  },
  avatarPreview: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignSelf: 'flex-start',
  },
  albumGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  albumItem: {
    width: 96,
    alignItems: 'center',
  },
  albumImage: {
    width: 96,
    height: 96,
    borderRadius: 12,
  },
  inviteChannelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#cbd5e1',
    marginVertical: 8,
  },
});
