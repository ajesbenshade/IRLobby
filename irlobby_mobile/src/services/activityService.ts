import { api } from './apiClient';
import { API_ROUTES, API_ROUTE_BUILDERS } from '@shared/schema';

import type { Activity } from '../types/activity';

export interface ActivityFetchFilters {
  category?: string;
  location?: string;
  tags?: string[];
  radius?: number;
  skill_level?: string;
  age_restriction?: string;
  visibility?: string;
  price_min?: number;
  price_max?: number;
  date_from?: string;
  date_to?: string;
}

export const fetchActivities = async (filters?: ActivityFetchFilters): Promise<Activity[]> => {
  const response = await api.get<Activity[]>(API_ROUTES.ACTIVITIES, {
    params: filters,
  });
  return response.data;
};

export const fetchHostedActivities = async (): Promise<Activity[]> => {
  const response = await api.get<Activity[]>(API_ROUTES.ACTIVITIES_HOSTED);
  return response.data;
};

export interface CreateActivityPayload {
  title: string;
  description: string;
  category?: string;
  location: string;
  latitude: number;
  longitude: number;
  time: string;
  end_time?: string;
  capacity: number;
  visibility?: string[];
  is_private?: boolean;
  requires_approval?: boolean;
  price?: number;
  currency?: string;
  age_restriction?: string;
  skill_level?: string;
  equipment_provided?: boolean;
  equipment_required?: string;
  weather_dependent?: boolean;
  tags?: string[];
  images?: string[];
}

export const createActivity = async (payload: CreateActivityPayload): Promise<Activity> => {
  const response = await api.post<Activity>(API_ROUTES.ACTIVITIES, {
    ...payload,
    tags: payload.tags ?? [],
    images: payload.images ?? [],
  });
  return response.data;
};

export const joinActivity = async (activityId: number | string): Promise<{ message: string }> => {
  const response = await api.post<{ message: string }>(API_ROUTE_BUILDERS.activityJoin(activityId));
  return response.data;
};

export const leaveActivity = async (activityId: number | string): Promise<{ message: string }> => {
  const response = await api.post<{ message: string }>(API_ROUTE_BUILDERS.activityLeave(activityId));
  return response.data;
};

export interface SwipeActivityResponse {
  message: string;
  matched: boolean;
}

export const swipeActivity = async (
  activityId: number | string,
  direction: 'left' | 'right',
): Promise<SwipeActivityResponse> => {
  const response = await api.post<SwipeActivityResponse>(API_ROUTE_BUILDERS.activitySwipe(activityId), {
    direction,
  });
  return response.data;
};
