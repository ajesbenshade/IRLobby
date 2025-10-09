import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

export const DiscoverScreen = () => (
  <View style={styles.container}>
    <Text variant="headlineSmall">Discover</Text>
    <Text variant="bodyMedium">Browse nearby activities with filters and map view.</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
});
