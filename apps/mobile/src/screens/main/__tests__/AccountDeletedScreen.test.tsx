import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { account as accountCopy } from '@constants/copy';
import { AccountDeletedScreen } from '../../auth/AccountDeletedScreen';

const mockAcknowledgeAccountDeleted = jest.fn();

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({
    acknowledgeAccountDeleted: mockAcknowledgeAccountDeleted,
  }),
}));

describe('AccountDeletedScreen', () => {
  beforeEach(() => {
    mockAcknowledgeAccountDeleted.mockClear();
  });

  it('shows the done copy and returns to welcome', () => {
    render(<AccountDeletedScreen />);

    expect(screen.getByText(accountCopy.deletedTitle)).toBeTruthy();
    expect(screen.getByText(accountCopy.deletedBody)).toBeTruthy();

    fireEvent.press(screen.getByText(accountCopy.backToWelcome));
    expect(mockAcknowledgeAccountDeleted).toHaveBeenCalledTimes(1);
  });
});
