import { MD3DarkTheme, MD3LightTheme, configureFonts, type MD3Theme } from 'react-native-paper';

const fontConfig = configureFonts({
  config: {
    fontFamily: 'System',
  },
});

const primaryColor = '#2563eb';
const secondaryColor = '#0ea5e9';

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  fonts: fontConfig,
  colors: {
    ...MD3LightTheme.colors,
    primary: primaryColor,
    secondary: secondaryColor,
    tertiary: '#f97316',
    background: '#f9fafb',
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  fonts: fontConfig,
  colors: {
    ...MD3DarkTheme.colors,
    primary: primaryColor,
    secondary: secondaryColor,
    tertiary: '#f97316',
  },
};
