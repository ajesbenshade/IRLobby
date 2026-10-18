import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Linking, Platform } from 'react-native';

import { SUPPORT_COPY } from '@constants/foyerCopy';

export type DeviceInfo = {
  appVersion: string | null;
  buildNumber: string | null;
  osName: string;
  osVersion: string | null;
};

/** Version from the app config; build number from the native binary (EAS sets it remotely). */
export const readDeviceInfo = (): DeviceInfo => {
  const nativeBuild = Platform.OS === 'ios' ? Constants.platform?.ios?.buildNumber : null;
  const configBuild =
    Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode != null
        ? String(Constants.expoConfig.android.versionCode)
        : null;
  return {
    appVersion: Constants.expoConfig?.version ?? null,
    buildNumber: nativeBuild ?? configBuild ?? null,
    osName: Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : Platform.OS,
    osVersion: Device.osVersion ?? (Platform.Version != null ? String(Platform.Version) : null),
  };
};

export const mailtoUrl = (subject: string, body?: string, to: string = SUPPORT_COPY.email) => {
  const params = [`subject=${encodeURIComponent(subject)}`];
  if (body) {
    params.push(`body=${encodeURIComponent(body)}`);
  }
  return `mailto:${to}?${params.join('&')}`;
};

/** Body for Send feedback: room to write, then the version lines support needs. Never prints null. */
export const feedbackBody = (info: DeviceInfo = readDeviceInfo()) => {
  const version = info.appVersion ?? 'unknown';
  const build = info.buildNumber ? ` (build ${info.buildNumber})` : '';
  const os = `${info.osName}${info.osVersion ? ` ${info.osVersion}` : ''}`;
  return ['', '', '---', `The Foyer ${version}${build}`, os].join('\n');
};

export const helpMailto = () => mailtoUrl(SUPPORT_COPY.helpSubject);
export const feedbackMailto = (info?: DeviceInfo) => mailtoUrl(SUPPORT_COPY.feedbackSubject, feedbackBody(info));

/** Opens the mail app. Returns false (and the caller shows the address) when no mail app can take it. */
export const openSupportEmail = async (url: string): Promise<boolean> => {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
};
