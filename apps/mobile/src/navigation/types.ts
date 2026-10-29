import type { NavigatorScreenParams } from '@react-navigation/native';
import type { VibeProfile, VibeTag } from '@shared/schema';

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  Onboarding: undefined;
  ChurchStep: undefined;
  BirthDateGate: undefined;
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
  Prayer: undefined;
  /** Hidden. Chat is not a primary tab; gathering chat is a stack screen. */
  Chat: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  Tabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Settings: undefined;
  Account: undefined;
  Friends: undefined;
  /** People you are gathering with or praying for. Distinct from the Friends list. */
  Connections: undefined;
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
  /**
   * Host / create a gathering. Not a primary tab: Gatherings + opens this.
   * Deep links that used to land on the Host tab (`create`) still open this screen.
   */
  Create: undefined;
  EditActivity: {
    activityId: number | string;
  };
  Household: undefined;
  GatheringDetail: {
    activityId: number | string;
    /** Set by the host form when the photo posted with a new gathering hit a limit: opens sheet 248/249 here. */
    photoNotice?: { title: string; body: string };
  };
  /**
   * Per-gathering chat (host + people going). `conversationId` is optional and only carried from
   * push notifications; messages are always loaded by `activityId`.
   */
  GatheringChat: { activityId: number | string; conversationId?: number | string; title?: string };
  /** Prayer tab create form. Circle picker, whole-church toggle off by default. */
  PrayerCreate: undefined;
  PrayerDetail: { prayerId: number | string };
  /** Shared prayer chat. Reuses gathering-chat chrome, labeled Prayer chat. */
  PrayerChat: { prayerId: number | string; title?: string };
  PhotoGallery: { activityId: number | string };
  /** Host's Require approval deck. */
  Requests: { activityId: number | string };
  MemberProfile: { userId: number | string };
  DirectChat: { conversationId: number | string; name?: string };
  Messaging: undefined;
};
