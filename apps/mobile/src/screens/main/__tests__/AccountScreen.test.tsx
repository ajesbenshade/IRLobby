import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { account as accountCopy } from '@constants/copy';
import { AccountScreen } from '../AccountScreen';

const mockSignOut = jest.fn().mockResolvedValue(undefined);
const mockMarkAccountDeleted = jest.fn();
const mockDeleteCurrentAccount = jest.fn().mockResolvedValue(undefined);

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({
    signOut: mockSignOut,
    markAccountDeleted: mockMarkAccountDeleted,
  }),
}));

jest.mock('@services/accountService', () => ({
  deleteCurrentAccount: (...args: unknown[]) => mockDeleteCurrentAccount(...args),
}));

const renderScreen = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AccountScreen />
    </QueryClientProvider>,
  );
};

describe('AccountScreen', () => {
  beforeEach(() => {
    mockSignOut.mockClear();
    mockMarkAccountDeleted.mockClear();
    mockDeleteCurrentAccount.mockReset();
    mockDeleteCurrentAccount.mockResolvedValue(undefined);
  });

  it('opens the confirm sheet with the App Review copy', () => {
    renderScreen();

    fireEvent.press(screen.getByText(accountCopy.deleteCta));

    expect(screen.getByText(accountCopy.confirmTitle)).toBeTruthy();
    expect(screen.getByText(accountCopy.confirmBody)).toBeTruthy();
    expect(screen.getByText(accountCopy.confirmCancel)).toBeTruthy();
    expect(screen.getAllByText(accountCopy.confirmPrimary).length).toBeGreaterThan(0);
  });

  it('closes the confirm sheet without calling delete', () => {
    renderScreen();

    fireEvent.press(screen.getByText(accountCopy.deleteCta));
    fireEvent.press(screen.getByText(accountCopy.confirmCancel));

    expect(screen.queryByText(accountCopy.confirmTitle)).toBeNull();
    expect(mockDeleteCurrentAccount).not.toHaveBeenCalled();
  });

  it('deletes the current session account, then signs out locally', async () => {
    renderScreen();

    fireEvent.press(screen.getByText(accountCopy.deleteCta));
    fireEvent.press(screen.getAllByText(accountCopy.confirmPrimary)[1]);

    await waitFor(() => {
      expect(mockDeleteCurrentAccount).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockMarkAccountDeleted).toHaveBeenCalledTimes(1);
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });
});
