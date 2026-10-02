import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { cancelErrorMessage } from '../CancelRsvpSheet';
import { YouAreGoing } from '../YouAreGoing';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('@services/foyerService', () => ({ addFamilyMember: jest.fn(), cancelRsvp: jest.fn(), clearPass: jest.fn() }));

const response = {
  me: { name: 'Anna', eligible: true },
  dependents: [],
  members: [
    { id: 2, name: 'Rachel', eligible: true, relationship: 'spouse' },
    { id: 3, name: 'Caleb', eligible: true, relationship: 'child', age: 15 },
    { id: 4, name: 'Noah', eligible: false, relationship: 'child', age: 11 },
  ],
};

const renderGoing = (props: Partial<React.ComponentProps<typeof YouAreGoing>> = {}) =>
  render(
    <YouAreGoing
      title="Family Game Night"
      whenLabel="Sat, Oct 17 · 6:00 PM"
      placeLabel="Fellowship Hall"
      response={response}
      saved={{ includeSelf: true, memberIds: [2] }}
      ageRange={{ age_min: 13, age_max: 17 }}
      onSave={jest.fn()}
      onAddToCalendar={jest.fn()}
      onCancelRsvp={jest.fn()}
      onClose={jest.fn()}
      {...props}
    />,
  );

describe("You're going", () => {
  it('shows the checklist, ineligible reason, Add family member, calendar and Cancel RSVP, but no Photos/Chat', () => {
    renderGoing();
    expect(screen.getByText("You're going")).toBeTruthy();
    expect(screen.getByText('Family Game Night')).toBeTruthy();
    expect(screen.getByText('Not eligible: ages 13–17')).toBeTruthy();
    expect(screen.getByLabelText('Noah').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Add family member')).toBeTruthy();
    expect(screen.getByText('Add to calendar')).toBeTruthy();
    expect(screen.getByText('Cancel RSVP')).toBeTruthy();
    expect(screen.queryByText('Photos')).toBeNull();
    expect(screen.queryByText('Chat')).toBeNull();
  });

  it('Save changes appears only after the selection changes, and saves the new selection', () => {
    const onSave = jest.fn();
    renderGoing({ onSave });
    expect(screen.queryByText('Save changes')).toBeNull();
    fireEvent.press(screen.getByLabelText('Caleb'));
    fireEvent.press(screen.getByText('Save changes'));
    expect(onSave).toHaveBeenCalledWith({ includeSelf: true, memberIds: [2, 3] });
  });

  it('unchecking everyone swaps Save for the Cancel RSVP flow', () => {
    const onCancelRsvp = jest.fn();
    const onSave = jest.fn();
    renderGoing({ onCancelRsvp, onSave, saved: { includeSelf: true, memberIds: [] } });
    fireEvent.press(screen.getByLabelText('Me'));
    expect(screen.queryByText('Save changes')).toBeNull();
    fireEvent.press(screen.getAllByText('Cancel RSVP')[0]);
    expect(onCancelRsvp).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('cancel RSVP errors', () => {
  it('shows the server message from a 400', () => {
    expect(cancelErrorMessage({ response: { status: 400, data: { detail: 'This gathering has already started.' } } })).toBe(
      'This gathering has already started.',
    );
  });
});
