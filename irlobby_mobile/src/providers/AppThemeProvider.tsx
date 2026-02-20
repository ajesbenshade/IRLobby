import { createContext, PropsWithChildren, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import type { MD3Theme } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@hooks/useAuth';
import { darkTheme, lightTheme } from '@theme/index';
import { defaultSettings, fetchUserSettings, type PreferenceSettings } from '@services/settingsService';

type ThemePreference = PreferenceSettings['theme'];
type ThemeMode = 'light' | 'dark';

interface AppThemeValue {
  preference: ThemePreference;
  mode: ThemeMode;
  paperTheme: MD3Theme;
}

const AppThemeContext = createContext<AppThemeValue | undefined>(undefined);

const resolveThemeMode = (
  preference: ThemePreference,
  systemScheme: string | null | undefined,
): ThemeMode => {
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }

  return systemScheme === 'dark' ? 'dark' : 'light';
};

export const AppThemeProvider = ({ children }: PropsWithChildren) => {
  const { isAuthenticated } = useAuth();
  const systemScheme = useColorScheme();

  const { data } = useQuery({
    queryKey: ['mobile-settings'],
    queryFn: fetchUserSettings,
    enabled: isAuthenticated,
    placeholderData: defaultSettings,
  });

  const preference = data?.preferences.theme ?? 'system';
  const mode = resolveThemeMode(preference, systemScheme);

  const value = useMemo<AppThemeValue>(() => {
    const paperTheme = mode === 'dark' ? darkTheme : lightTheme;

    return {
      preference,
      mode,
      paperTheme,
    };
  }, [mode, preference]);

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
};

export const useAppTheme = (): AppThemeValue => {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within an AppThemeProvider');
  }
  return context;
};
