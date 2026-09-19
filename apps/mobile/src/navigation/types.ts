import type { NavigatorScreenParams } from '@react-navigation/native';
import type { VibeProfile, VibeTag } from '@shared/schema';

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  Onboarding: undefined;
  Main: NavigatorScreenParams<MainStackParamList> | undefined;
  AccountDeleted: undefined;
  Modal?: { screen: string; params?: Record<string, unknown> };
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string } | undefined;
};

export type MainTabParamList = {
  Discover: undefined;
  Activity: undefined;
  Create: undefined;
  Chat: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  Tabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Settings: undefined;
  Account: undefined;
  Friends: undefined;
  Reviews: undefined;
  Notifications: undefined;
  HelpSupport: { title: string; url: string } | undefined;
  PrivacyPolicy: { title: string; url: string } | undefined;
  TermsOfService: { title: string; url: string } | undefined;
  WebContent: { title: string; url: string };
  VibeQuizResults: {
    vibeProfile: VibeProfile;
    vibeTags: VibeTag[];
    discoverTags: string[];
  };
  VibeQuizModal: undefined;
  BuyTicket: {
    activityId: number | string;
    title: string;
    location?: string | null;
    time?: string;
    ticketPrice?: number | string | null;
    imageUri?: string;
    ticketsAvailable?: number | null;
    isSoldOut?: boolean;
  };
  TicketWallet: {
    activityId?: number | string;
    title: string;
    location?: string | null;
    time?: string;
    ticketId: string;
    quantity?: number;
    ticketPrice?: number | null;
    imageUri?: string;
  };
  DoorScan: {
    activityId?: number | string;
    title?: string;
    admitted?: number;
    capacity?: number;
    guestName?: string;
    quantity?: number;
  };
  GetPaid: undefined;
  EditActivity: {
    activityId: number | string;
  };
};
