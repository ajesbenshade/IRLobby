export interface UserProfile {
  id: number | string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  interests?: string[];
  preferences?: Record<string, unknown>;
  isHost?: boolean;
  createdAt?: string;
}

export interface Review {
  id: number | string;
  author: UserProfile;
  rating: number;
  comment: string;
  createdAt: string;
}
