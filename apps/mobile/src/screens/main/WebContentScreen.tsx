import { useRoute } from '@react-navigation/native';
import type { ComponentType } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { WebView, type WebViewProps } from 'react-native-webview';

import { View } from '@components/RNCompat';
import type { RouteProp } from '@react-navigation/native';
import type { MainStackParamList } from '@navigation/types';
import { appColors } from '@theme/index';
import { isAllowedIrlobbyUrl } from '@utils/safeUrl';

type WebRoute = RouteProp<MainStackParamList, 'WebContent'>;

const CompatWebView = WebView as unknown as ComponentType<WebViewProps>;

export const WebContentScreen = () => {
  const route = useRoute<WebRoute>();
  const url = route.params?.url;

  if (!url || !isAllowedIrlobbyUrl(url)) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>This page isn’t available.</Text>
      </View>
    );
  }

  return (
    <CompatWebView
      source={{ uri: url }}
      originWhitelist={['https://irlobby.com', 'https://www.irlobby.com', 'about:blank']}
      javaScriptEnabled
      startInLoadingState
      allowFileAccess={false}
      allowFileAccessFromFileURLs={false}
      allowingReadAccessToURL=""
      setSupportMultipleWindows={false}
      onShouldStartLoadWithRequest={(request) => {
        if (!request.url || request.url === 'about:blank') {
          return true;
        }
        return isAllowedIrlobbyUrl(request.url);
      }}
      renderLoading={() => (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={appColors.primaryGlow} />
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
    backgroundColor: appColors.background,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.background,
    padding: 24,
  },
  fallbackText: {
    color: appColors.mutedInk,
    textAlign: 'center',
  },
});
