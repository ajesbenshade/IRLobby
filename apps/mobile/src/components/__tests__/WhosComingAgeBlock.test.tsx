import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { YouAreGoing } from '@components/foyer/YouAreGoing';
import { WhosComingSheet } from '../WhosComingSheet';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('@services/foyerService', () => ({ addFamilyMember: jest.fn() }));

const teens = { age_min: 13, age_max: 18, time: '2026-11-14T19:00:00-05:00' };
// The server flag is wrong on purpose (eligible: true for a 3-year-old): the app must still block the row.
const kids = [
  { id: 1, name: 'Mia', age: 3, eligible: true, reason: null, relationship: 'child', birth_year: 2023, birth_month: 3, birth_day: 4, date_of_birth: '2023-03-04' },
  { id: 2, name: 'Caleb', age: 15, eligible: true, reason: null, relationship: 'child', birth_year: 2011, birth_month: 6, birth_day: 9, date_of_birth: '2011-06-09' },
];
const response = { me: { name: 'Anna', eligible: true, reason: null }, dependents: kids, members: kids };

describe('party picker blocks family members outside the age range', () => {
  it("Who's coming: the row is disabled with the reason, starts unchecked, and is never sent", () => {
    const onConfirm = jest.fn();
    render(<WhosComingSheet response={response} ageRange={teens} onConfirm={onConfirm} />);
    expect(screen.getByLabelText('Mia').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByLabelText('Mia').props.accessibilityState.checked).toBe(false);
    expect(screen.getByText('Not eligible: ages 13–18')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Mia'));
    expect(screen.getByLabelText('Mia').props.accessibilityState.checked).toBe(false);
    fireEvent.press(screen.getByTestId('whos-coming-confirm'));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ include_self: true, dependent_ids: [2] }));
  });

  it("You're going: the row is disabled with the reason and Save never sends them", () => {
    const onSave = jest.fn();
    render(
      <YouAreGoing
        title="Teen night"
        response={response}
        saved={{ includeSelf: true, memberIds: [] }}
        ageRange={teens}
        onSave={onSave}
        onAddToCalendar={jest.fn()}
        onCancelRsvp={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('Mia').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Not eligible: ages 13–18')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Caleb'));
    fireEvent.press(screen.getByText('Save changes'));
    expect(onSave).toHaveBeenCalledWith({ includeSelf: true, memberIds: [2] });
  });
});
