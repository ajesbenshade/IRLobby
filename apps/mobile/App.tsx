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

import { AppNavigator } from '@navigation/AppNavigator';
import { AuthProvider } from '@providers/AuthProvider';
import { QueryProvider } from '@providers/queryClient';
import { darkTheme, lightTheme, palette } from '@theme/index';

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

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <QueryProvider>
            <AuthProvider>
              <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={backgroundColor} />
              <AppNavigator />
            </AuthProvider>
          </QueryProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
