import { api } from './apiClient';

import { normalizeFamilyMembers } from '../foyer/family';
import type { WhosComingResponse } from '../foyer/logic';

export type ChurchRecord = {
  id: number;
  name: string;
  is_verified?: boolean;
};

export type HouseholdChild = {
  id: number;
  name: string;
  date_of_birth: string;
  sex?: string | null;
  age: number;
};

/** The backend stores only spouse and child. */
export type FamilyRelationship = 'spouse' | 'child';

/** One person in "My family". Adults carry no birth data; children carry month and year only. */
export type FamilyMember = {
  id: number;
  name: string;
  relationship: FamilyRelationship;
  sex?: 'male' | 'female' | string | null;
  birth_month?: number | null;
  birth_year?: number | null;
  age?: number | null;
};

export type HouseholdResponse = {
  children?: Array<HouseholdChild & { relationship?: string; birth_month?: number | null; birth_year?: number | null }>;
  members?: FamilyMember[];
};

export type RsvpResult = {
  status: string;
  include_self: boolean;
  dependent_ids: number[];
  member_ids?: number[];
  people_count: number;
  going_count?: number;
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
  const response = await api.get<T[] | { results?: T[] }>('/api/activities/going/');
  const data = response.data;
  return Array.isArray(data) ? data : data.results ?? [];
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

export const addFamilyMember = async (payload: {
  name: string;
  relationship: FamilyRelationship;
  sex?: 'male' | 'female' | null;
  birth_month?: number;
  birth_year?: number;
}): Promise<void> => {
  const body: Record<string, unknown> = { name: payload.name, relationship: payload.relationship };
  if (payload.sex) {
    body.sex = payload.sex;
  }
  if (payload.relationship === 'child') {
    body.birth_month = payload.birth_month;
    body.birth_year = payload.birth_year;
  }
  await api.post('/api/users/household/', body);
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
