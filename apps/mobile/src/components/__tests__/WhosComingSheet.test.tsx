import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { WhosComingSheet } from '../WhosComingSheet';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

const response = {
  me: { name: 'Anna B.', eligible: true, reason: null },
  dependents: [
    { id: 1, name: 'Child 1', age: 9, eligible: true, reason: null },
    { id: 3, name: 'Child 3', age: 4, eligible: false, reason: "Outside this event's age range" },
  ],
  note: 'Only children in your household are listed. Teens with their own account RSVP for themselves.',
};

describe('WhosComingSheet eligibility', () => {
  it('shows ineligible children disabled with the reason and confirms the selected count', () => {
    const onConfirm = jest.fn();
    render(<WhosComingSheet response={response} onConfirm={onConfirm} />);

    expect(screen.getByText("Who's coming?")).toBeTruthy();
    expect(screen.getByText('Child 1 (age 9)')).toBeTruthy();
    expect(screen.getByText('In your household')).toBeTruthy();
    const ineligible = screen.getByLabelText('Child 3 (age 4)');
    expect(ineligible.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText("Outside this event's age range")).toBeTruthy();

    fireEvent.press(screen.getByText('Confirm · 2 going'));
    expect(onConfirm).toHaveBeenCalledWith({ include_self: true, dependent_ids: [1] });
  });
});
