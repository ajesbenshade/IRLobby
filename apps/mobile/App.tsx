import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/outfit';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@providers/ErrorBoundary';
import { darkTheme, lightTheme, palette } from '@theme/index';
import { StoreScreenshotStudio } from './src/screenshots/StoreScreenshotStudio';
import { initMonitoring } from './src/lib/monitoring';

initMonitoring();

export default function App() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
  });

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? darkTheme : lightTheme;
  const backgroundColor = isDark ? palette.darkBackground : palette.background;
  const screenshotMode = process.env.EXPO_PUBLIC_SCREENSHOT_MODE === '1';

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
                <StoreScreenshotStudio />
              </>
            ) : (
              <QueryProvider>
                <AuthProvider>
                  <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={backgroundColor} />
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
