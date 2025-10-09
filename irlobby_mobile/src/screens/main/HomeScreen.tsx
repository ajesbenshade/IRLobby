import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

export const HomeScreen = () => (
  <View style={styles.container}>
    <Text variant="headlineSmall">Home</Text>
    <Text variant="bodyMedium">Your personalized activity feed will live here.</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
});
