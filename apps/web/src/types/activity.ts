export interface Activity {
  id: number;
  host: string;
  title: string;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
  time: string;
  capacity: number;
  tags: string[];
  images: string[];
  created_at: string;
  participant_count: number;
  isPrivate?: boolean;
  calendar_links?: {
    ics_url?: string | null;
    webcal_url?: string | null;
    google_url?: string | null;
    outlook_url?: string | null;
  } | null;
}

export interface Message {
  id: number;
  userId: string;
  user: {
    id: number;
    firstName: string;
    email: string;
  };
  message: string;
  createdAt: string;
}

export interface Participant {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  profileImageUrl?: string;
  isHost?: boolean;
}

export interface ChatMessage {
  id: number;
  senderId: string;
  sender: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    profileImageUrl?: string;
  };
  message: string;
  createdAt: string;
}
/** Discover sheet state. Only location, distance, and dates are sent to the list API. */
export interface ActivityFilters {
  location: string;
  maxDistance: number[];
  dateFrom: Date | null;
  dateTo: Date | null;
}
