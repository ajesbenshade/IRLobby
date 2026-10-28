import axios from 'axios';

import {
  CIRCLE_COPY,
  CircleClientError,
  circleFailureMessage,
  circlePaths,
  coerceId,
  normalizeCircleDetail,
  normalizeCircleSummaries,
  normalizeInvites,
  normalizeJoinRequests,
  normalizePeople,
  type CircleDetail,
  type CircleInviteError,
  type CircleInviteRow,
  type CircleJoinRequestRow,
  type CirclePerson,
  type CircleReportReason,
  type CircleSummary,
} from '@shared/circles';

import { api } from './apiClient';

const statusOf = (error: unknown) => (axios.isAxiosError(error) ? error.response?.status : undefined);

const raise = (error: unknown, fallback: string): never => {
  const body = axios.isAxiosError(error) ? error.response?.data : undefined;
  const parsed = circleFailureMessage(body, fallback);
  throw new CircleClientError(parsed.message, statusOf(error), parsed.code);
};

export const fetchCircles = async (query = ''): Promise<CircleSummary[]> => {
  try {
    const response = await api.get(circlePaths.list(query));
    return normalizeCircleSummaries(response.data);
  } catch (error) {
    return raise(error, CIRCLE_COPY.loadFailed);
  }
};

export const fetchCircle = async (id: number | string): Promise<CircleDetail> => {
  try {
    const response = await api.get(circlePaths.detail(id));
    const circle = normalizeCircleDetail(response.data);
    if (!circle) throw new CircleClientError(CIRCLE_COPY.loadFailed);
    return circle;
  } catch (error) {
    if (error instanceof CircleClientError) throw error;
    return raise(error, CIRCLE_COPY.loadFailed);
  }
};

export const createCircle = async (payload: { name: string; description: string }): Promise<CircleDetail> => {
  try {
    const response = await api.post(circlePaths.create(), payload);
    const circle = normalizeCircleDetail(response.data);
    if (!circle) throw new CircleClientError(CIRCLE_COPY.saveFailed);
    return circle;
  } catch (error) {
    if (error instanceof CircleClientError) throw error;
    return raise(error, CIRCLE_COPY.saveFailed);
  }
};

export const requestToJoinCircle = async (id: number | string): Promise<void> => {
  try {
    await api.post(circlePaths.joinRequests(id), {});
  } catch (error) {
    return raise(error, CIRCLE_COPY.requestFailed);
  }
};

export const fetchJoinRequests = async (id: number | string): Promise<CircleJoinRequestRow[]> => {
  try {
    const response = await api.get(circlePaths.joinRequests(id));
    return normalizeJoinRequests(response.data);
  } catch (error) {
    return raise(error, CIRCLE_COPY.loadFailed);
  }
};

export const approveJoinRequest = async (id: number | string, requestId: number | string): Promise<void> => {
  try {
    await api.post(circlePaths.approveRequest(id, requestId), {});
  } catch (error) {
    return raise(error, CIRCLE_COPY.saveFailed);
  }
};

export const declineJoinRequest = async (id: number | string, requestId: number | string): Promise<void> => {
  try {
    await api.post(circlePaths.declineRequest(id, requestId), {});
  } catch (error) {
    return raise(error, CIRCLE_COPY.saveFailed);
  }
};

export const fetchCircleInvites = async (id: number | string): Promise<CircleInviteRow[]> => {
  try {
    const response = await api.get(circlePaths.invites(id));
    return normalizeInvites(response.data).invites;
  } catch (error) {
    return raise(error, CIRCLE_COPY.loadFailed);
  }
};

export const sendCircleInvites = async (
  id: number | string,
  userIds: Array<number | string>,
): Promise<{ invites: CircleInviteRow[]; errors: CircleInviteError[] }> => {
  try {
    const response = await api.post(circlePaths.invites(id), { user_ids: userIds.map(coerceId) });
    return normalizeInvites(response.data);
  } catch (error) {
    return raise(error, CIRCLE_COPY.sendFailed);
  }
};

export const fetchInviteInbox = async (): Promise<CircleInviteRow[]> => {
  try {
    const response = await api.get(circlePaths.inbox());
    return normalizeInvites(response.data).invites;
  } catch (error) {
    return raise(error, CIRCLE_COPY.loadFailed);
  }
};

export const acceptCircleInvite = async (inviteId: number | string): Promise<void> => {
  try {
    await api.post(circlePaths.acceptInvite(inviteId), {});
  } catch (error) {
    return raise(error, CIRCLE_COPY.saveFailed);
  }
};

export const declineCircleInvite = async (inviteId: number | string): Promise<void> => {
  try {
    await api.post(circlePaths.declineInvite(inviteId), {});
  } catch (error) {
    return raise(error, CIRCLE_COPY.saveFailed);
  }
};

export const fetchCircleMembers = async (id: number | string): Promise<CirclePerson[]> => {
  try {
    const response = await api.get(circlePaths.members(id));
    return normalizePeople(response.data);
  } catch (error) {
    return raise(error, CIRCLE_COPY.loadFailed);
  }
};

export const removeCircleMember = async (id: number | string, userId: number | string): Promise<void> => {
  try {
    await api.post(circlePaths.removeMember(id, userId), {});
  } catch (error) {
    return raise(error, CIRCLE_COPY.saveFailed);
  }
};

export const makeCircleAdmin = async (id: number | string, userId: number | string): Promise<void> => {
  try {
    await api.post(circlePaths.makeAdmin(id, userId), {});
  } catch (error) {
    return raise(error, CIRCLE_COPY.saveFailed);
  }
};

export const removeCircleAdmin = async (id: number | string, userId: number | string): Promise<void> => {
  try {
    await api.post(circlePaths.removeAdmin(id, userId), {});
  } catch (error) {
    return raise(error, CIRCLE_COPY.saveFailed);
  }
};

export const leaveCircle = async (id: number | string): Promise<void> => {
  try {
    await api.post(circlePaths.leave(id), {});
  } catch (error) {
    return raise(error, CIRCLE_COPY.saveFailed);
  }
};

export const searchCirclePeople = async (id: number | string, query = ''): Promise<CirclePerson[]> => {
  try {
    const response = await api.get(circlePaths.people(id, query));
    return normalizePeople(response.data);
  } catch (error) {
    return raise(error, CIRCLE_COPY.loadFailed);
  }
};

export const reportCircle = async (
  id: number | string,
  reason: CircleReportReason,
  description = '',
): Promise<void> => {
  try {
    await api.post(circlePaths.report(id), { reason, description });
  } catch (error) {
    return raise(error, CIRCLE_COPY.reportFailed);
  }
};
