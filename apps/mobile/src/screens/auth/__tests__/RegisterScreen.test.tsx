import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { auth as authCopy } from '@constants/copy';
import { PICKER_COPY } from '@constants/foyerCopy';
import { RegisterScreen } from '../RegisterScreen';

const mockSignUp = jest.fn();

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({
    signUp: mockSignUp,
    signInWithAppleIdentityToken: jest.fn(),
    signInWithGoogleIdToken: jest.fn(),
  }),
}));
jest.mock('@services/authService', () => ({
  ...(jest.requireActual('@services/authService') as object),
  persistLegalAcceptance: jest.fn(async () => undefined),
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
  useIdTokenAuthRequest: () => [{ ready: true }, null, jest.fn()],
}));
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(async () => false),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 },
  AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 },
  AppleAuthenticationButton: 'AppleAuthenticationButton',
}));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View, Svg: View, Path: View };
});
jest.mock('@constants/config', () => ({
  config: { isUsingFallbackApiBaseUrl: false, apiBaseUrl: 'https://api.irlobby.com' },
}));

const renderScreen = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RegisterScreen navigation={{ navigate: jest.fn() } as never} route={{ key: 'Register', name: 'Register' } as never} />
    </QueryClientProvider>,
  );
};

const fillEverythingButBirthDate = () => {
  fireEvent.changeText(screen.getByLabelText('First name'), 'Ada');
  fireEvent.changeText(screen.getByLabelText('Last name'), 'Lovelace');
  fireEvent.changeText(screen.getByLabelText('Email'), 'ada@example.com');
  fireEvent.changeText(screen.getByLabelText('Username'), 'adal');
  fireEvent.changeText(screen.getByLabelText('Password'), 'longenough1');
  fireEvent.changeText(screen.getByLabelText(/^Confirm \w+$/i), 'longenough1');
  fireEvent.press(screen.getByRole('checkbox'));
};

describe('RegisterScreen birth date is required', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'ios' });
    mockSignUp.mockReset();
  });

  it('keeps Create account disabled (with a hint) until a birth date is chosen, then sends date_of_birth', async () => {
    mockSignUp.mockResolvedValue({ id: 1 });
    renderScreen();
    fillEverythingButBirthDate();

    expect(screen.getByText(PICKER_COPY.birthRequired)).toBeTruthy();
    const submit = () => screen.getByText(authCopy.register.primaryCta);
    fireEvent.press(submit());
    expect(mockSignUp).not.toHaveBeenCalled();

    // Choose 4 March 1988 in the picker: Next, day, Confirm.
    fireEvent.press(screen.getByTestId('register-birth-date'));
    fireEvent.press(await screen.findByLabelText('Month March'));
    fireEvent.press(screen.getByLabelText('Year 1988'));
    fireEvent.press(screen.getByLabelText('Next'));
    fireEvent.press(screen.getByLabelText('March 4, 1988'));
    fireEvent.press(screen.getByLabelText('Confirm'));

    await waitFor(() => expect(screen.queryByText(PICKER_COPY.birthRequired)).toBeNull());
    fireEvent.press(submit());
    await waitFor(() => expect(mockSignUp).toHaveBeenCalledTimes(1));
    expect(mockSignUp.mock.calls[0][0]).toMatchObject({ dateOfBirth: '1988-03-04', termsAccepted: true });
  });

  it('legacy irlobby mode keeps the birth date optional', async () => {
    const previous = process.env.EXPO_PUBLIC_APP_MODE;
    process.env.EXPO_PUBLIC_APP_MODE = 'irlobby';
    try {
      mockSignUp.mockResolvedValue({ id: 1 });
      renderScreen();
      fillEverythingButBirthDate();
      expect(screen.queryByText(PICKER_COPY.birthRequired)).toBeNull();
      fireEvent.press(screen.getByText(authCopy.register.primaryCta));
      await waitFor(() => expect(mockSignUp).toHaveBeenCalledTimes(1));
    } finally {
      if (previous === undefined) {
        delete process.env.EXPO_PUBLIC_APP_MODE;
      } else {
        process.env.EXPO_PUBLIC_APP_MODE = previous;
      }
    }
  });
});
