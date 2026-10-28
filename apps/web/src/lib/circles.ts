import { apiRequest } from '@/lib/queryClient';
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

const statusOf = (error: unknown): number | undefined => {
  if (typeof error === 'object' && error && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
};

const bodyOf = (error: unknown) =>
  typeof error === 'object' && error && 'body' in error
    ? (error as { body?: unknown }).body
    : undefined;

const raise = (error: unknown, fallback: string): never => {
  const parsed = circleFailureMessage(bodyOf(error), fallback);
  let message = parsed.message;
  if (message === fallback && error instanceof Error) {
    const stripped = error.message.replace(/^\d+:\s*/, '').trim();
    if (stripped) message = stripped;
  }
  if (parsed.code === 'last_admin') message = CIRCLE_COPY.lastAdmin;
  throw new CircleClientError(message, statusOf(error), parsed.code);
};

const readBody = async (response: Response) => {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text) as unknown;
};

const request = async (method: 'GET' | 'POST', url: string, body?: unknown) => {
  const response = await apiRequest(method, url, body);
  return readBody(response);
};

export async function fetchCircles(query = ''): Promise<CircleSummary[]> {
  try {
    return normalizeCircleSummaries(await request('GET', circlePaths.list(query)));
  } catch (error) {
    return raise(error, CIRCLE_COPY.loadFailed);
  }
}

export async function fetchCircle(id: number | string): Promise<CircleDetail> {
  try {
    const circle = normalizeCircleDetail(await request('GET', circlePaths.detail(id)));
    if (!circle) throw new CircleClientError(CIRCLE_COPY.loadFailed);
    return circle;
  } catch (error) {
    if (error instanceof CircleClientError) throw error;
    return raise(error, CIRCLE_COPY.loadFailed);
  }
}

export async function createCircle(payload: {
  name: string;
  description: string;
}): Promise<CircleDetail> {
  try {
    const circle = normalizeCircleDetail(await request('POST', circlePaths.create(), payload));
    if (!circle) throw new CircleClientError(CIRCLE_COPY.saveFailed);
    return circle;
  } catch (error) {
    if (error instanceof CircleClientError) throw error;
    return raise(error, CIRCLE_COPY.saveFailed);
  }
}

export async function requestToJoinCircle(id: number | string): Promise<void> {
  try {
    await request('POST', circlePaths.joinRequests(id), {});
  } catch (error) {
    return raise(error, CIRCLE_COPY.requestFailed);
  }
}

export async function fetchJoinRequests(id: number | string): Promise<CircleJoinRequestRow[]> {
  try {
    return normalizeJoinRequests(await request('GET', circlePaths.joinRequests(id)));
  } catch (error) {
    return raise(error, CIRCLE_COPY.loadFailed);
  }
}

export async function approveJoinRequest(
  id: number | string,
  requestId: number | string,
): Promise<void> {
  try {
    await request('POST', circlePaths.approveRequest(id, requestId), {});
  } catch (error) {
    return raise(error, CIRCLE_COPY.saveFailed);
  }
}

export async function declineJoinRequest(
  id: number | string,
  requestId: number | string,
): Promise<void> {
  try {
    await request('POST', circlePaths.declineRequest(id, requestId), {});
  } catch (error) {
    return raise(error, CIRCLE_COPY.saveFailed);
  }
}

export async function sendCircleInvites(
  id: number | string,
  userIds: Array<number | string>,
): Promise<{ invites: CircleInviteRow[]; errors: CircleInviteError[] }> {
  try {
    return normalizeInvites(
      await request('POST', circlePaths.invites(id), { user_ids: userIds.map(coerceId) }),
    );
  } catch (error) {
    return raise(error, CIRCLE_COPY.sendFailed);
  }
}

export async function fetchInviteInbox(): Promise<CircleInviteRow[]> {
  try {
    return normalizeInvites(await request('GET', circlePaths.inbox())).invites;
  } catch (error) {
    return raise(error, CIRCLE_COPY.loadFailed);
  }
}

export async function acceptCircleInvite(inviteId: number | string): Promise<void> {
  try {
    await request('POST', circlePaths.acceptInvite(inviteId), {});
  } catch (error) {
    return raise(error, CIRCLE_COPY.saveFailed);
  }
}

export async function declineCircleInvite(inviteId: number | string): Promise<void> {
  try {
    await request('POST', circlePaths.declineInvite(inviteId), {});
  } catch (error) {
    return raise(error, CIRCLE_COPY.saveFailed);
  }
}

export async function fetchCircleMembers(id: number | string): Promise<CirclePerson[]> {
  try {
    return normalizePeople(await request('GET', circlePaths.members(id)));
  } catch (error) {
    return raise(error, CIRCLE_COPY.loadFailed);
  }
}

export async function removeCircleMember(
  id: number | string,
  userId: number | string,
): Promise<void> {
  try {
    await request('POST', circlePaths.removeMember(id, userId), {});
  } catch (error) {
    return raise(error, CIRCLE_COPY.saveFailed);
  }
}

export async function makeCircleAdmin(id: number | string, userId: number | string): Promise<void> {
  try {
    await request('POST', circlePaths.makeAdmin(id, userId), {});
  } catch (error) {
    return raise(error, CIRCLE_COPY.saveFailed);
  }
}

export async function removeCircleAdmin(
  id: number | string,
  userId: number | string,
): Promise<void> {
  try {
    await request('POST', circlePaths.removeAdmin(id, userId), {});
  } catch (error) {
    return raise(error, CIRCLE_COPY.saveFailed);
  }
}

export async function leaveCircle(id: number | string): Promise<void> {
  try {
    await request('POST', circlePaths.leave(id), {});
  } catch (error) {
    return raise(error, CIRCLE_COPY.saveFailed);
  }
}

export async function searchCirclePeople(id: number | string, query = ''): Promise<CirclePerson[]> {
  try {
    return normalizePeople(await request('GET', circlePaths.people(id, query)));
  } catch (error) {
    return raise(error, CIRCLE_COPY.loadFailed);
  }
}

export async function reportCircle(
  id: number | string,
  reason: CircleReportReason,
  description = '',
): Promise<void> {
  try {
    await request('POST', circlePaths.report(id), { reason, description });
  } catch (error) {
    return raise(error, CIRCLE_COPY.reportFailed);
  }
}
