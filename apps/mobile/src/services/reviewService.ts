import { api } from './apiClient';
import { API_ROUTES } from '@shared/schema';

export interface ReviewItem {
  id: number;
  reviewerId: number;
  reviewer: string;
  revieweePk: number;
  reviewee: string;
  activityPk: number;
  activity: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface CreateReviewPayload {
  revieweeId: number;
  activityId: number;
  rating: number;
  comment?: string;
}

export const fetchReviews = async (): Promise<ReviewItem[]> => {
  const response = await api.get<ReviewItem[]>(API_ROUTES.REVIEWS);
  return response.data;
};

export const createReview = async (payload: CreateReviewPayload): Promise<ReviewItem> => {
  const response = await api.post<ReviewItem>(API_ROUTES.REVIEWS, payload);
  return response.data;
};
