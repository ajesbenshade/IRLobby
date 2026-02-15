import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  Onboarding: undefined;
  Main: undefined;
  Modal?: { screen: string; params?: Record<string, unknown> };
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string } | undefined;
};

export type MainTabParamList = {
  Home: undefined;
  MyEvents: undefined;
  Discover: undefined;
  Create: undefined;
  Matches: undefined;
  Chat: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  Tabs: undefined;
  Settings: undefined;
  Friends: undefined;
  Reviews: undefined;
  Notifications: undefined;
  HelpSupport: { title: string; url: string } | undefined;
  PrivacyPolicy: { title: string; url: string } | undefined;
  TermsOfService: { title: string; url: string } | undefined;
  WebContent: { title: string; url: string };
};
