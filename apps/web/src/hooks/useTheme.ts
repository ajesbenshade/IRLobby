import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('system');

  // Function to get the actual theme (resolving 'system' to 'light' or 'dark')
  const getActualTheme = useCallback((currentTheme: Theme): 'light' | 'dark' => {
    if (currentTheme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return currentTheme;
  }, []);

  // Function to apply theme to document
  const applyTheme = useCallback(
    (newTheme: Theme) => {
      const actualTheme = getActualTheme(newTheme);
      const root = document.documentElement;

      if (actualTheme === 'dark') {
        root.classList.add('dark');
        // Add subtle dark theme enhancements
        root.style.setProperty('--tw-ring-color', 'rgb(59 130 246 / 0.5)');
      } else {
        root.classList.remove('dark');
        // Reset to light theme defaults
        root.style.removeProperty('--tw-ring-color');
      }
    },
    [getActualTheme],
  );

  // Set theme and apply it
  const setThemeAndApply = (newTheme: Theme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  // Listen for system theme changes when theme is 'system'
  useEffect(() => {
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      const handleChange = () => {
        applyTheme('system');
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme, applyTheme]);

  // Apply theme on mount
  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  return {
    theme,
    setTheme: setThemeAndApply,
    actualTheme: getActualTheme(theme),
  };
}
