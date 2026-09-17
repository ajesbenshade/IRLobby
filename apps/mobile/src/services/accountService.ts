import { API_ROUTES } from '@shared/schema';

import { api } from './apiClient';

export const ACCOUNT_DELETE_SUCCESS_STATUS = 204;

export async function deleteCurrentAccount(): Promise<void> {
  const response = await api.delete(API_ROUTES.USER_PROFILE_DELETE);

  if (response.status !== ACCOUNT_DELETE_SUCCESS_STATUS) {
    throw new Error('Unable to delete your account.');
  }
}
