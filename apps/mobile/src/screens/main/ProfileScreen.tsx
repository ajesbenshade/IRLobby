import { useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';
import { API_ROUTES } from '@shared/schema';

import { AccentPill, AppScrollView, EmptyStatePanel, PageHeader, PanelCard, SectionIntro } from '@components/AppChrome';
import { TextInput } from '@components/PaperCompat';
import { Image, Text as NativeText, View } from '@components/RNCompat';
import { useAuth } from '@hooks/useAuth';
import { api } from '@services/apiClient';
import { updateOnboarding } from '@services/authService';
import { appColors, appTypography } from '@theme/index';
import { getErrorMessage } from '@utils/error';

import type { MainStackParamList } from '@navigation/types';

export const ProfileScreen = () => {
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
    const mimeType = resolveImageMimeType(asset);

    if (typeof asset.base64 === 'string' && asset.base64.trim()) {
      return `data:${mimeType};base64,${asset.base64}`;
    }

    const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
    return `data:${mimeType};base64,${base64}`;
  };

  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { user, signOut, refreshProfile } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [interestInput, setInterestInput] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [photoInput, setPhotoInput] = useState('');
  const [photoAlbum, setPhotoAlbum] = useState<string[]>([]);

  useEffect(() => {
    setFirstName(user?.firstName ?? '');
    setLastName(user?.lastName ?? '');
    setBio(user?.bio ?? '');
    setCity(user?.city ?? '');
    setAvatarUrl(user?.avatarUrl ?? '');
    setInterests(user?.interests ?? []);
    setPhotoAlbum(user?.photoAlbum ?? []);
    setInterestInput('');
    setPhotoInput('');
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.patch(API_ROUTES.USER_PROFILE, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        bio: bio.trim(),
        location: city.trim(),
        avatar_url: avatarUrl.trim(),
      });

      await updateOnboarding({
        bio: bio.trim(),
        city: city.trim(),
        avatar_url: avatarUrl.trim(),
        interests,
        photo_album: photoAlbum,
      });
    },
    onSuccess: async () => {
      await refreshProfile();
    },
  });

  const addInterest = () => {
    const next = interestInput.trim();
    if (!next || interests.includes(next) || interests.length >= MAX_INTERESTS) {
      return;
    }
    setInterests((previous) => [...previous, next]);
    setInterestInput('');
  };

  const removeInterest = (value: string) => {
    setInterests((previous) => previous.filter((interest) => interest !== value));
  };

  const addPhotoByUrl = () => {
    const next = photoInput.trim();
    if (!next || photoAlbum.length >= MAX_PHOTOS) {
      return;
    }
    setPhotoAlbum((previous) => [...previous, next]);
    setPhotoInput('');
  };

  const removePhotoAt = (index: number) => {
    setPhotoAlbum((previous) => previous.filter((_, currentIndex) => currentIndex !== index));
  };

  const pickAvatarFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      base64: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      try {
        const dataUrl = await assetToDataUrl(result.assets[0]);
        setAvatarUrl(dataUrl);
      } catch (error) {
        console.warn('[ProfileScreen] Failed to load selected avatar', error);
      }
    }
  };

  const addPhotoFromLibrary = async () => {
    if (photoAlbum.length >= MAX_PHOTOS) {
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      base64: true,
      quality: 0.7,
      selectionLimit: MAX_PHOTOS - photoAlbum.length,
    });

    if (!result.canceled) {
      try {
        const selected = result.assets.filter((asset) => Boolean(asset.uri));
        const dataUrls = await Promise.all(selected.map(assetToDataUrl));
        setPhotoAlbum((previous) => [...previous, ...dataUrls].slice(0, MAX_PHOTOS));
      } catch (error) {
        console.warn('[ProfileScreen] Failed to load selected album photo(s)', error);
      }
    }
  };

  return (
    <AppScrollView contentContainerStyle={styles.container}>
      <PageHeader
        eyebrow="Your vibe"
        title="Show people why they should say yes"
        subtitle="Shape the profile people scan before they join your plan, match with you, or open the chat."
      />

      <PanelCard style={styles.heroCard} tone="accent">
        <View style={styles.heroTopRow}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarPreview} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{(firstName || user?.email || 'U').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.heroCopy}>
            <AccentPill>Public vibe</AccentPill>
            <Text variant="titleLarge" style={styles.heroName}>
              {[firstName, lastName].filter(Boolean).join(' ') || user?.email || 'Your profile'}
            </Text>
            <Text style={styles.heroEmail}>{user?.email ?? 'Not signed in'}</Text>
            <Text style={styles.heroSubline}>
              {bio?.trim() || 'Add a quick line so people know what kind of energy you bring.'}
            </Text>
          </View>
        </View>
        <Button mode="outlined" onPress={pickAvatarFromLibrary} style={styles.inlineButton}>
          Update avatar
        </Button>
      </PanelCard>

      <PanelCard>
        <SectionIntro
          eyebrow="Intro"
          title="Give people the quick read"
          subtitle="This is the identity layer people see across plans, sparks, and chat."
        />
        <View style={styles.row}>
          <TextInput label="First name" value={firstName} onChangeText={setFirstName} mode="outlined" style={[styles.input, styles.half]} />
          <TextInput label="Last name" value={lastName} onChangeText={setLastName} mode="outlined" style={[styles.input, styles.half]} />
        </View>
        <TextInput label="City" value={city} onChangeText={setCity} mode="outlined" style={styles.input} />
        <TextInput label="Bio" value={bio} onChangeText={setBio} multiline mode="outlined" style={styles.input} />
      </PanelCard>

      <PanelCard>
        <SectionIntro
          eyebrow="Interests"
          title={`What are you into? (${interests.length}/${MAX_INTERESTS})`}
          subtitle="Keep these short and specific so the app can surface better plans and more compatible people."
        />
        <View style={styles.row}>
          <TextInput
            label="Add interest"
            value={interestInput}
            onChangeText={setInterestInput}
            mode="outlined"
            style={[styles.input, styles.flexInput]}
          />
          <Button mode="outlined" onPress={addInterest} disabled={!interestInput.trim()}>
            Add
          </Button>
        </View>
        {interests.length > 0 ? (
          <View style={styles.inlineWrap}>
            {interests.map((interest) => (
              <View key={interest} style={styles.interestChip}>
                <Text style={styles.interestText}>{interest}</Text>
                <Button mode="text" compact onPress={() => removeInterest(interest)}>
                  Remove
                </Button>
              </View>
            ))}
          </View>
        ) : (
          <EmptyStatePanel
            title="No interests yet"
            description="Add a few interests so your profile feels specific, social, and easier to match around."
          />
        )}
      </PanelCard>

      <PanelCard>
        <SectionIntro
          eyebrow="Media"
          title={`Photo album (${photoAlbum.length}/${MAX_PHOTOS})`}
          subtitle="Give people a sense of who you are before they open the chat or show up to the plan."
        />
        <View style={styles.row}>
          <TextInput
            label="Photo URL"
            value={photoInput}
            onChangeText={setPhotoInput}
            autoCapitalize="none"
            mode="outlined"
            style={[styles.input, styles.flexInput]}
          />
          <Button mode="outlined" onPress={addPhotoByUrl} disabled={!photoInput.trim()}>
            Add
          </Button>
        </View>
        <Button mode="outlined" onPress={addPhotoFromLibrary} disabled={photoAlbum.length >= MAX_PHOTOS} style={styles.inlineButton}>
          Add from library
        </Button>
        {photoAlbum.length > 0 ? (
          <View style={styles.albumGrid}>
            {photoAlbum.map((photo, index) => (
              <View key={`${index}-${photo.slice(0, 24)}`} style={styles.albumTile}>
                <Image source={{ uri: photo }} style={styles.albumPreview} />
                <NativeText numberOfLines={1} style={styles.albumText}>
                  {photo.startsWith('data:') ? `Photo ${index + 1}` : `Photo ${index + 1}`}
                </NativeText>
                <Button mode="text" compact onPress={() => removePhotoAt(index)}>
                  Remove
                </Button>
              </View>
            ))}
          </View>
        ) : (
          <EmptyStatePanel
            title="No photo album yet"
            description="A few photos make your profile feel trusted, lived-in, and easier to say yes to."
          />
        )}
      </PanelCard>

      <PanelCard>
        <SectionIntro
          eyebrow="Shortcuts"
          title="Everything around your profile"
          subtitle="Keep the side destinations grouped here instead of mixing them into the main edit flow."
        />
        <View style={styles.navWrap}>
          <Button mode="outlined" onPress={() => navigation.navigate('Settings')}>Settings</Button>
          <Button mode="outlined" onPress={() => navigation.navigate('Friends')}>Connections</Button>
          <Button mode="outlined" onPress={() => navigation.navigate('Reviews')}>Reviews</Button>
          <Button mode="outlined" onPress={() => navigation.navigate('Notifications')}>Notifications</Button>
          <Button mode="outlined" onPress={() => navigation.navigate('HelpSupport')}>Help & Support</Button>
          <Button mode="outlined" onPress={() => navigation.navigate('PrivacyPolicy')}>Privacy</Button>
          <Button mode="outlined" onPress={() => navigation.navigate('TermsOfService')}>Terms</Button>
        </View>
      </PanelCard>

      {updateMutation.error ? (
        <HelperText type="error" visible>
          {getErrorMessage(updateMutation.error, 'Unable to update profile.')}
        </HelperText>
      ) : null}

      {updateMutation.isSuccess ? (
        <PanelCard tone="accent">
          <AccentPill tone="secondary">Saved</AccentPill>
          <Text style={styles.savedText}>Profile glow-up saved.</Text>
        </PanelCard>
      ) : null}

      <PanelCard>
        <SectionIntro
          eyebrow="Actions"
          title="Keep it current"
          subtitle="Save edits, pull the latest version, or end your session from here."
        />
        <View style={styles.actionRow}>
          <Button
            mode="contained"
            buttonColor={appColors.primary}
            onPress={() => updateMutation.mutate()}
            loading={updateMutation.isPending}
            style={styles.primaryAction}
          >
            Save glow-up
          </Button>
          <Button mode="outlined" onPress={() => void refreshProfile()} style={styles.secondaryAction}>
            Refresh
          </Button>
        </View>
        <Button mode="text" onPress={() => void signOut()} style={styles.signOut} textColor={appColors.danger}>
          Sign out
        </Button>
      </PanelCard>
    </AppScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  heroCard: {
    gap: 12,
    borderColor: '#bff0e6',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroName: {
    color: appColors.ink,
    fontFamily: appTypography.headingDisplay,
    letterSpacing: -0.8,
  },
  heroEmail: {
    color: appColors.mutedInk,
  },
  heroSubline: {
    color: appColors.mutedInk,
    lineHeight: 20,
  },
  input: {
    backgroundColor: appColors.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flexInput: {
    flex: 1,
  },
  half: {
    flex: 1,
  },
  inlineWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: '#ffe7f0',
    borderWidth: 1,
    borderColor: '#ffc9da',
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 4,
  },
  interestText: {
    color: appColors.primaryDeep,
    fontWeight: '700',
  },
  albumGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  avatarPreview: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  avatarFallback: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffe4ee',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  avatarFallbackText: {
    color: appColors.primaryDeep,
    fontSize: 32,
    fontFamily: appTypography.headingDisplay,
  },
  inlineButton: {
    alignSelf: 'flex-start',
  },
  albumTile: {
    width: '47%',
    gap: 6,
    backgroundColor: '#fffafc',
    borderWidth: 1,
    borderColor: '#f3dfe8',
    borderRadius: 20,
    padding: 8,
  },
  albumPreview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    backgroundColor: '#edf2f8',
  },
  albumText: {
    color: appColors.mutedInk,
  },
  navWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  savedText: {
    color: appColors.ink,
    fontFamily: appTypography.heading,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  primaryAction: {
    flexGrow: 1,
  },
  secondaryAction: {
    flexGrow: 1,
  },
  signOut: {
    alignSelf: 'flex-start',
  },
});
