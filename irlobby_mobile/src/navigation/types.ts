export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Modal?: { screen: string; params?: Record<string, unknown> };
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Discover: undefined;
  Matches: undefined;
  Chat: undefined;
  Profile: undefined;
};
