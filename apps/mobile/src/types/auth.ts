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

export interface ReliabilitySummary {
  score?: number | null;
  label: string;
  reviewCount: number;
  averageRating?: number | null;
  ticketValidationRate?: number | null;
  successfulTicketValidations: number;
  ticketValidationCount: number;
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
  swipesRemainingToday?: number | null;
  vibe?: VibeUserPayload;
  reliability?: ReliabilitySummary;
  stripeConnectAccountId?: string | null;
  stripeConnectPayoutsEnabled?: boolean;
  stripeConnectDetailsSubmitted?: boolean;
  canSellTickets?: boolean;
  dateOfBirth?: string | null;
  sex?: 'male' | 'female' | '';
  church?: { id: number; name: string; is_verified?: boolean } | null;
  churchId?: number | null;
  isChurchAdmin?: boolean;
  householdChildCount?: number;
  profileVisibility?: 'only_me' | 'church' | 'friends' | 'public';
  phone?: string | null;
  showEmail?: boolean;
  showPhone?: boolean;
  dmFromSharedEvents?: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  /** Sent as terms_accepted / privacy_accepted when true. Servers that do not take them yet ignore the extra fields. */
  termsAccepted?: boolean;
  firstName: string;
  lastName: string;
  username?: string;
  dateOfBirth?: string;
  sex?: 'male' | 'female';
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}
