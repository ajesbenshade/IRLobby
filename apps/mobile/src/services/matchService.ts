import { api } from './apiClient';
import { API_ROUTES } from '@shared/schema';

import type { ReliabilitySummary } from '../types/auth';

export interface MatchItem {
  id: number;
  activity_id?: number | null;
  activity: string;
  user_a_id?: number;
  user_a: string;
  user_a_reliability?: ReliabilitySummary;
  user_b_id?: number;
  user_b: string;
  user_b_reliability?: ReliabilitySummary;
  activity_time?: string | null;
  activity_end_time?: string | null;
  review_available?: boolean;
  created_at: string;
}

export const fetchMatches = async (): Promise<MatchItem[]> => {
  const response = await api.get<MatchItem[]>(API_ROUTES.MATCHES);
  return response.data;
};
