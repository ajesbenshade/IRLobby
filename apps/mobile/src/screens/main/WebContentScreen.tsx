import { useRoute } from '@react-navigation/native';
import type { ComponentType } from 'react';
import { StyleSheet } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { WebView, type WebViewProps } from 'react-native-webview';

import { View } from '@components/RNCompat';
import type { RouteProp } from '@react-navigation/native';
import type { MainStackParamList } from '@navigation/types';

type WebRoute = RouteProp<MainStackParamList, 'WebContent'>;

const CompatWebView = WebView as unknown as ComponentType<WebViewProps>;

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
    <CompatWebView
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
