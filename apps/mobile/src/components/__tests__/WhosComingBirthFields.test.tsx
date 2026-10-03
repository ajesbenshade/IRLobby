import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { YouAreGoing } from '@components/foyer/YouAreGoing';
import { personSubtitle } from '@foyer/rsvp';
import { WhosComingSheet } from '../WhosComingSheet';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('@services/foyerService', () => ({ addFamilyMember: jest.fn() }));

/**
 * Backend whos-coming (live): every member carries birth_month, birth_year, birth_day and birth_precision ('month' | 'day').
 * A month-only child has birth_day null + precision 'month'; a spouse has all four null (and age null); `date_of_birth` is NOT sent.
 */
const members = [
  { id: 10, name: 'Rachel', relationship: 'spouse', sex: '', eligible: true, reason: null, age: null, birth_month: null, birth_year: null, birth_day: null, birth_precision: null },
  { id: 11, name: 'Noah', relationship: 'child', sex: 'male', eligible: true, reason: null, age: 10, birth_month: 3, birth_year: 2016, birth_day: 4, birth_precision: 'day' },
  { id: 12, name: 'Ella', relationship: 'child', sex: 'female', eligible: true, reason: null, age: 10, birth_month: 3, birth_year: 2016, birth_day: null, birth_precision: 'month' },
];
const response = { me: { name: 'Anna', eligible: true, reason: null }, dependents: members, members };

describe('RSVP party picker birth lines from the live whos-coming fields', () => {
  it('personSubtitle: day precision, month precision, adult', () => {
    expect(personSubtitle(members[1] as never)).toBe('Born March 4, 2016 · age 10');
    expect(personSubtitle(members[2] as never)).toBe('Born March 2016 · age 10');
    expect(personSubtitle(members[0] as never)).toBe('Adult');
  });

  it('never prints null / undefined for adults or null fields, whatever else is missing', () => {
    const nulls = { id: 1, name: 'X', eligible: true, birth_month: null, birth_year: null, birth_day: null, birth_precision: null, age: null };
    for (const row of [nulls, { ...nulls, relationship: 'spouse' }, { ...nulls, relationship: 'child' }, { ...nulls, birth_precision: 'day' }]) {
      expect(personSubtitle(row as never)).toBe('Adult');
    }
    // precision says day but the day is missing: fall back to the month line rather than inventing a day.
    expect(personSubtitle({ ...nulls, relationship: 'child', birth_month: 3, birth_year: 2016, birth_precision: 'day' } as never)).toBe('Born March 2016');
  });

  it("Who's coming renders the rows with no date_of_birth and no 'null' text", () => {
    render(<WhosComingSheet response={response} onConfirm={jest.fn()} />);
    expect(screen.getByText('Born March 4, 2016 · age 10')).toBeTruthy();
    expect(screen.getByText('Born March 2016 · age 10')).toBeTruthy();
    expect(screen.getByText('Adult')).toBeTruthy();
    expect(screen.queryByText(/null|undefined/i)).toBeNull();
  });

  it("You're going renders the same lines", () => {
    render(
      <YouAreGoing
        title="Cookout"
        response={response}
        saved={{ includeSelf: true, memberIds: [] }}
        onSave={jest.fn()}
        onAddToCalendar={jest.fn()}
        onCancelRsvp={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText('Born March 4, 2016 · age 10')).toBeTruthy();
    expect(screen.getByText('Born March 2016 · age 10')).toBeTruthy();
    expect(screen.queryByText(/null|undefined/i)).toBeNull();
  });

  it('keeps the client-side age-range check: event-day age from the server blocks the month-only child', () => {
    const teens = { age_min: 13, age_max: 18, time: '2026-11-14T19:00:00-05:00' };
    const onConfirm = jest.fn();
    render(<WhosComingSheet response={response} ageRange={teens} onConfirm={onConfirm} />);
    expect(screen.getByLabelText('Ella').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByLabelText('Noah').props.accessibilityState.disabled).toBe(true);
    // The adult has no birth data and stays selectable.
    expect(screen.getByLabelText('Rachel').props.accessibilityState.disabled).toBe(false);
    fireEvent.press(screen.getByTestId('whos-coming-confirm'));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ include_self: true, dependent_ids: [10] }));
  });
});
