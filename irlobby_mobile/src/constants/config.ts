import Constants from 'expo-constants';

const extra =
  Constants.expoConfig?.extra ??
  // @ts-ignore Expo SDK < 49 compatibility
  Constants.manifest?.extra ??
  {};

export const config = {
  apiBaseUrl: (extra.apiBaseUrl as string | undefined) ?? 'http://localhost:8000',
  websocketUrl: extra.websocketUrl as string | undefined,
  twitterClientId: extra.twitterClientId as string | undefined,
  twitterRedirectUri: extra.twitterRedirectUri as string | undefined,
  googleMapsApiKey: extra.googleMapsApiKey as string | undefined,
};
