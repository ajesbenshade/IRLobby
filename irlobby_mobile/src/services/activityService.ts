import { api } from './apiClient';

import type { Activity } from '../types/activity';

export const fetchActivities = async (): Promise<Activity[]> => {
  const response = await api.get<Activity[]>('/api/activities/');
  return response.data;
};

export const fetchHostedActivities = async (): Promise<Activity[]> => {
  const response = await api.get<Activity[]>('/api/activities/hosted/');
  return response.data;
};

export interface CreateActivityPayload {
  title: string;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
  time: string;
  capacity: number;
  tags?: string[];
  images?: string[];
}

export const createActivity = async (payload: CreateActivityPayload): Promise<Activity> => {
  const response = await api.post<Activity>('/api/activities/', {
    ...payload,
    tags: payload.tags ?? [],
    images: payload.images ?? [],
  });
  return response.data;
};

export const joinActivity = async (activityId: number | string): Promise<{ message: string }> => {
  const response = await api.post<{ message: string }>(`/api/activities/${activityId}/join/`);
  return response.data;
};

export const leaveActivity = async (activityId: number | string): Promise<{ message: string }> => {
  const response = await api.post<{ message: string }>(`/api/activities/${activityId}/leave/`);
  return response.data;
};
