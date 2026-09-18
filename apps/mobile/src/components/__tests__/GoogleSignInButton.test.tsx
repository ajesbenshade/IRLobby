import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockPromptAsync = jest.fn();
const mockExchangeCodeAsync = jest.fn();
const mockUseIdTokenAuthRequest = jest.fn();

const mockRequest = {
  clientId: 'ios.apps.googleusercontent.com',
  redirectUri: 'com.googleusercontent.apps.ios:/oauthredirect',
  codeVerifier: 'pkce-verifier',
};

jest.mock('expo-auth-session', () => ({
  exchangeCodeAsync: (...args: unknown[]) => mockExchangeCodeAsync(...args),
}));

jest.mock('expo-auth-session/providers/google', () => ({
  useIdTokenAuthRequest: (...args: unknown[]) => mockUseIdTokenAuthRequest(...args),
}));

jest.mock('@lib/googleAuth', () => {
  const actual = jest.requireActual('@lib/googleAuth') as typeof import('@lib/googleAuth');
  return {
    ...actual,
    isGoogleAuthReadyForPlatform: () => true,
    getGoogleAuthRequestConfig: () => ({
      iosClientId: 'ios.apps.googleusercontent.com',
      webClientId: 'web.apps.googleusercontent.com',
      shouldAutoExchangeCode: false,
      scopes: ['openid', 'profile', 'email'],
    }),
    getGoogleNativeRedirectUriOptions: () => ({
      native: 'com.googleusercontent.apps.ios:/oauthredirect',
    }),
  };
});

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

import { GoogleSignInButton } from '../GoogleSignInButton';

describe('GoogleSignInButton', () => {
  beforeEach(() => {
    mockPromptAsync.mockReset();
    mockExchangeCodeAsync.mockReset();
    mockUseIdTokenAuthRequest.mockReset();
    mockUseIdTokenAuthRequest.mockReturnValue([mockRequest, null, mockPromptAsync]);
  });

  it('loads useIdTokenAuthRequest with webClientId and no auto-exchange', () => {
    render(
      <GoogleSignInButton
        label="Continue with Google"
        notConfiguredHint="not configured"
        onIdToken={jest.fn()}
      />,
    );

    expect(mockUseIdTokenAuthRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        webClientId: 'web.apps.googleusercontent.com',
        shouldAutoExchangeCode: false,
      }),
      { native: 'com.googleusercontent.apps.ios:/oauthredirect' },
    );
  });

  it('propagates AuthProvider/backend exchange errors to onError', async () => {
    mockPromptAsync.mockResolvedValue({
      type: 'success',
      params: { id_token: 'google-id-token' },
    });
    const onIdToken = jest.fn().mockRejectedValue(new Error('POST /api/auth/google/mobile/ failed'));
    const onError = jest.fn();

    render(
      <GoogleSignInButton
        label="Continue with Google"
        notConfiguredHint="not configured"
        onIdToken={onIdToken}
        onError={onError}
      />,
    );

    fireEvent.press(screen.getByLabelText('Continue with Google'));

    await waitFor(() => {
      expect(onIdToken).toHaveBeenCalledWith('google-id-token');
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        message: 'POST /api/auth/google/mobile/ failed',
      }));
    });
  });

  it('re-runs the Google prompt when retryNonce increments', async () => {
    mockPromptAsync.mockResolvedValue({ type: 'cancel' });
    const onIdToken = jest.fn();

    const { rerender } = render(
      <GoogleSignInButton
        label="Continue with Google"
        notConfiguredHint="not configured"
        onIdToken={onIdToken}
        retryNonce={0}
      />,
    );

    rerender(
      <GoogleSignInButton
        label="Continue with Google"
        notConfiguredHint="not configured"
        onIdToken={onIdToken}
        retryNonce={1}
      />,
    );

    await waitFor(() => {
      expect(mockPromptAsync).toHaveBeenCalledTimes(1);
    });
    expect(onIdToken).not.toHaveBeenCalled();
  });

  it('exchanges authentication.idToken when params.id_token is missing', async () => {
    mockPromptAsync.mockResolvedValue({
      type: 'success',
      params: {},
      authentication: { idToken: 'from-authentication' },
    });
    const onIdToken = jest.fn().mockRejectedValue(new Error('token persist failed'));
    const onError = jest.fn();

    render(
      <GoogleSignInButton
        label="Continue with Google"
        notConfiguredHint="not configured"
        onIdToken={onIdToken}
        onError={onError}
      />,
    );

    fireEvent.press(screen.getByLabelText('Continue with Google'));

    await waitFor(() => {
      expect(onIdToken).toHaveBeenCalledWith('from-authentication');
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        message: 'token persist failed',
      }));
    });
  });

  it('exchanges the authorization code when Google returns success without id_token', async () => {
    mockPromptAsync.mockResolvedValue({
      type: 'success',
      params: { code: 'auth-code' },
    });
    mockExchangeCodeAsync.mockResolvedValue({ idToken: 'exchanged-id-token' });
    const onIdToken = jest.fn().mockResolvedValue(undefined);

    render(
      <GoogleSignInButton
        label="Continue with Google"
        notConfiguredHint="not configured"
        onIdToken={onIdToken}
      />,
    );

    fireEvent.press(screen.getByLabelText('Continue with Google'));

    await waitFor(() => {
      expect(mockExchangeCodeAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'ios.apps.googleusercontent.com',
          code: 'auth-code',
          redirectUri: 'com.googleusercontent.apps.ios:/oauthredirect',
        }),
        expect.objectContaining({ tokenEndpoint: 'https://oauth2.googleapis.com/token' }),
      );
      expect(onIdToken).toHaveBeenCalledWith('exchanged-id-token');
    });
  });

  it('does not report cancel as an error', async () => {
    mockPromptAsync.mockResolvedValue({ type: 'cancel' });
    const onIdToken = jest.fn();
    const onError = jest.fn();

    render(
      <GoogleSignInButton
        label="Continue with Google"
        notConfiguredHint="not configured"
        onIdToken={onIdToken}
        onError={onError}
      />,
    );

    fireEvent.press(screen.getByLabelText('Continue with Google'));

    await waitFor(() => {
      expect(mockPromptAsync).toHaveBeenCalled();
    });
    expect(onIdToken).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
