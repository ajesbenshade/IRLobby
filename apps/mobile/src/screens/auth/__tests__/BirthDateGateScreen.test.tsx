import React from 'react';
import { AxiosError } from 'axios';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { BIRTH_GATE_COPY, PICKER_COPY } from '@constants/foyerCopy';
import { MONTH_NAMES } from '@foyer/dates';
import { BirthDateGateScreen } from '../BirthDateGateScreen';

const mockSaveBirthDate = jest.fn();
const mockSignOut = jest.fn();

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({ saveBirthDate: mockSaveBirthDate, signOut: mockSignOut }),
}));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));

const pickDate = async (month: string, year: number | string, day?: string) => {
  fireEvent.press(screen.getByTestId('gate-birth-date'));
  fireEvent.press(await screen.findByLabelText(`Month ${month}`));
  fireEvent.press(screen.getByLabelText(`Year ${year}`));
  fireEvent.press(screen.getByLabelText('Next'));
  if (day) {
    fireEvent.press(screen.getByLabelText(day));
    fireEvent.press(screen.getByLabelText('Confirm'));
  }
};

describe('BirthDateGateScreen (blocking step after Apple / Google sign-in)', () => {
  beforeEach(() => {
    mockSaveBirthDate.mockReset();
    mockSignOut.mockReset();
  });

  it('shows the hint, a disabled Continue, Sign out, and no skip', () => {
    render(<BirthDateGateScreen />);
    expect(screen.getByText(PICKER_COPY.birthRequired)).toBeTruthy();
    expect(screen.getByTestId('gate-continue').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByLabelText(BIRTH_GATE_COPY.signOut)).toBeTruthy();
    expect(screen.queryByText(/skip|later|not now/i)).toBeNull();
    fireEvent.press(screen.getByTestId('gate-continue'));
    expect(mockSaveBirthDate).not.toHaveBeenCalled();
  });

  it('cannot pick an under-13 date: the picker flags it and Confirm stays disabled', async () => {
    render(<BirthDateGateScreen />);
    const now = new Date();
    const year = now.getFullYear() - 5;
    fireEvent.press(screen.getByTestId('gate-birth-date'));
    fireEvent.press(await screen.findByLabelText(`Year ${year}`));
    fireEvent.press(screen.getByLabelText('Next'));
    fireEvent.press(screen.getByLabelText(`${MONTH_NAMES[now.getMonth()]} 1, ${year}`));
    expect(screen.getByTestId('picker-under13')).toBeTruthy();
    expect(screen.getByText(PICKER_COPY.under13)).toBeTruthy();
    expect(screen.getByTestId('picker-confirm').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText(PICKER_COPY.birthRequired)).toBeTruthy();
    expect(screen.getByTestId('gate-continue').props.accessibilityState.disabled).toBe(true);
  });

  it('saves a valid date as YYYY-MM-DD and shows no error', async () => {
    mockSaveBirthDate.mockResolvedValue({ id: 1 });
    render(<BirthDateGateScreen />);
    await pickDate('March', 1988, 'March 4, 1988');
    await waitFor(() => expect(screen.queryByText(PICKER_COPY.birthRequired)).toBeNull());
    fireEvent.press(screen.getByTestId('gate-continue'));
    await waitFor(() => expect(mockSaveBirthDate).toHaveBeenCalledWith('1988-03-04'));
  });

  it('maps a server under-13 rejection to the spec message and keeps the screen', async () => {
    mockSaveBirthDate.mockRejectedValue(
      new AxiosError('Bad Request', '400', undefined, undefined, {
        status: 400,
        data: { date_of_birth: ['Accounts are not available under age 13.'] },
      } as never),
    );
    render(<BirthDateGateScreen />);
    await pickDate('March', 1988, 'March 4, 1988');
    fireEvent.press(screen.getByTestId('gate-continue'));
    expect(await screen.findByText(PICKER_COPY.under13)).toBeTruthy();
    expect(screen.getByTestId('gate-continue')).toBeTruthy();
  });

  it('Sign out calls signOut', async () => {
    mockSignOut.mockResolvedValue(undefined);
    render(<BirthDateGateScreen />);
    fireEvent.press(screen.getByTestId('gate-sign-out'));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
  });
});
