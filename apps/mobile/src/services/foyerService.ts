import { api } from './apiClient';

import { isRequireApprovalEnabled, noteActivityPayload } from '../foyer/capabilities';
import { cancelEventBody } from '../foyer/cancel';
import type { DecisionResponse, RequestsResponse } from '../foyer/approval';
import { declineBody } from '../foyer/approval';
import { normalizeFamilyMembers } from '../foyer/family';
import type { WhosComingResponse } from '../foyer/logic';

export type ChurchRecord = {
  id: number;
  name: string;
  is_verified?: boolean;
  latitude?: number | string | null;
  longitude?: number | string | null;
};

export type HouseholdChild = {
  id: number;
  name: string;
  date_of_birth: string;
  sex?: string | null;
  age: number;
};

/** Legacy rows only: older builds could add a spouse. The app no longer chooses or sends a relationship. */
export type FamilyRelationship = 'spouse' | 'child';

/**
 * One person in "My family". Children carry a birth date (or, for rows saved before full birth dates, only a month and
 * year). Legacy spouse rows carry none and read `Adult`.
 */
export type FamilyMember = {
  id: number;
  name: string;
  relationship: FamilyRelationship;
  sex?: 'male' | 'female' | string | null;
  birth_month?: number | null;
  birth_year?: number | null;
  /** Day of the month when the server stored one. `null` for legacy month/year rows. */
  birth_day?: number | null;
  /** Full ISO date, only when the day is known. */
  date_of_birth?: string | null;
  age?: number | null;
};

export type HouseholdResponse = {
  children?: Array<
    HouseholdChild & { relationship?: string; birth_month?: number | null; birth_year?: number | null; birth_day?: number | null; birth_precision?: string | null }
  >;
  members?: Array<
    FamilyMember & { day?: number | null; birth_precision?: string | null }
  >;
};

export type RsvpResult = {
  status: string;
  include_self: boolean;
  dependent_ids: number[];
  member_ids?: number[];
  people_count: number;
  going_count?: number;
  /** Require approval: `pending` means a request was sent and no spot is taken yet. */
  my_request_status?: 'pending' | 'approved' | 'declined' | 'none' | string;
  /** The host's decline note, only for the declined requester. */
  my_request_reason?: string | null;
};

export const fetchWhosComing = async (activityId: number | string): Promise<WhosComingResponse> => {
  const response = await api.get<WhosComingResponse>(`/api/activities/${activityId}/whos-coming/`);
  return response.data;
};

export const postRsvp = async (
  activityId: number | string,
  payload: { include_self: boolean; dependent_ids: number[]; member_ids?: number[] },
): Promise<RsvpResult> => {
  // The server merges dependent_ids and member_ids; sending both keeps older servers working.
  const body = { ...payload, member_ids: payload.member_ids ?? payload.dependent_ids };
  const response = await api.post<RsvpResult>(`/api/activities/${activityId}/rsvp/`, body);
  return response.data;
};

/** Cancels the RSVP: DELETE /api/activities/<id>/rsvp/cancel/ (live). The server also clears the pass. */
export const cancelRsvp = async (activityId: number | string): Promise<void> => {
  await api.delete(`/api/activities/${activityId}/rsvp/cancel/`);
};

/**
 * Withdraws a pending request to join: POST /api/activities/<id>/rsvp/cancel/ (DELETE also works).
 * A declined guest gets 400 "The host declined your request." unless allow_rerequest is on.
 */
export const withdrawJoinRequest = async (activityId: number | string): Promise<void> => {
  await api.post(`/api/activities/${activityId}/rsvp/cancel/`);
};

/**
 * Host cancels the whole gathering: POST /api/activities/<id>/cancel-event/ `{reason?}` (max 280).
 * Only call when `isHostCancelEnabled()`; 404/405 means the backend does not have it yet.
 */
export const cancelEvent = async (activityId: number | string, reason: string): Promise<void> => {
  await api.post(`/api/activities/${activityId}/cancel-event/`, cancelEventBody(reason));
};

export type RequestStatusFilter = 'pending' | 'approved' | 'declined';

/** GET /api/activities/<id>/requests/?status=... (host and staff only). */
export const fetchJoinRequests = async (
  activityId: number | string,
  status: RequestStatusFilter = 'pending',
): Promise<RequestsResponse> => {
  const response = await api.get<Partial<RequestsResponse>>(`/api/activities/${activityId}/requests/`, { params: { status } });
  const data = response.data ?? {};
  return {
    pending_count: Number(data.pending_count ?? 0),
    spots_left: data.spots_left == null ? null : Number(data.spots_left),
    requests: Array.isArray(data.requests) ? data.requests : [],
  };
};

/** POST .../requests/<participant id>/approve/. 409 "Not enough spots for this party."; 400 once started/cancelled/ended. */
export const approveJoinRequest = async (activityId: number | string, requestId: number): Promise<DecisionResponse> => {
  const response = await api.post<DecisionResponse>(`/api/activities/${activityId}/requests/${requestId}/approve/`);
  return response.data;
};

/** POST .../requests/<participant id>/decline/ `{reason?}`. The note goes in the push and, for the declined requester only, comes back as `my_request_reason`. */
export const declineJoinRequest = async (
  activityId: number | string,
  requestId: number,
  note = '',
): Promise<DecisionResponse> => {
  const response = await api.post<DecisionResponse>(
    `/api/activities/${activityId}/requests/${requestId}/decline/`,
    declineBody(note),
  );
  return response.data;
};

/** DELETE /api/swipes/<activity_id>/swipe/ (idempotent). A 404 just means there was nothing to clear. */
export const clearPass = async (activityId: number | string): Promise<boolean> => {
  try {
    const response = await api.delete<{ deleted?: boolean }>(`/api/swipes/${activityId}/swipe/`);
    return response.data?.deleted !== false;
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) {
      return false;
    }
    throw error;
  }
};

export const fetchGoingActivities = async <T>(): Promise<T[]> => {
  // With Require approval the list also carries the viewer's pending/declined requests.
  const params = isRequireApprovalEnabled() ? { include_pending: 'true' } : undefined;
  const response = await api.get<T[] | { results?: T[] }>('/api/activities/going/', params ? { params } : undefined);
  const data = response.data;
  const rows = Array.isArray(data) ? data : data.results ?? [];
  noteActivityPayload(rows);
  return rows;
};

export const fetchChurches = async (query: string): Promise<ChurchRecord[]> => {
  const response = await api.get<ChurchRecord[]>('/api/churches/', { params: { q: query } });
  return Array.isArray(response.data) ? response.data : [];
};

export const createChurch = async (name: string): Promise<ChurchRecord> => {
  const response = await api.post<ChurchRecord>('/api/churches/', { name });
  return response.data;
};

export const fetchHousehold = async (): Promise<HouseholdChild[]> => {
  const response = await api.get<{ children: HouseholdChild[] }>('/api/users/household/');
  return response.data.children ?? [];
};

export const fetchFamilyMembers = async (): Promise<FamilyMember[]> => {
  const response = await api.get<HouseholdResponse>('/api/users/household/');
  return normalizeFamilyMembers(response.data);
};

export type FamilySex = 'male' | 'female';

/** Add family member: name, sex and a full birth date. No relationship is sent; the server defaults to child. */
export const addFamilyMember = async (payload: {
  name: string;
  sex: FamilySex;
  /** `YYYY-MM-DD` */
  date_of_birth: string;
}): Promise<void> => {
  await api.post('/api/users/household/', {
    name: payload.name,
    sex: payload.sex,
    date_of_birth: payload.date_of_birth,
  });
};

/**
 * PATCH /api/users/household/<id>/ (live). `birth_day` adds the day to a month-only child (null clears it back to month-only);
 * `date_of_birth` replaces the full date. Owner only. Returns the same body as POST, including `members`.
 */
export const updateFamilyMember = async (
  id: number,
  patch: { name?: string; sex?: FamilySex; date_of_birth?: string; birth_day?: number | null },
): Promise<void> => {
  await api.patch(`/api/users/household/${id}/`, patch);
};

export const addHouseholdChild = async (payload: {
  name: string;
  date_of_birth: string;
}): Promise<HouseholdChild> => {
  const response = await api.post<HouseholdChild>('/api/users/household/', payload);
  return response.data;
};

export const removeHouseholdChild = async (id: number): Promise<void> => {
  await api.delete(`/api/users/household/${id}/`);
};

export const uploadGatheringPhoto = async (
  activityId: number | string,
  uri: string,
): Promise<{ id: number; url: string }> => {
  const body = new FormData();
  body.append('image', {
    uri,
    name: 'cover.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);
  const response = await api.post<{ id: number; url: string }>(
    `/api/activities/${activityId}/photos/`,
    body,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return response.data;
};

// ---- Attendees (host-only and past-event) ---------------------------------

export type AttendeeAgeBand = 'adult' | '13-17' | 'under 13' | string;

export type HostAttendeePerson = {
  name: string;
  relationship: 'self' | 'spouse' | 'child' | string;
  age_band?: AttendeeAgeBand | null;
};

export type HostAttendeesResponse = {
  going_count: number;
  households?: Array<{ name: string; people: HostAttendeePerson[] }>;
  attendees?: Array<{ user_id: number | null; name: string }>;
};

/**
 * GET /api/activities/<id>/attendees/. Hosts get households; going non-hosts
 * get names after the event starts; everyone else gets 403 (returned as null).
 */
export const fetchAttendees = async (activityId: number | string): Promise<HostAttendeesResponse | null> => {
  try {
    const response = await api.get<HostAttendeesResponse>(`/api/activities/${activityId}/attendees/`);
    return response.data;
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 403 || status === 404) {
      return null;
    }
    throw error;
  }
};

// ---- Photo downloads ------------------------------------------------------

export type DownloadablePhoto = { id: number; filename: string; url: string; expires_at?: string | null };

export class PhotoDownloadUnavailableError extends Error {
  constructor(public readonly reason: 'forbidden' | 'missing') {
    super(reason === 'forbidden' ? 'Photos can only be saved by people who were at this gathering.' : 'Photo downloads are not available yet.');
  }
}

export const fetchPhotoDownloads = async (activityId: number | string): Promise<DownloadablePhoto[]> => {
  try {
    const response = await api.get<{ photos?: DownloadablePhoto[] }>(`/api/activities/${activityId}/photos/download/`);
    return response.data.photos ?? [];
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 403) {
      throw new PhotoDownloadUnavailableError('forbidden');
    }
    if (status === 404) {
      throw new PhotoDownloadUnavailableError('missing');
    }
    throw error;
  }
};

// ---- Profile card, friends, 1:1 chat ---------------------------------------

export type Friendship = 'none' | 'friends' | 'pending_outgoing' | 'pending_incoming' | 'self';

export type MemberProfile = {
  id: number;
  first_name: string;
  avatar_url?: string | null;
  bio?: string | null;
  friendship: Friendship;
  visible: boolean;
  email?: string;
  phone?: string;
};

export type FriendRequestItem = {
  id: number;
  direction: 'incoming' | 'outgoing';
  status: string;
  user: { id: number; first_name: string; avatar_url?: string | null };
  created_at?: string;
};

export type FriendRecord = { user_id: number; first_name: string; avatar_url?: string | null; since?: string };

export type DirectConversation = {
  id: number;
  other_user: { id: number; first_name: string; avatar_url?: string | null };
  last_message?: { id: number; message: string; userId: number; createdAt: string } | null;
  muted: boolean;
  can_send: boolean;
  created_at?: string;
};

const statusOf = (error: unknown) => (error as { response?: { status?: number } })?.response?.status;

/** Resolves null when the profile is blocked/unreachable (404). */
export const fetchMemberProfile = async (userId: number | string): Promise<MemberProfile | null> => {
  try {
    const response = await api.get<MemberProfile>(`/api/users/${userId}/profile/`);
    return response.data;
  } catch (error) {
    if (statusOf(error) === 404) {
      return null;
    }
    throw error;
  }
};

export const reportMember = async (
  userId: number | string,
  payload: { reason: string; description?: string },
): Promise<void> => {
  await api.post(`/api/users/${userId}/report/`, {
    reason: payload.reason,
    ...(payload.description?.trim() ? { description: payload.description.trim() } : {}),
  });
};

export const sendFriendRequest = async (userId: number | string): Promise<FriendRequestItem> => {
  const response = await api.post<FriendRequestItem>('/api/friends/requests/', { user_id: Number(userId) });
  return response.data;
};

export const fetchFriendRequests = async (): Promise<{ incoming: FriendRequestItem[]; outgoing: FriendRequestItem[] }> => {
  const response = await api.get<{ incoming?: FriendRequestItem[]; outgoing?: FriendRequestItem[] }>(
    '/api/friends/requests/',
  );
  return { incoming: response.data.incoming ?? [], outgoing: response.data.outgoing ?? [] };
};

export const acceptFriendRequest = async (requestId: number): Promise<void> => {
  await api.post(`/api/friends/requests/${requestId}/accept/`);
};

export const declineFriendRequest = async (requestId: number): Promise<void> => {
  await api.post(`/api/friends/requests/${requestId}/decline/`);
};

export const fetchFriends = async (): Promise<FriendRecord[]> => {
  const response = await api.get<{ friends?: FriendRecord[] }>('/api/friends/');
  return response.data.friends ?? [];
};

/** Unfriends, or withdraws your own pending request. */
export const removeFriend = async (userId: number | string): Promise<void> => {
  await api.delete(`/api/friends/${userId}/`);
};

export const fetchDirectConversations = async (): Promise<DirectConversation[]> => {
  const response = await api.get<{ conversations?: DirectConversation[] }>('/api/messages/direct/');
  return response.data.conversations ?? [];
};

export const openDirectConversation = async (userId: number | string): Promise<DirectConversation> => {
  const response = await api.post<DirectConversation>('/api/messages/direct/', { user_id: Number(userId) });
  return response.data;
};

export const muteDirectConversation = async (id: number | string, muted: boolean): Promise<void> => {
  await api.post(`/api/messages/direct/${id}/mute/`, { muted });
};

export const leaveDirectConversation = async (id: number | string): Promise<void> => {
  await api.post(`/api/messages/direct/${id}/leave/`);
};

export const reportDirectConversation = async (
  id: number | string,
  payload: { reason: string; description?: string },
): Promise<void> => {
  await api.post(`/api/messages/direct/${id}/report/`, payload);
};

export const blockDirectConversation = async (id: number | string): Promise<void> => {
  await api.post(`/api/messages/direct/${id}/block/`);
};

export type BlockedPerson = { id: number; blocked: number; blocked_username?: string };

export const fetchBlockedPeople = async (): Promise<BlockedPerson[]> => {
  const response = await api.get<BlockedPerson[] | { results?: BlockedPerson[] }>('/api/moderation/blocked/');
  const data = response.data;
  return Array.isArray(data) ? data : data.results ?? [];
};

// ---- Own profile (visibility, contact, messaging) --------------------------

export type OwnProfileSettings = {
  profile_visibility: 'only_me' | 'church' | 'friends' | 'public';
  phone: string;
  show_email: boolean;
  show_phone: boolean;
  dm_from_shared_events: boolean;
};
