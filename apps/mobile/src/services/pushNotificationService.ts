import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { API_ROUTES } from '@shared/schema';

import { api } from './apiClient';

const resolveProjectId = (): string | undefined => {
  const extraProjectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const easProjectId = Constants.easConfig?.projectId;
  return extraProjectId ?? easProjectId;
};

const requestExpoPushToken = async (): Promise<string | null> => {
  if (!Device.isDevice) {
    return null;
  }

  const currentPermissions = await Notifications.getPermissionsAsync();
  let finalStatus = currentPermissions.status;

  if (finalStatus !== 'granted') {
    const requestedPermissions = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermissions.status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId = resolveProjectId();
  if (!projectId) {
    return null;
  }

  const pushToken = await Notifications.getExpoPushTokenAsync({ projectId });
  return pushToken.data || null;
};

export const registerCurrentDevicePushToken = async (): Promise<string | null> => {
  try {
    const token = await requestExpoPushToken();
    if (!token) {
      return null;
    }

    await api.post(API_ROUTES.USER_PUSH_TOKENS, {
      token,
      platform: Platform.OS,
    });

    return token;
  } catch (error) {
    console.warn('[pushNotificationService] Failed to register push token', error);
    return null;
  }
};

export const deactivatePushTokens = async (token?: string): Promise<void> => {
  try {
    await api.delete(API_ROUTES.USER_PUSH_TOKENS_DEACTIVATE, {
      data: token ? { token } : {},
    });
  } catch (error) {
    console.warn('[pushNotificationService] Failed to deactivate push token(s)', error);
  }
};
