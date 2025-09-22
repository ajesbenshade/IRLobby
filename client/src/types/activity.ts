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
