import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { DELETE_ACCOUNT_COPY } from '@constants/foyerCopy';
import { AccountScreen } from '../AccountScreen';

const mockSignOut = jest.fn().mockResolvedValue(undefined);
const mockDeleteCurrentAccount = jest.fn();
const mockGoBack = jest.fn();
const mockFetchHosted = jest.fn();

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: mockGoBack }) }));
jest.mock('@hooks/useAuth', () => ({ useAuth: () => ({ signOut: mockSignOut }) }));
jest.mock('@services/accountService', () => ({ deleteCurrentAccount: (...args: unknown[]) => mockDeleteCurrentAccount(...args) }));
jest.mock('@services/activityService', () => ({ fetchHostedActivities: () => mockFetchHosted() }));

const renderScreen = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })}>
      <AccountScreen />
    </QueryClientProvider>,
  );

const confirmAlert = () => {
  const spy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _body, buttons) => {
    buttons?.find((button) => button.text === DELETE_ACCOUNT_COPY.alertDelete)?.onPress?.();
  });
  return spy;
};

describe('AccountScreen (delete account)', () => {
  beforeEach(() => {
    mockSignOut.mockClear();
    mockGoBack.mockClear();
    mockDeleteCurrentAccount.mockReset().mockResolvedValue(undefined);
    mockFetchHosted.mockReset().mockResolvedValue([]);
  });
  afterEach(() => jest.restoreAllMocks());

  it('states what is deleted and the approved retention periods', () => {
    renderScreen();
    expect(screen.getByText(DELETE_ACCOUNT_COPY.screenBody)).toBeTruthy();
    expect(screen.getByText('Photos you added')).toBeTruthy();
    expect(
      screen.getByText(
        'We keep a minimal record of safety reports for up to 12 months so we can protect other members. Backups are cleared within 30 days.',
      ),
    ).toBeTruthy();
  });

  it('keeps Delete my account locked until DELETE is typed', () => {
    renderScreen();
    expect(screen.getByTestId('delete-button').props.accessibilityState?.disabled).toBe(true);
    fireEvent.changeText(screen.getByTestId('delete-input'), 'delet');
    expect(screen.getByTestId('delete-button').props.accessibilityState?.disabled).toBe(true);
    fireEvent.changeText(screen.getByTestId('delete-input'), 'DELETE');
    expect(screen.getByTestId('delete-button').props.accessibilityState?.disabled).toBeFalsy();
  });

  it('Keep my account goes back and never calls delete', () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('keep-button'));
    expect(mockGoBack).toHaveBeenCalled();
    expect(mockDeleteCurrentAccount).not.toHaveBeenCalled();
  });

  it('deletes after the alert, shows Done, and signs out on Close', async () => {
    const alert = confirmAlert();
    renderScreen();
    fireEvent.changeText(screen.getByTestId('delete-input'), 'DELETE');
    fireEvent.press(screen.getByTestId('delete-button'));
    expect(alert).toHaveBeenCalledWith('Delete your account?', "This can't be undone.", expect.any(Array));
    await waitFor(() => expect(mockDeleteCurrentAccount).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Your account was deleted')).toBeTruthy();
    expect(mockSignOut).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('done-close'));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('shows the failure sheet and can retry', async () => {
    confirmAlert();
    mockDeleteCurrentAccount.mockRejectedValueOnce(new Error('boom'));
    renderScreen();
    fireEvent.changeText(screen.getByTestId('delete-input'), 'DELETE');
    fireEvent.press(screen.getByTestId('delete-button'));
    expect(await screen.findByText("Couldn't delete your account.")).toBeTruthy();
    expect(screen.getByText('Nothing was removed. Please try again.')).toBeTruthy();
    fireEvent.press(screen.getByText('Try again'));
    await waitFor(() => expect(mockDeleteCurrentAccount).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Your account was deleted')).toBeTruthy();
  });

  it('warns about upcoming hosted gatherings', async () => {
    const future = new Date(Date.now() + 5 * 86400000).toISOString();
    mockFetchHosted.mockResolvedValue([{ time: future }, { time: future }, { time: future, is_cancelled: true }]);
    renderScreen();
    expect(await screen.findByText("You host 2 upcoming gatherings. They'll be cancelled and the people going will be told.")).toBeTruthy();
  });
});
