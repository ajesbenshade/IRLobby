import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { LibreBaskerville_700Bold, useFonts } from '@expo-google-fonts/libre-baskerville';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@providers/ErrorBoundary';
import { refreshAppConfig } from '@services/appConfig';
import { initAnalytics, trackAppOpen, wrapWithAnalytics } from '@services/analytics';
import { lightTheme, palette } from '@theme/index';
import { DesignFramesStudio } from './src/screenshots/DesignFramesStudio';
import { StoreScreenshotStudio } from './src/screenshots/StoreScreenshotStudio';
import { initMonitoring } from './src/lib/monitoring';

initMonitoring();
initAnalytics();

function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    LibreBaskerville_700Bold,
  });

  const theme = lightTheme;
  const backgroundColor = palette.background;
  const screenshotMode = process.env.EXPO_PUBLIC_SCREENSHOT_MODE === '1';
  const screenshotScene = process.env.EXPO_PUBLIC_SCREENSHOT_SCENE ?? '';
  const designFramesMode =
    screenshotMode && (screenshotScene === 'design-frames' || screenshotScene.startsWith('frame-'));

  useEffect(() => {
    void trackAppOpen();
    // Admin contact and Terms/Privacy links come from the server (silent fallback to bundled values).
    if (process.env.EXPO_PUBLIC_SCREENSHOT_MODE !== '1') {
      void refreshAppConfig();
    }
  }, []);

  const AppNavigator = screenshotMode
    ? null
    : require('./src/navigation/AppNavigator').AppNavigator;
  const AuthProvider = screenshotMode
    ? null
    : require('./src/providers/AuthProvider').AuthProvider;
  const QueryProvider = screenshotMode
    ? null
    : require('./src/providers/queryClient').QueryProvider;

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            {screenshotMode ? (
              <>
                <StatusBar style="dark" backgroundColor={palette.background} />
                {designFramesMode ? <DesignFramesStudio /> : <StoreScreenshotStudio />}
              </>
            ) : (
              <QueryProvider>
                <AuthProvider>
                  <StatusBar style="dark" backgroundColor={backgroundColor} />
                  <AppNavigator />
                </AuthProvider>
              </QueryProvider>
            )}
          </PaperProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

export default wrapWithAnalytics(App);
