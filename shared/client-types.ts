export interface Activity {
  id: number;
  title: string;
  description?: string;
  category: string;
  location: string;
  latitude?: number;
  longitude?: number;
  dateTime: string;
  endDateTime?: string;
  maxParticipants: number;
  currentParticipants: number;
  isPrivate: boolean;
  tags: string[];
  imageUrl?: string;
  imageUrls: string[];
  price: number;
  currency: string;
  requiresApproval: boolean;
  ageRestriction?: string;
  skillLevel?: string;
  equipmentProvided: boolean;
  equipmentRequired?: string;
  weatherDependent: boolean;
  host: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profileImageUrl?: string;
  };
  participants?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profileImageUrl?: string;
  }>;
  status?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  message: string;
  senderId: string;
  sender?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profileImageUrl?: string;
  };
  activityId: number;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  bio?: string;
  interests?: string[];
  rating?: number;
  totalRatings?: number;
  eventsHosted?: number;
  eventsAttended?: number;
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  preferences?: {
    notifications: boolean;
    theme: 'light' | 'dark' | 'system';
    language: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Match {
  id: string;
  activity: Activity;
  user: User;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'match' | 'message' | 'activity_update' | 'reminder';
  title: string;
  message: string;
  isRead: boolean;
  data?: any;
  createdAt: string;
}

export interface Swipe {
  id: string;
  userId: string;
  activityId: number;
  type: 'like' | 'pass';
  createdAt: string;
}
