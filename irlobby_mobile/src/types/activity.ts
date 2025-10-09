export interface ActivityHost {
  id: number | string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatarUrl?: string | null;
  bio?: string | null;
}

export interface Activity {
  id: number | string;
  host: ActivityHost | string;
  title: string;
  description?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  time?: string;
  capacity?: number | null;
  tags?: string[];
  images?: string[];
  created_at?: string;
  participant_count?: number;
  category?: string;
  isPrivate?: boolean;
  autoApprove?: boolean;
}

export interface Participant {
  id: number | string;
  firstName?: string;
  lastName?: string;
  email?: string;
  profileImageUrl?: string | null;
  isHost?: boolean;
}

export interface ActivityFilters {
  category?: string;
  maxDistance?: number[];
  priceRange?: number[];
  dateFrom?: Date | null;
  dateTo?: Date | null;
  skillLevel?: string;
  ageRestriction?: string;
  tags?: string[];
  location?: string;
  visibility?: 'public' | 'private' | 'friends';
}

export interface ActivityFormData {
  title: string;
  description?: string;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  time: string;
  capacity: number;
  tags?: string[];
  category?: string;
  isPrivate?: boolean;
  autoApprove?: boolean;
  images?: string[];
}

export interface PaginatedResponse<T> {
  count: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}
