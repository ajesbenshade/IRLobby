import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { WhosComingSheet } from '../WhosComingSheet';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('@services/foyerService', () => ({
  addFamilyMember: jest.fn(),
}));

const response = {
  me: { name: 'Anna B.', eligible: true, reason: null },
  dependents: [
    { id: 1, name: 'Caleb', age: 15, eligible: true, reason: null, relationship: 'child' },
    { id: 3, name: 'Noah', age: 11, eligible: false, reason: "Outside this event's age range", relationship: 'child' },
  ],
  members: [
    { id: 2, name: 'Rachel', age: null, eligible: true, reason: null, relationship: 'spouse' },
    { id: 1, name: 'Caleb', age: 15, eligible: true, reason: null, relationship: 'child' },
    { id: 3, name: 'Noah', age: 11, eligible: false, reason: "Outside this event's age range", relationship: 'child' },
  ],
};

describe('WhosComingSheet eligibility', () => {
  it('lists members (spouse included), disables ineligible people with the reason, and confirms', () => {
    const onConfirm = jest.fn();
    render(
      <WhosComingSheet
        response={response}
        ageRange={{ age_min: 13, age_max: 17 }}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("Who's coming?")).toBeTruthy();
    expect(screen.getByText('Rachel')).toBeTruthy();
    expect(screen.getByText('Spouse')).toBeTruthy();
    expect(screen.getByText('Child · age 15')).toBeTruthy();
    const ineligible = screen.getByLabelText('Noah');
    expect(ineligible.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Not eligible: ages 13–17')).toBeTruthy();
    expect(screen.getByText('Add family member')).toBeTruthy();
    expect(
      screen.getByText("Family members under 13 are RSVP names only — they don't have accounts."),
    ).toBeTruthy();

    fireEvent.press(screen.getByText('Confirm RSVP'));
    expect(onConfirm).toHaveBeenCalledWith({
      include_self: true,
      dependent_ids: [2, 1],
      member_ids: [2, 1],
    });
  });

  it('falls back to dependents when the server has no members list', () => {
    render(
      <WhosComingSheet
        response={{ me: response.me, dependents: response.dependents }}
        onConfirm={jest.fn()}
      />,
    );
    expect(screen.getByText('Caleb')).toBeTruthy();
    expect(screen.queryByText('Rachel')).toBeNull();
  });
});
