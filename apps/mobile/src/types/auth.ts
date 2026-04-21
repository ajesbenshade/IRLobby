export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  access?: string;
  refresh?: string;
  expiresIn?: number;
}

export interface VibeUserPayload {
  vibeProfile?: string;
  vibeTags?: string[];
  vibeDiscoverTags?: string[];
  vibeAnswers?: Record<string, unknown>;
  vibeCompletedAt?: string;
  vibeQuizSkipped?: boolean;
}

export interface AuthUser {
  id: number | string;
  email: string;
  preferences?: Record<string, unknown>;
  firstName?: string;
  lastName?: string;
  username?: string;
  avatarUrl?: string | null;
  bio?: string | null;
  city?: string | null;
  interests?: string[];
  ageRange?: string | null;
  activityPreferences?: Record<string, unknown>;
  photoAlbum?: string[];
  onboardingCompleted?: boolean;
  termsAccepted?: boolean;
  privacyAccepted?: boolean;
  legalAccepted?: boolean;
  termsAcceptedAt?: string | null;
  privacyAcceptedAt?: string | null;
  pushNotificationsEnabled?: boolean;
  isHost?: boolean;
  vibe?: VibeUserPayload;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  firstName: string;
  lastName: string;
  username?: string;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}
