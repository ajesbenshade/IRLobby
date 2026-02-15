import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Surface, Text, TextInput } from 'react-native-paper';

import { useAuth } from '@hooks/useAuth';
import { api } from '@services/apiClient';
import { getErrorMessage } from '@utils/error';

export const ProfileScreen = () => {
  const { user, signOut, refreshProfile } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    setFirstName(user?.firstName ?? '');
    setLastName(user?.lastName ?? '');
    setBio(user?.bio ?? '');
    setCity(user?.city ?? '');
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.patch('/api/users/profile/', {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        bio: bio.trim(),
        location: city.trim(),
      });
    },
    onSuccess: async () => {
      await refreshProfile();
    },
  });

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
  signOut: {
    alignSelf: 'flex-start',
  },
});
