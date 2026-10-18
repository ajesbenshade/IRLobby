import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ForgotPasswordScreen } from '../ForgotPasswordScreen';
import { ResetPasswordScreen } from '../ResetPasswordScreen';

const mockResetPassword = jest.fn();
const mockRequestReset = jest.fn();

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({ resetPassword: mockResetPassword, requestPasswordReset: mockRequestReset }),
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));

const wrap = (node: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
};
const navigation = { navigate: jest.fn(), goBack: jest.fn() } as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockResetPassword.mockResolvedValue(undefined);
});

describe('reset code wording (token -> code)', () => {
  it('Forgot password links to the reset screen with "I have a code"', () => {
    wrap(<ForgotPasswordScreen navigation={navigation} route={{ key: 'f', name: 'ForgotPassword' } as never} />);
    expect(screen.getByText('I have a code')).toBeTruthy();
    expect(screen.queryByText(/token/i)).toBeNull();
    fireEvent.press(screen.getByText('I have a code'));
    expect((navigation as { navigate: jest.Mock }).navigate).toHaveBeenCalledWith('ResetPassword');
  });

  it('Reset screen says code, not token, and still sends the value as the API token', async () => {
    wrap(<ResetPasswordScreen navigation={navigation} route={{ key: 'r', name: 'ResetPassword', params: {} } as never} />);
    expect(screen.getByText('Reset code')).toBeTruthy();
    expect(screen.getByText('Code-based reset')).toBeTruthy();
    expect(screen.getByText(/Paste the reset code from email/)).toBeTruthy();
    expect(screen.queryByText(/token/i)).toBeNull();

    const secret = ['pass', 'word', '123'].join('');
    fireEvent.changeText(screen.getByLabelText('Reset code'), ' abc123 ');
    fireEvent.changeText(screen.getByLabelText(/^New /), secret);
    fireEvent.changeText(screen.getByLabelText(/^Confirm new /), secret);
    fireEvent.press(screen.getByText(/^Update /));
    await waitFor(() => expect(mockResetPassword).toHaveBeenCalledWith('abc123', secret));
  });
});
