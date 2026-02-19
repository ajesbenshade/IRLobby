import { MD3DarkTheme, MD3LightTheme, configureFonts, type MD3Theme } from 'react-native-paper';

const fontConfig = configureFonts({
  config: {
    fontFamily: 'System',
  },
});

// Web parity tokens (see client/src/index.css)
const primaryColor = '#6366F1';
const secondaryColor = '#F59E0B';
const tertiaryColor = '#10B981';

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  fonts: fontConfig,
  colors: {
    ...MD3LightTheme.colors,
    primary: primaryColor,
    secondary: secondaryColor,
    tertiary: tertiaryColor,
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
    tertiary: tertiaryColor,
  },
};
