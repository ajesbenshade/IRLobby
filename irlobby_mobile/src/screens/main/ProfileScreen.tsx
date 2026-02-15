import { useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Surface, Text, TextInput } from 'react-native-paper';
import { API_ROUTES } from '@shared/schema';

import { useAuth } from '@hooks/useAuth';
import { api } from '@services/apiClient';
import { updateOnboarding } from '@services/authService';
import { getErrorMessage } from '@utils/error';

import type { MainStackParamList } from '@navigation/types';

export const ProfileScreen = () => {
  const MAX_INTERESTS = 20;
  const MAX_PHOTOS = 12;

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

    if (!result.canceled && result.assets[0]?.uri) {
      setAvatarUrl(result.assets[0].uri);
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
      const selectedUris = result.assets.map((asset) => asset.uri).filter(Boolean);
      setPhotoAlbum((previous) => [...previous, ...selectedUris].slice(0, MAX_PHOTOS));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Surface elevation={2} style={styles.card}>
        <Text variant="headlineSmall">Profile</Text>
        <Text variant="bodyMedium">{user?.email ?? 'Not signed in'}</Text>

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
          onChangeText={setAvatarUrl}
          autoCapitalize="none"
          style={styles.input}
        />
        <Button mode="outlined" onPress={pickAvatarFromLibrary}>
          Pick avatar from library
        </Button>

        <Text variant="titleMedium">Interests ({interests.length}/{MAX_INTERESTS})</Text>
        <View style={styles.row}>
          <TextInput
            label="Add interest"
            value={interestInput}
            onChangeText={setInterestInput}
            style={[styles.input, styles.flexInput]}
          />
          <Button mode="outlined" onPress={addInterest} disabled={!interestInput.trim()}>
            Add
          </Button>
        </View>
        {interests.length > 0 && (
          <View style={styles.inlineWrap}>
            {interests.map((interest) => (
              <Button
                key={interest}
                mode="text"
                compact
                onPress={() => removeInterest(interest)}
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
        {photoAlbum.length > 0 && (
          <View style={styles.albumList}>
            {photoAlbum.map((photo) => (
              <View key={photo} style={styles.albumRow}>
                <Text numberOfLines={1} style={styles.albumText}>
                  {photo}
                </Text>
                <Button mode="text" compact onPress={() => removePhoto(photo)}>
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
          <Button mode="contained" onPress={() => updateMutation.mutate()} loading={updateMutation.isPending}>
            Save profile
          </Button>
          <Button mode="outlined" onPress={() => void refreshProfile()}>
            Refresh
          </Button>
        </View>

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
            Help
          </Button>
          <Button mode="outlined" onPress={() => navigation.navigate('PrivacyPolicy')}>
            Privacy
          </Button>
          <Button mode="outlined" onPress={() => navigation.navigate('TermsOfService')}>
            Terms
          </Button>
        </View>

        <Button mode="text" onPress={() => void signOut()} style={styles.signOut}>
          Sign out
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
});
