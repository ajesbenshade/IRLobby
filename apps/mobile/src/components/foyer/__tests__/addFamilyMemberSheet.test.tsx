import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { FAMILY_COPY } from '@constants/foyerCopy';
import { familyBirthDayLimits, formatBirthdayLong, MONTH_NAMES } from '@foyer/dates';
import { AddFamilyMemberSheet } from '../AddFamilyMemberSheet';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('@services/foyerService', () => ({ addFamilyMember: jest.fn(), updateFamilyMember: jest.fn() }));

const { addFamilyMember, updateFamilyMember } = jest.requireMock('@services/foyerService') as {
  addFamilyMember: jest.Mock;
  updateFamilyMember: jest.Mock;
};

// A day inside the allowed range: the earliest allowed month, on a day that month allows.
const limits = familyBirthDayLimits();
const pickedDay = { year: limits.min.year, month: limits.min.month, day: Math.max(limits.min.day, 15) };
const pickedIso = `${pickedDay.year}-${String(pickedDay.month).padStart(2, '0')}-${String(pickedDay.day).padStart(2, '0')}`;

const chooseBirthday = (view: ReturnType<typeof render>) => {
  fireEvent.press(view.getByTestId('family-birthday-row'));
  fireEvent.press(view.getByLabelText('Next'));
  fireEvent.press(view.getByLabelText(`${MONTH_NAMES[pickedDay.month - 1]} ${pickedDay.day}, ${pickedDay.year}`));
  fireEvent.press(view.getAllByLabelText('Confirm').pop() as never);
};

describe('Add family member sheet', () => {
  beforeEach(() => {
    addFamilyMember.mockReset();
    updateFamilyMember.mockReset();
  });

  it('has Name (First name), Sex Male|Female and a Birthday row, and no relationship choice', () => {
    const view = render(<AddFamilyMemberSheet visible onCancel={jest.fn()} onAdded={jest.fn()} />);
    expect(view.getByPlaceholderText('First name')).toBeTruthy();
    expect(view.getByLabelText('Male')).toBeTruthy();
    expect(view.getByLabelText('Female')).toBeTruthy();
    expect(view.getByText('Birthday')).toBeTruthy();
    expect(view.getByText('Month, day and year')).toBeTruthy();
    expect(view.getByText('Only you can see this unless you choose to share it.')).toBeTruthy();
    for (const word of ['Spouse', 'Child', 'Relationship']) {
      expect(view.queryByText(word)).toBeNull();
      expect(view.queryByLabelText(word)).toBeNull();
    }
    // Proposed share switch stays hidden unless a build turns it on.
    expect(view.queryByText('Show on my profile')).toBeNull();
  });

  it('keeps Add disabled until name, sex and birthday are all set', () => {
    const view = render(<AddFamilyMemberSheet visible onCancel={jest.fn()} onAdded={jest.fn()} />);
    const add = () => view.getByTestId('family-submit');
    expect(add().props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(view.getByLabelText(FAMILY_COPY.name), 'Noah');
    expect(add().props.accessibilityState.disabled).toBe(true);
    fireEvent.press(view.getByLabelText('Male'));
    expect(add().props.accessibilityState.disabled).toBe(true);
    chooseBirthday(view);
    expect(view.getByText(formatBirthdayLong(pickedDay))).toBeTruthy();
    expect(add().props.accessibilityState.disabled).toBe(false);
  });

  it('posts name, sex and date_of_birth only (no relationship)', async () => {
    addFamilyMember.mockResolvedValue(undefined);
    const onAdded = jest.fn();
    const view = render(<AddFamilyMemberSheet visible onCancel={jest.fn()} onAdded={onAdded} />);
    fireEvent.changeText(view.getByLabelText(FAMILY_COPY.name), ' Noah ');
    fireEvent.press(view.getByLabelText('Male'));
    chooseBirthday(view);
    fireEvent.press(view.getByTestId('family-submit'));
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(addFamilyMember).toHaveBeenCalledWith({ name: 'Noah', sex: 'male', date_of_birth: pickedIso });
    expect(Object.keys(addFamilyMember.mock.calls[0][0])).not.toContain('relationship');
  });

  it('shows Adding… while saving and an inline failure under Add that keeps the form', async () => {
    let reject: (error: unknown) => void = () => undefined;
    addFamilyMember.mockReturnValue(new Promise((_resolve, rejectFn) => (reject = rejectFn)));
    const view = render(<AddFamilyMemberSheet visible onCancel={jest.fn()} onAdded={jest.fn()} />);
    fireEvent.changeText(view.getByLabelText(FAMILY_COPY.name), 'Noah');
    fireEvent.press(view.getByLabelText('Male'));
    chooseBirthday(view);
    fireEvent.press(view.getByTestId('family-submit'));
    await waitFor(() => expect(view.getByText('Adding…')).toBeTruthy());
    reject(new Error('Network Error'));
    await waitFor(() => expect(view.getByText("Couldn't add Noah. Check your connection and try again.")).toBeTruthy());
    expect(view.getByTestId('family-submit').props.accessibilityState.disabled).toBe(false);
  });

  it('shows the adult error under the Birthday row and keeps Add enabled', async () => {
    addFamilyMember.mockRejectedValue({ response: { status: 400, data: { date_of_birth: 'Only children under 18 can be added to a household.' } } });
    const view = render(<AddFamilyMemberSheet visible onCancel={jest.fn()} onAdded={jest.fn()} />);
    fireEvent.changeText(view.getByLabelText(FAMILY_COPY.name), 'Sam');
    fireEvent.press(view.getByLabelText('Female'));
    chooseBirthday(view);
    fireEvent.press(view.getByTestId('family-submit'));
    await waitFor(() => expect(view.getByText('Only children under 18 can be added to a household.')).toBeTruthy());
    expect(view.queryByText(/Couldn't add/)).toBeNull();
    expect(view.getByTestId('family-submit').props.accessibilityState.disabled).toBe(false);
  });

  it('the day grid cannot pick the day someone turns 18 or any future day', () => {
    const view = render(<AddFamilyMemberSheet visible onCancel={jest.fn()} onAdded={jest.fn()} />);
    fireEvent.press(view.getByTestId('family-birthday-row'));
    fireEvent.press(view.getByLabelText('Next'));
    const edge = limits.min;
    if (edge.day > 1) {
      const blocked = view.getByLabelText(`${MONTH_NAMES[edge.month - 1]} ${edge.day - 1}, ${edge.year}`);
      expect(blocked.props.accessibilityState.disabled).toBe(true);
    }
    expect(view.getByLabelText(`${MONTH_NAMES[edge.month - 1]} ${edge.day}, ${edge.year}`).props.accessibilityState.disabled).toBe(false);
  });
});

describe('Edit family member sheet', () => {
  const member = { id: 7, name: 'Noah', relationship: 'child' as const, sex: 'male', birth_month: 3, birth_year: 2016, birth_day: 4, date_of_birth: '2016-03-04', age: 10 };

  it('prefills, keeps Save grey until something changes, then PATCHes', async () => {
    updateFamilyMember.mockResolvedValue(undefined);
    const onAdded = jest.fn();
    const onRemove = jest.fn();
    const view = render(<AddFamilyMemberSheet visible member={member} onRemove={onRemove} onCancel={jest.fn()} onAdded={onAdded} />);
    expect(view.getByText('Edit family member')).toBeTruthy();
    expect(view.getByDisplayValue('Noah')).toBeTruthy();
    expect(view.getByText('March 4, 2016')).toBeTruthy();
    expect(view.getByTestId('family-submit').props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(view.getByLabelText(FAMILY_COPY.name), 'Noah J');
    expect(view.getByTestId('family-submit').props.accessibilityState.disabled).toBe(false);
    fireEvent.press(view.getByTestId('family-submit'));
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(updateFamilyMember).toHaveBeenCalledWith(7, { name: 'Noah J', sex: 'male', date_of_birth: '2016-03-04' });
    fireEvent.press(view.getByLabelText('Remove from family'));
    expect(onRemove).toHaveBeenCalledWith(member);
  });

  it('shows the save failure inline and keeps the edits', async () => {
    updateFamilyMember.mockRejectedValue(new Error('offline'));
    const view = render(<AddFamilyMemberSheet visible member={member} onCancel={jest.fn()} onAdded={jest.fn()} />);
    fireEvent.changeText(view.getByLabelText(FAMILY_COPY.name), 'Noah J');
    fireEvent.press(view.getByTestId('family-submit'));
    await waitFor(() => expect(view.getByText("Couldn't save changes. Check your connection and try again.")).toBeTruthy());
    expect(view.getByDisplayValue('Noah J')).toBeTruthy();
    expect(view.getByTestId('family-submit').props.accessibilityState.disabled).toBe(false);
  });
});
