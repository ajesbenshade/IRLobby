export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
export type HttpMethod = typeof HTTP_METHODS[number];

export interface ActivityFilters {
  category: string;
  maxDistance: number[];
  priceRange: number[];
  dateFrom: Date | null;
  dateTo: Date | null;
  skillLevel: string;
  ageRestriction: string;
  tags: string[];
  location: string;
}

export const createDefaultActivityFilters = (): ActivityFilters => ({
  category: 'All Categories',
  maxDistance: [25],
  priceRange: [0, 100],
  dateFrom: null,
  dateTo: null,
  skillLevel: 'All Levels',
  ageRestriction: 'All Ages',
  tags: [],
  location: '',
});

export interface SwipePayload {
  activityId: number;
  swipeType: 'like' | 'pass';
}

export interface MatchParticipant {
  id: string | number;
  firstName: string;
  lastName: string;
  email: string;
  profileImageUrl?: string | null;
}

export interface MatchActivitySummary {
  id: number;
  title: string;
  dateTime: string;
  imageUrl?: string | null;
}

export interface MatchSummary {
  id: number;
  status: string;
  activity: MatchActivitySummary;
  participants?: MatchParticipant[];
}

export interface ReviewPayload {
  activityId: number;
  rating: number;
  review: string;
}

export interface ActivityHostProfile {
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string | null;
}

export interface AttendedActivity {
  id: number;
  title: string;
  dateTime: string;
  location: string;
  category?: string;
  host?: ActivityHostProfile;
}
