import { Outfit_700Bold, Outfit_800ExtraBold, useFonts } from '@expo-google-fonts/outfit';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppNavigator } from '@navigation/AppNavigator';
import { AuthProvider } from '@providers/AuthProvider';
import { QueryProvider } from '@providers/queryClient';
import {
  initAnalytics,
  trackAppOpen,
  wrapWithAnalytics,
} from '@services/analytics';
import { appColors, lightTheme } from '@theme/index';

initAnalytics();

function App() {
  const [fontsLoaded] = useFonts({
    Outfit_700Bold,
    Outfit_800ExtraBold,
  });

  useEffect(() => {
    void trackAppOpen();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: appColors.background }}>
      <SafeAreaProvider>
        <PaperProvider theme={lightTheme}>
          <QueryProvider>
            <AuthProvider>
              <StatusBar style="dark" backgroundColor={appColors.background} />
              <AppNavigator />
            </AuthProvider>
          </QueryProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default wrapWithAnalytics(App);
