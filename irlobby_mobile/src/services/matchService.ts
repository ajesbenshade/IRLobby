import { api } from './apiClient';

export interface MatchItem {
  id: number;
  activity: string;
  user_a: string;
  user_b: string;
  created_at: string;
}

export const fetchMatches = async (): Promise<MatchItem[]> => {
  const response = await api.get<MatchItem[]>('/api/matches/');
  return response.data;
};
