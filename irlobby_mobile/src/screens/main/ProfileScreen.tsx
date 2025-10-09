import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { useAuth } from '@hooks/useAuth';

export const ProfileScreen = () => {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall">Profile</Text>
      <Text variant="bodyMedium">
        {user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email : 'Guest'}
      </Text>
      <Button mode="outlined" onPress={() => void signOut()} style={styles.button}>
        Sign out
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    gap: 12,
  },
  button: {
    alignSelf: 'flex-start',
  },
});
