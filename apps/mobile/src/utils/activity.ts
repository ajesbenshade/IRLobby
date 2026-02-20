import {
  DEFAULT_REQUIRES_APPROVAL,
  MAX_ACTIVITY_CAPACITY,
  MIN_ACTIVITY_CAPACITY,
} from '@constants/activity';
import type { Activity, ActivityFormData } from '../types/activity';

export const sanitizeActivityCapacity = (capacity: number): number => {
  const numericCapacity = Number.isFinite(capacity) ? Math.trunc(capacity) : MIN_ACTIVITY_CAPACITY;
  if (numericCapacity < MIN_ACTIVITY_CAPACITY) {
    return MIN_ACTIVITY_CAPACITY;
  }
  if (numericCapacity > MAX_ACTIVITY_CAPACITY) {
    return MAX_ACTIVITY_CAPACITY;
  }
  return numericCapacity;
};

export const buildCreateActivityPayload = (formData: ActivityFormData): ActivityFormData => ({
  ...formData,
  capacity: sanitizeActivityCapacity(formData.capacity),
  requiresApproval: formData.requiresApproval ?? DEFAULT_REQUIRES_APPROVAL,
});

export const filterApprovedActivities = (activities: Activity[]): Activity[] =>
  activities.filter((activity) => activity.is_approved !== false);

export const canJoinActivity = (activity: Activity): boolean => {
  if (activity.is_approved === false) {
    return false;
  }

  const capacity = sanitizeActivityCapacity(activity.capacity ?? MAX_ACTIVITY_CAPACITY);
  const participantCount = Math.max(0, Math.trunc(activity.participant_count ?? 0));

  return participantCount < capacity;
};
