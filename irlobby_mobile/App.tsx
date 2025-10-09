import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppNavigator } from '@navigation/AppNavigator';
import { AuthProvider } from '@providers/AuthProvider';
import { QueryProvider } from '@providers/queryClient';
import { darkTheme, lightTheme } from '@theme/index';

export default function App() {
  const scheme = useColorScheme();
  const paperTheme = scheme === 'dark' ? darkTheme : lightTheme;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={paperTheme}>
          <QueryProvider>
            <AuthProvider>
              <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
              <AppNavigator />
            </AuthProvider>
          </QueryProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
