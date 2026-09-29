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
  is_approved?: boolean;
  category?: string;
  isPrivate?: boolean;
  requiresApproval?: boolean;
  autoApprove?: boolean;
  isTicketed?: boolean;
  is_ticketed?: boolean;
  ticketPrice?: number | string | null;
  ticket_price?: number | string | null;
  maxTickets?: number | null;
  max_tickets?: number | null;
  ticketsSold?: number | null;
  tickets_sold?: number | null;
  ticketsAvailable?: number | null;
  isSoldOut?: boolean;
  platformFeePercent?: number | string | null;
  audience?: string | null;
  audience_gender?: 'everyone' | 'men' | 'women' | string | null;
  age_min?: number | null;
  age_max?: number | null;
  cover_photo_url?: string | null;
  going_count?: number | null;
  host_name?: string | null;
  host_kind?: 'person' | 'church' | string | null;
  my_rsvp?: { status?: string; people_count?: number; include_self?: boolean; dependent_ids?: number[] } | null;
  photos?: Array<{ id?: number; url?: string }>;
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
  requiresApproval?: boolean;
  autoApprove?: boolean;
  images?: string[];
}

export interface PaginatedResponse<T> {
  count: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}
