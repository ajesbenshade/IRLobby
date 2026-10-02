import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { auth as authCopy } from '@constants/copy';
import { LEGAL_CONSENT_COPY } from '@constants/foyerCopy';
import { LoginScreen } from '../LoginScreen';

const mockNavigate = jest.fn();
const mockSignIn = jest.fn();
const mockSignInWithTwitter = jest.fn();
const mockSignInWithGoogleIdToken = jest.fn();
const mockSignInWithAppleIdentityToken = jest.fn();
const mockPromptAsync = jest.fn();

const googleIdToken = () => {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${encode({ alg: 'none' })}.${encode({
    iss: 'https://accounts.google.com',
    aud: 'web.apps.googleusercontent.com',
    sub: 'google-sub',
  })}.sig`;
};

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    signInWithTwitter: mockSignInWithTwitter,
    signInWithGoogleIdToken: mockSignInWithGoogleIdToken,
    signInWithAppleIdentityToken: mockSignInWithAppleIdentityToken,
  }),
}));

jest.mock('@lib/googleAuth', () => {
  const actual = jest.requireActual('@lib/googleAuth') as typeof import('@lib/googleAuth');
  return {
    ...actual,
    getGoogleAuthRequestConfig: () => ({ iosClientId: 'test.apps.googleusercontent.com' }),
    getGoogleNativeRedirectUriOptions: () => undefined,
    isGoogleAuthReadyForPlatform: () => true,
  };
});

jest.mock('expo-auth-session/providers/google', () => ({
  useIdTokenAuthRequest: () => [{ ready: true }, null, mockPromptAsync],
}));

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(async () => true),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 },
  AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 },
  AppleAuthenticationButton: 'AppleAuthenticationButton',
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
    Svg: View,
    Path: View,
  };
});

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('@constants/config', () => ({
  config: {
    isUsingFallbackApiBaseUrl: false,
    apiBaseUrl: 'https://api.irlobby.com',
  },
}));

const renderScreen = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <LoginScreen
        navigation={{ navigate: mockNavigate } as never}
        route={{ key: 'Login', name: 'Login' } as never}
      />
    </QueryClientProvider>,
  );
};

describe('LoginScreen dressed layout', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'ios' });
    mockNavigate.mockReset();
    mockSignIn.mockReset();
    mockSignInWithTwitter.mockReset();
    mockSignInWithGoogleIdToken.mockReset();
    mockSignInWithAppleIdentityToken.mockReset();
    mockPromptAsync.mockReset();
  });

  it('renders the dressed mark, Login heading, Apple + Google + email, and Terms & Privacy', async () => {
    renderScreen();

    expect(screen.getByText(authCopy.login.subtitle)).toBeTruthy();
    expect(screen.getByText(authCopy.login.title)).toBeTruthy();
    expect(await screen.findByTestId('apple-sign-in-button')).toBeTruthy();
    expect(screen.getByLabelText(authCopy.login.googleCta)).toBeTruthy();
    expect(screen.queryByLabelText(authCopy.login.twitterCta)).toBeNull();
    expect(screen.queryByText(authCopy.login.twitterCta)).toBeNull();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByPlaceholderText(authCopy.login.emailPlaceholder)).toBeTruthy();
    expect(screen.getByLabelText(authCopy.login.primaryCta)).toBeTruthy();
    expect(screen.getByText(LEGAL_CONSENT_COPY.terms)).toBeTruthy();
    expect(screen.getByText(LEGAL_CONSENT_COPY.privacy)).toBeTruthy();
    expect(screen.queryByLabelText(authCopy.login.forgotPassword)).toBeNull();
  });

  it('reveals the password field after Continue with email', async () => {
    renderScreen();

    fireEvent.changeText(screen.getByLabelText('Email'), 'alex@irlobby.com');
    fireEvent.press(screen.getByLabelText(authCopy.login.primaryCta));

    expect(await screen.findByLabelText('Password')).toBeTruthy();
    expect(screen.getByLabelText(authCopy.login.forgotPassword)).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('does not start X OAuth from the login screen', async () => {
    renderScreen();

    expect(screen.queryByLabelText(authCopy.login.twitterCta)).toBeNull();
    expect(screen.queryByText(authCopy.login.twitterProgressTitle)).toBeNull();
    expect(mockSignInWithTwitter).not.toHaveBeenCalled();
  });

  it('shows the Google 400 detail in the toast after authorize succeeds', async () => {
    const idToken = googleIdToken();
    mockPromptAsync.mockResolvedValue({
      type: 'success',
      params: { id_token: idToken },
    });
    mockSignInWithGoogleIdToken.mockRejectedValue(
      new Error('Google identity token is required.'),
    );

    renderScreen();
    fireEvent.press(screen.getByLabelText(authCopy.login.googleCta));

    expect(await screen.findByText(authCopy.login.signInToastTitle)).toBeTruthy();
    expect(
      screen.getAllByText('Google identity token is required.').length,
    ).toBeGreaterThanOrEqual(2);
    expect(screen.getByLabelText(authCopy.login.signInToastAction)).toBeTruthy();
    expect(
      screen.getByLabelText(
        `${authCopy.login.signInToastTitle} Google identity token is required.`,
      ),
    ).toBeTruthy();
    expect(mockSignInWithGoogleIdToken).toHaveBeenCalledWith(idToken);
    expect(screen.getByLabelText(authCopy.login.googleCta)).toBeTruthy();
    expect(screen.queryByLabelText(authCopy.login.twitterCta)).toBeNull();
  });

  it('retries Google from the toast Try again action', async () => {
    mockPromptAsync.mockResolvedValue({
      type: 'success',
      params: { id_token: googleIdToken() },
    });
    mockSignInWithGoogleIdToken.mockRejectedValue(
      new Error('Google identity token is required.'),
    );

    renderScreen();
    fireEvent.press(screen.getByLabelText(authCopy.login.googleCta));
    expect(await screen.findByText(authCopy.login.signInToastTitle)).toBeTruthy();

    fireEvent.press(screen.getByLabelText(authCopy.login.signInToastAction));

    await waitFor(() => {
      expect(mockPromptAsync).toHaveBeenCalledTimes(2);
    });
  });
});
