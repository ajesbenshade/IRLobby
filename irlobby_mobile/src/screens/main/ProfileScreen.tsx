import { useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, HelperText, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_ROUTES } from '@shared/schema';

import { useAuth } from '@hooks/useAuth';
import { api } from '@services/apiClient';
import { updateOnboarding } from '@services/authService';
import { getErrorMessage } from '@utils/error';

import type { MainStackParamList } from '@navigation/types';

export const ProfileScreen = () => {
  const MAX_INTERESTS = 20;
  const MAX_PHOTOS = 12;

  const isRemoteHttpUrl = (value: string) => {
    const trimmed = value.trim();
    return trimmed.startsWith('https://') || trimmed.startsWith('http://');
  };

  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { user, signOut, refreshProfile } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarPreviewUri, setAvatarPreviewUri] = useState('');
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
    setAvatarPreviewUri(user?.avatarUrl ?? '');
    setInterests(user?.interests ?? []);
    setPhotoAlbum(user?.photoAlbum ?? []);
    setInterestInput('');
    setPhotoInput('');
  }, [user]);

  const trimmedAvatarUrl = avatarUrl.trim();
  const avatarUrlIsSavable = trimmedAvatarUrl === '' || isRemoteHttpUrl(trimmedAvatarUrl);
  const avatarImageUri = avatarPreviewUri.trim() || trimmedAvatarUrl;
  const hasUnsavablePhotos = photoAlbum.some((value) => {
    const trimmed = value.trim();
    return trimmed !== '' && !isRemoteHttpUrl(trimmed);
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const avatarUrlForServer =
        trimmedAvatarUrl === '' || isRemoteHttpUrl(trimmedAvatarUrl) ? trimmedAvatarUrl : undefined;

      const photoAlbumForServer = photoAlbum.map((value) => value.trim()).filter(isRemoteHttpUrl);

      await api.patch(API_ROUTES.USER_PROFILE, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        bio: bio.trim(),
        location: city.trim(),
        ...(avatarUrlForServer !== undefined ? { avatar_url: avatarUrlForServer } : {}),
      });

      await updateOnboarding({
        bio: bio.trim(),
        city: city.trim(),
        ...(avatarUrlForServer !== undefined ? { avatar_url: avatarUrlForServer } : {}),
        interests,
        photo_album: photoAlbumForServer,
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

  const removePhoto = (photo: string) => {
    setPhotoAlbum((previous) => previous.filter((value) => value !== photo));
  };

  const pickAvatarFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.uri) {
        setAvatarPreviewUri(asset.uri);
      }

      void Haptics.selectionAsync();
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
      quality: 0.7,
      selectionLimit: MAX_PHOTOS - photoAlbum.length,
    });

    if (!result.canceled) {
      const selected = result.assets.map((asset) => asset.uri).filter(Boolean);
      setPhotoAlbum((previous) => [...previous, ...selected].slice(0, MAX_PHOTOS));
      void Haptics.selectionAsync();
    }
  };

  const initials =
    `${firstName.trim().slice(0, 1)}${lastName.trim().slice(0, 1)}`.toUpperCase() ||
    (user?.email?.trim().slice(0, 1).toUpperCase() ?? 'U');

  const displayName =
    firstName.trim() && lastName.trim()
      ? `${firstName.trim()} ${lastName.trim()}`
      : user?.email?.split('@')[0] || 'User';

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
      <Surface elevation={1} style={styles.header}>
        <View style={styles.headerInner}>
          {avatarImageUri.trim() ? (
            <Avatar.Image
              size={96}
              source={{ uri: avatarImageUri.trim() }}
              style={styles.avatar}
            />
          ) : (
            <Avatar.Text
              size={96}
              label={initials}
              style={[styles.avatar, { backgroundColor: theme.colors.primary }]}
              labelStyle={{ color: theme.colors.onPrimary }}
            />
          )}

          <Text variant="headlineSmall" style={styles.headerTitle}>
            {displayName}
          </Text>
          <Text variant="bodyMedium" style={styles.secondaryText}>
            {user?.email ?? 'Not signed in'}
          </Text>
          {!!bio.trim() ? (
            <Text style={styles.headerBio}>{bio.trim()}</Text>
          ) : null}
        </View>
      </Surface>

      <Surface elevation={2} style={styles.card}>
        <Text variant="titleMedium">Edit profile</Text>

        <TextInput
          label="First name"
          value={firstName}
          onChangeText={setFirstName}
          style={styles.input}
        />
        <TextInput label="Last name" value={lastName} onChangeText={setLastName} style={styles.input} />
        <TextInput label="City" value={city} onChangeText={setCity} style={styles.input} />
        <TextInput
          label="Bio"
          value={bio}
          onChangeText={setBio}
          multiline
          style={styles.input}
        />

        <TextInput
          label="Avatar URL"
          value={avatarUrl}
          onChangeText={(value) => {
            setAvatarUrl(value);
            setAvatarPreviewUri(value);
          }}
          autoCapitalize="none"
          style={styles.input}
        />
        {!avatarUrlIsSavable ? (
          <HelperText type="error" visible>
            Avatar must be an http(s) URL to save.
          </HelperText>
        ) : null}
        {hasUnsavablePhotos ? (
          <HelperText type="info" visible>
            Only http(s) photo URLs are saved. Library picks are preview-only.
          </HelperText>
        ) : null}
        <Button mode="outlined" onPress={pickAvatarFromLibrary}>
          Pick avatar from library
        </Button>

        <Text variant="titleMedium">Interests ({interests.length}/{MAX_INTERESTS})</Text>
        <View style={styles.row}>
          <TextInput
            label="Add interest"
            value={interestInput}
            onChangeText={setInterestInput}
            onSubmitEditing={() => {
              void Haptics.selectionAsync();
              addInterest();
            }}
            returnKeyType="done"
            style={[styles.input, styles.flexInput]}
          />
          <Button mode="outlined" onPress={addInterest} disabled={!interestInput.trim()}>
            Add
          </Button>
        </View>
        {interests.length === 0 ? (
          <Text style={styles.secondaryText}>No interests added yet.</Text>
        ) : null}
        {interests.length >= MAX_INTERESTS ? (
          <HelperText type="info" visible>
            Interest limit reached.
          </HelperText>
        ) : null}
        {interests.length > 0 && (
          <View style={styles.inlineWrap}>
            {interests.map((interest) => (
              <Button
                key={interest}
                mode="text"
                compact
                onPress={() => {
                  void Haptics.selectionAsync();
                  removeInterest(interest);
                }}
              >
                {interest} ×
              </Button>
            ))}
          </View>
        )}

        <Text variant="titleMedium">Photo album ({photoAlbum.length}/{MAX_PHOTOS})</Text>
        <View style={styles.row}>
          <TextInput
            label="Photo URL"
            value={photoInput}
            onChangeText={setPhotoInput}
            autoCapitalize="none"
            onSubmitEditing={() => {
              void Haptics.selectionAsync();
              addPhotoByUrl();
            }}
            returnKeyType="done"
            style={[styles.input, styles.flexInput]}
          />
          <Button mode="outlined" onPress={addPhotoByUrl} disabled={!photoInput.trim()}>
            Add
          </Button>
        </View>
        <Button
          mode="outlined"
          onPress={addPhotoFromLibrary}
          disabled={photoAlbum.length >= MAX_PHOTOS}
        >
          Add photo from library
        </Button>
        {photoAlbum.length === 0 ? (
          <Text style={styles.secondaryText}>No photos added yet.</Text>
        ) : null}
        {photoAlbum.length > 0 ? (
          <View style={styles.photoGrid}>
            {photoAlbum.slice(0, 6).map((photo, index) => (
              <View
                key={`${photo}-${index}`}
                style={[styles.photoCell, { borderColor: theme.colors.outlineVariant }]}
              >
                <Image source={{ uri: photo }} style={styles.photo} />
              </View>
            ))}
          </View>
        ) : null}
        {photoAlbum.length > 0 && (
          <View style={styles.albumList}>
            {photoAlbum.map((photo) => (
              <View key={photo} style={styles.albumRow}>
                <Text numberOfLines={1} style={styles.albumText}>
                  {photo}
                </Text>
                <Button
                  mode="text"
                  compact
                  onPress={() => {
                    void Haptics.selectionAsync();
                    removePhoto(photo);
                  }}
                >
                  Remove
                </Button>
              </View>
            ))}
          </View>
        )}

        {updateMutation.error && (
          <HelperText type="error" visible>
            {getErrorMessage(updateMutation.error, 'Unable to update profile.')}
          </HelperText>
        )}

        {updateMutation.isSuccess && (
          <HelperText type="info" visible>
            Profile updated.
          </HelperText>
        )}

        <View style={styles.row}>
          <Button
            mode="contained"
            disabled={!avatarUrlIsSavable}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              updateMutation.mutate();
            }}
            loading={updateMutation.isPending}
          >
            Save profile
          </Button>
          <Button mode="outlined" onPress={() => void refreshProfile()}>
            Refresh
          </Button>
        </View>

        <Text variant="titleMedium">Navigation</Text>

        <View style={styles.row}>
          <Button mode="outlined" onPress={() => navigation.navigate('Settings')}>
            Settings
          </Button>
          <Button mode="outlined" onPress={() => navigation.navigate('Friends')}>
            Connections
          </Button>
        </View>

        <View style={styles.row}>
          <Button mode="outlined" onPress={() => navigation.navigate('Reviews')}>
            Reviews
          </Button>
          <Button mode="outlined" onPress={() => navigation.navigate('Notifications')}>
            Notifications
          </Button>
        </View>

        <View style={styles.row}>
          <Button mode="outlined" onPress={() => navigation.navigate('HelpSupport')}>
            Help & Support
          </Button>
          <Button mode="outlined" onPress={() => navigation.navigate('PrivacyPolicy')}>
            Privacy
          </Button>
          <Button mode="outlined" onPress={() => navigation.navigate('TermsOfService')}>
            Terms
          </Button>
        </View>

        <Button
          mode="text"
          onPress={() => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            void signOut();
          }}
          style={styles.signOut}
        >
          Sign Out
        </Button>
      </Surface>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flexGrow: 1,
  },
  header: {
    borderRadius: 16,
    overflow: 'hidden',
    padding: 16,
    marginBottom: 12,
  },
  headerInner: {
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    marginBottom: 6,
  },
  headerTitle: {
    textAlign: 'center',
  },
  headerBio: {
    opacity: 0.8,
    textAlign: 'center',
    marginTop: 4,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  input: {
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flexInput: {
    flex: 1,
  },
  inlineWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  albumList: {
    gap: 6,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  photoCell: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  albumText: {
    flex: 1,
  },
  signOut: {
    alignSelf: 'flex-start',
  },
  secondaryText: {
    opacity: 0.75,
  },
});
