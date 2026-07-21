import { API_ROUTES, API_ROUTE_BUILDERS } from '@shared/schema';

import { api } from './apiClient';

export type ReportReason =
  | 'inappropriate'
  | 'spam'
  | 'harassment'
  | 'fake_profile'
  | 'threat'
  | 'other';

export const REPORT_REASON_OPTIONS: Array<{ value: ReportReason; label: string }> = [
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'fake_profile', label: 'Fake profile' },
  { value: 'threat', label: 'Threat or violence' },
  { value: 'other', label: 'Other' },
];

export const blockUser = async (userId: number | string): Promise<void> => {
  await api.post(API_ROUTE_BUILDERS.moderationBlockUser(userId));
};

export const unblockUser = async (userId: number | string): Promise<void> => {
  await api.delete(API_ROUTE_BUILDERS.moderationUnblockUser(userId));
};

export const reportUser = async (payload: {
  reportedUserId: number | string;
  reason: ReportReason;
  description?: string;
}): Promise<void> => {
  await api.post(API_ROUTES.MODERATION_REPORT, {
    reported_user: payload.reportedUserId,
    reason: payload.reason,
    description: payload.description?.trim() || '',
  });
};

export const removeActivityParticipant = async (
  activityId: number | string,
  userId: number | string,
): Promise<void> => {
  await api.delete(API_ROUTE_BUILDERS.activityRemoveParticipant(activityId, userId));
};
