import { Platform } from 'react-native';

import { config } from '@constants/config';

const trimId = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const getGoogleAuthRequestConfig = () => ({
  clientId: trimId(config.googleExpoClientId),
  iosClientId: trimId(config.googleIosClientId),
  androidClientId: trimId(config.googleAndroidClientId),
  webClientId: trimId(config.googleWebClientId),
  scopes: ['profile', 'email'] as string[],
  selectAccount: true,
});

export const isGoogleAuthReadyForPlatform = () => {
  const ids = getGoogleAuthRequestConfig();
  if (Platform.OS === 'ios') {
    return Boolean(ids.iosClientId);
  }
  if (Platform.OS === 'android') {
    return Boolean(ids.androidClientId);
  }
  return Boolean(ids.webClientId || ids.clientId);
};
