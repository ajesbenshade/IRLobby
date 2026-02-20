export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  access?: string;
  refresh?: string;
  expiresIn?: number;
}

export interface AuthUser {
  id: number | string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  avatarUrl?: string | null;
  bio?: string | null;
  city?: string | null;
  interests?: string[];
  photoAlbum?: string[];
  onboardingCompleted?: boolean;
  isHost?: boolean;
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
