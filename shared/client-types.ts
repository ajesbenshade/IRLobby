import { z } from "zod";

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

// Activity insert schema
export const insertActivitySchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  location: z.string().min(1, "Location is required"),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  dateTime: z.date(),
  endDateTime: z.date().optional(),
  maxParticipants: z.number().min(1, "At least 1 participant required"),
  isPrivate: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  imageUrl: z.string().optional(),
  imageUrls: z.array(z.string()).default([]),
  price: z.number().default(0),
  currency: z.string().default("USD"),
  requiresApproval: z.boolean().default(false),
  ageRestriction: z.string().optional(),
  skillLevel: z.string().optional(),
  equipmentProvided: z.boolean().default(false),
  equipmentRequired: z.string().optional(),
  weatherDependent: z.boolean().default(false),
});

export type InsertActivity = z.infer<typeof insertActivitySchema>;
