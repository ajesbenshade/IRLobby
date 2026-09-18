import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { auth as authCopy } from '@constants/copy';
import { TWITTER_CANCELLED_MESSAGE, TWITTER_MISSING_ACCESS_MESSAGE } from '@lib/twitterAuth';
import { LoginScreen } from '../LoginScreen';

const mockNavigate = jest.fn();
const mockSignIn = jest.fn();
const mockSignInWithTwitter = jest.fn();
const mockSignInWithGoogleIdToken = jest.fn();
const mockSignInWithAppleIdentityToken = jest.fn();
const mockPromptAsync = jest.fn();

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

  it('renders the dressed mark, tagline, equal-weight social stack, email, and legal footer', async () => {
    renderScreen();

    expect(screen.getByText(authCopy.login.subtitle)).toBeTruthy();
    expect(await screen.findByLabelText(authCopy.login.appleCta)).toBeTruthy();
    expect(screen.getByLabelText(authCopy.login.googleCta)).toBeTruthy();
    expect(screen.getByLabelText(authCopy.login.twitterCta)).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText(authCopy.login.primaryCta)).toBeTruthy();
    expect(screen.getByText(authCopy.login.legalTerms)).toBeTruthy();
    expect(screen.getByText(authCopy.login.legalPrivacy)).toBeTruthy();
    expect(screen.queryByText(authCopy.login.title)).toBeNull();
  });

  it('reveals the password field after Continue with email', async () => {
    renderScreen();

    fireEvent.changeText(screen.getByLabelText('Email'), 'alex@irlobby.com');
    fireEvent.press(screen.getByLabelText(authCopy.login.primaryCta));

    expect(await screen.findByLabelText('Password')).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('shows the X-in-progress state while Twitter auth is running', async () => {
    let resolveTwitter: (value: unknown) => void = () => undefined;
    mockSignInWithTwitter.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTwitter = resolve;
        }),
    );

    renderScreen();
    fireEvent.press(screen.getByLabelText(authCopy.login.twitterCta));

    expect(await screen.findByText(authCopy.login.twitterProgressTitle)).toBeTruthy();
    expect(screen.getByText(authCopy.login.twitterProgressBody)).toBeTruthy();
    expect(screen.getByText(authCopy.login.twitterProgressNote)).toBeTruthy();
    expect(screen.queryByLabelText('Email')).toBeNull();

    resolveTwitter({ id: 1, email: 'alex@irlobby.com' });
    await waitFor(() => {
      expect(screen.getByLabelText('Email')).toBeTruthy();
    });
  });

  it('shows the Google exchange error after authorize succeeds', async () => {
    mockPromptAsync.mockResolvedValue({
      type: 'success',
      params: { id_token: 'google-id-token' },
    });
    mockSignInWithGoogleIdToken.mockRejectedValue(
      new Error('Google sign-in could not be verified.'),
    );

    renderScreen();
    fireEvent.press(screen.getByLabelText(authCopy.login.googleCta));

    expect(await screen.findByText(authCopy.login.signInToastTitle)).toBeTruthy();
    expect(screen.getByText(authCopy.login.signInToastBody)).toBeTruthy();
    expect(screen.getByLabelText(authCopy.login.signInToastAction)).toBeTruthy();
    expect(
      await screen.findByText('Google sign-in could not be verified.'),
    ).toBeTruthy();
    expect(mockSignInWithGoogleIdToken).toHaveBeenCalledWith('google-id-token');
    expect(screen.getByLabelText(authCopy.login.googleCta)).toBeTruthy();
    expect(screen.getByLabelText(authCopy.login.twitterCta)).toBeTruthy();
  });

  it('retries Google from the toast Try again action', async () => {
    mockPromptAsync.mockResolvedValue({
      type: 'success',
      params: { id_token: 'google-id-token' },
    });
    mockSignInWithGoogleIdToken.mockRejectedValue(
      new Error('Google sign-in could not be verified.'),
    );

    renderScreen();
    fireEvent.press(screen.getByLabelText(authCopy.login.googleCta));
    expect(await screen.findByText(authCopy.login.signInToastTitle)).toBeTruthy();

    fireEvent.press(screen.getByLabelText(authCopy.login.signInToastAction));

    await waitFor(() => {
      expect(mockPromptAsync).toHaveBeenCalledTimes(2);
    });
  });

  it('shows MISSING_ACCESS copy when X returns without tokens', async () => {
    mockSignInWithTwitter.mockRejectedValue(new Error(TWITTER_MISSING_ACCESS_MESSAGE));

    renderScreen();
    fireEvent.press(screen.getByLabelText(authCopy.login.twitterCta));

    expect(await screen.findByText(authCopy.login.signInToastTitle)).toBeTruthy();
    expect(await screen.findByText(/MISSING_ACCESS/)).toBeTruthy();
    expect(screen.getByText(/api\.irlobby\.com\/api\/auth\/twitter\/callback/)).toBeTruthy();
  });

  it('shows cancelled copy when X auth is cancelled without the exchange toast', async () => {
    mockSignInWithTwitter.mockRejectedValue(new Error(TWITTER_CANCELLED_MESSAGE));

    renderScreen();
    fireEvent.press(screen.getByLabelText(authCopy.login.twitterCta));

    expect(await screen.findByText(TWITTER_CANCELLED_MESSAGE)).toBeTruthy();
    expect(screen.queryByText(authCopy.login.signInToastTitle)).toBeNull();
  });
});
