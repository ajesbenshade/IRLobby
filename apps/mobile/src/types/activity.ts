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
  calendar_links?: {
    ics_url?: string | null;
    webcal_url?: string | null;
    google_url?: string | null;
    outlook_url?: string | null;
  } | null;
  my_rsvp?: { status?: string; people_count?: number; include_self?: boolean; dependent_ids?: number[] } | null;
  /** Host cancel (backend PR #36). Absent on the live API until it is deployed. */
  is_cancelled?: boolean;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  status?: 'cancelled' | 'active' | string | null;
  end_time?: string | null;
  /** Require approval (backend, not deployed). `requires_approval` already exists on the live API (legacy), so gate on `my_request_status`. */
  requires_approval?: boolean;
  allow_rerequest?: boolean;
  /** Host's optional decline note, for the requester only (backend adds it; absent until then). */
  my_request_reason?: string | null;
  my_request_status?: 'none' | 'pending' | 'approved' | 'declined' | string | null;
  /** Host/staff only. */
  pending_count?: number;
  list_on_church_calendar?: boolean;
  /** Cap reached by confirmed people (pending requests never count). Absent on older backends. */
  is_full?: boolean;
  photos?: Array<{ id?: number; url?: string; uploaded_by_id?: number | string | null; user_id?: number | string | null; owner_id?: number | string | null }>;
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
