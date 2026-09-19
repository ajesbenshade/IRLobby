import { api } from "./apiClient";
import { track, trackFirstJoinOnce } from "./analytics";
import {
  API_ROUTES,
  API_ROUTE_BUILDERS,
  parseActivityListResponse,
} from "@shared/schema";

import type { Activity } from "../types/activity";

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

export const fetchActivities = async (
  filters?: ActivityFetchFilters
): Promise<Activity[]> => {
  const response = await api.get<Activity[]>(API_ROUTES.ACTIVITIES, {
    params: filters,
  });
  return parseActivityListResponse(response.data) as Activity[];
};

export const fetchHostedActivities = async (): Promise<Activity[]> => {
  const response = await api.get<Activity[]>(API_ROUTES.ACTIVITIES_HOSTED);
  return parseActivityListResponse(response.data) as Activity[];
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
  imageUrls?: string[];
  is_ticketed?: boolean;
  isTicketed?: boolean;
  ticket_price?: number;
  ticketPrice?: number;
  max_tickets?: number;
  maxTickets?: number;
  platform_fee_percent?: number;
}

const activityImagePayload = (payload: CreateActivityPayload) => {
  const images = payload.images ?? payload.imageUrls ?? [];
  return { images, imageUrls: images };
};

export const createActivity = async (
  payload: CreateActivityPayload
): Promise<Activity> => {
  const response = await api.post<Activity>(API_ROUTES.ACTIVITIES, {
    ...payload,
    tags: payload.tags ?? [],
    ...activityImagePayload(payload),
  });
  track("activity_create", {
    activity_id: String(response.data.id),
    category: payload.category ?? "",
  });
  return response.data;
};

export const fetchActivity = async (
  activityId: number | string
): Promise<Activity> => {
  const response = await api.get<Activity>(
    API_ROUTE_BUILDERS.activityDetail(activityId)
  );
  return response.data;
};

export const updateActivity = async (
  activityId: number | string,
  payload: CreateActivityPayload
): Promise<Activity> => {
  const response = await api.patch<Activity>(
    API_ROUTE_BUILDERS.activityDetail(activityId),
    {
      ...payload,
      tags: payload.tags ?? [],
      ...activityImagePayload(payload),
    }
  );
  return response.data;
};

export const joinActivity = async (
  activityId: number | string
): Promise<{ message: string }> => {
  const response = await api.post<{ message: string }>(
    API_ROUTE_BUILDERS.activityJoin(activityId)
  );
  await trackFirstJoinOnce({ activity_id: String(activityId), source: "join_button" });
  return response.data;
};

export const leaveActivity = async (
  activityId: number | string
): Promise<{ message: string }> => {
  const response = await api.post<{ message: string }>(
    API_ROUTE_BUILDERS.activityLeave(activityId)
  );
  return response.data;
};

export interface SwipeActivityResponse {
  message: string;
  matched: boolean;
  matchId?: number;
  conversationId?: number;
}

export const swipeActivity = async (
  activityId: number | string,
  direction: "left" | "right"
): Promise<SwipeActivityResponse> => {
  const response = await api.post<SwipeActivityResponse>(
    API_ROUTE_BUILDERS.activitySwipe(activityId),
    {
      direction,
    }
  );

  if (direction === "right") {
    track("activity_swipe_right", {
      activity_id: String(activityId),
      matched: Boolean(response.data.matched),
    });
    if (response.data.matched) {
      await trackFirstJoinOnce({
        activity_id: String(activityId),
        source: "swipe_match",
      });
    }
  }

  return response.data;
};
