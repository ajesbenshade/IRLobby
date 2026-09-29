import { api } from './apiClient';

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

export type RsvpResult = {
  status: string;
  include_self: boolean;
  dependent_ids: number[];
  people_count: number;
  going_count?: number;
};

export const fetchWhosComing = async (activityId: number | string): Promise<WhosComingResponse> => {
  const response = await api.get<WhosComingResponse>(`/api/activities/${activityId}/whos-coming/`);
  return response.data;
};

export const postRsvp = async (
  activityId: number | string,
  payload: { include_self: boolean; dependent_ids: number[] },
): Promise<RsvpResult> => {
  const response = await api.post<RsvpResult>(`/api/activities/${activityId}/rsvp/`, payload);
  return response.data;
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
