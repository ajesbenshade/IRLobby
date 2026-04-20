module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@tanstack/.*|nativewind|react-native-css-interop|react-native-reanimated|react-native-gesture-handler|react-native-screens|react-native-safe-area-context|react-native-paper|react-native-vector-icons|react-native-svg|react-native-modal|react-native-maps|react-native-webview)',
  ],
  moduleNameMapper: {
    '^react-native-css-interop/jsx-runtime$': '<rootDir>/node_modules/react-native-css-interop/jsx-runtime',
    '^react-native-css-interop/jsx-dev-runtime$': '<rootDir>/node_modules/react-native-css-interop/jsx-dev-runtime',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@screens/(.*)$': '<rootDir>/src/screens/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@navigation/(.*)$': '<rootDir>/src/navigation/$1',
    '^@constants/(.*)$': '<rootDir>/src/constants/$1',
    '^@theme/(.*)$': '<rootDir>/src/theme/$1',
    '^@providers/(.*)$': '<rootDir>/src/providers/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@shared/(.*)$': '<rootDir>/../../packages/shared/$1',
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['@testing-library/react-native/extend-expect'],
};
