import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

export const MatchesScreen = () => (
  <View style={styles.container}>
    <Text variant="headlineSmall">Matches</Text>
    <Text variant="bodyMedium">See your mutual activity matches and approvals.</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
});
