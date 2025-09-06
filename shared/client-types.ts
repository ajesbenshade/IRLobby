// User types
export type User = {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
  bio: string | null;
  age: number | null;
  gender: string | null;
  interests: string[];
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  isHost: boolean;
  rating: number;
  reviewCount: number;
  activityCount: number;
  friendCount: number;
  emailNotifications: boolean;
  activityReminders: boolean;
  newMatchNotifications: boolean;
  messageNotifications: boolean;
  profileVisibility: string;
  locationSharing: boolean;
  showAge: boolean;
  showEmail: boolean;
  theme: string;
  language: string;
  distanceUnit: string;
  maxDistance: number;
  createdAt: Date;
  updatedAt: Date;
};

// Activity types
export type Activity = {
  id: number;
  hostId: string;
  title: string;
  description: string | null;
  category: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  dateTime: Date;
  endDateTime: Date | null;
  maxParticipants: number;
  currentParticipants: number;
  waitlistCount: number;
  isPrivate: boolean;
  tags: string[];
  imageUrl: string | null;
  imageUrls: string[];
  price: number;
  currency: string;
  requiresApproval: boolean;
  ageRestriction: string | null;
  skillLevel: string | null;
  equipmentProvided: boolean;
  equipmentRequired: string | null;
  weatherDependent: boolean;
  status: string;
  cancellationReason: string | null;
  recurringPattern: string | null;
  reminderSent: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// Chat types
export type ChatMessage = {
  id: number;
  chatRoomId: number;
  senderId: string;
  message: string;
  messageType: string;
  createdAt: Date;
};

// Activity insert type (schema moved to client-side)
export type InsertActivity = {
  title: string;
  description?: string;
  category: string;
  location: string;
  latitude?: number;
  longitude?: number;
  dateTime: Date;
  endDateTime?: Date;
  maxParticipants: number;
  isPrivate?: boolean;
  tags?: string[];
  imageUrl?: string;
  imageUrls?: string[];
  price?: number;
  currency?: string;
  requiresApproval?: boolean;
  ageRestriction?: string;
  skillLevel?: string;
  equipmentProvided?: boolean;
  equipmentRequired?: string;
  weatherDependent?: boolean;
};
