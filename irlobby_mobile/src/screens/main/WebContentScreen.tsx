import { useRoute } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { WebView } from 'react-native-webview';

import type { RouteProp } from '@react-navigation/native';
import type { MainStackParamList } from '@navigation/types';

type WebRoute = RouteProp<MainStackParamList, 'WebContent'>;

export const WebContentScreen = () => {
  const route = useRoute<WebRoute>();

  if (!route.params?.url) {
    return (
      <View style={styles.fallback}>
        <Text>Missing content URL.</Text>
      </View>
    );
  }

  return (
    <WebView
      source={{ uri: route.params.url }}
      startInLoadingState
      renderLoading={() => (
        <View style={styles.loader}>
          <ActivityIndicator animating size="large" />
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
