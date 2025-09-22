export interface Activity {
  id: number | string;
  title: string;
  description?: string;
  imageUrl?: string;
  images?: string[];
  tags?: string[];
  location?: string;
  latitude?: number;
  longitude?: number;
  time?: string;
  dateTime?: string;
  participant_count?: number;
  capacity?: number;
  currentParticipants?: number;
  maxParticipants?: number;
  category: string;
  isPrivate?: boolean;
  host?: any;
  participants?: any[];
}

export interface ChatMessage {
  id: number | string;
  userId: number | string;
  content: string;
  createdAt?: string;
}
