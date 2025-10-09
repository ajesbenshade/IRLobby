import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

export const ChatScreen = () => (
  <View style={styles.container}>
    <Text variant="headlineSmall">Chat</Text>
    <Text variant="bodyMedium">Messages with your activity matches will appear here.</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
});
