import React from 'react';
import { Modal } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

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
// The empty wheel opens ten years back (about 2016); pick the 15th of that month.
const now = new Date();
const pickedDay = { year: now.getFullYear() - 10, month: now.getMonth() + 1, day: 15 };
const pickedIso = `${pickedDay.year}-${String(pickedDay.month).padStart(2, '0')}-${String(pickedDay.day).padStart(2, '0')}`;

// The form steps aside and the picker opens once the form has finished closing (onDismiss on iOS, a short timer elsewhere), so
// every step after tapping Birthday is awaited.
const openBirthdayPicker = async (view: ReturnType<typeof render>) => {
  fireEvent.press(view.getByTestId('family-birthday-row'));
  await view.findByLabelText('Next');
};

const chooseBirthday = async (view: ReturnType<typeof render>) => {
  await openBirthdayPicker(view);
  fireEvent.press(view.getByLabelText('Next'));
  fireEvent.press(view.getByLabelText(`${MONTH_NAMES[pickedDay.month - 1]} ${pickedDay.day}, ${pickedDay.year}`));
  fireEvent.press(view.getAllByLabelText('Confirm').pop() as never);
  // And the form comes back with the date filled in.
  await view.findByTestId('family-submit');
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
    expect(view.getByText('Only you can see this. We use it to check event age ranges.')).toBeTruthy();
    expect(view.queryByText(/choose to share/i)).toBeNull();
    for (const word of ['Spouse', 'Child', 'Relationship']) {
      expect(view.queryByText(word)).toBeNull();
      expect(view.queryByLabelText(word)).toBeNull();
    }
    // Family birthdays are never shareable: there is no per-child switch.
    expect(view.queryByText('Show on my profile')).toBeNull();
    expect(view.queryByRole('switch')).toBeNull();
  });

  it('shows the subtitle under the title and the under-13 note above Add (not in Edit)', () => {
    const view = render(<AddFamilyMemberSheet visible onCancel={jest.fn()} onAdded={jest.fn()} />);
    expect(view.getByText("Add your children under 18 so hosts know who's coming.")).toBeTruthy();
    expect(view.getByText("Family members under 13 are RSVP names only — they don't have accounts.")).toBeTruthy();
  });

  it('the empty birthday wheel opens on the year 2016 (ten years back)', async () => {
    const view = render(<AddFamilyMemberSheet visible onCancel={jest.fn()} onAdded={jest.fn()} />);
    await openBirthdayPicker(view);
    expect(view.getByLabelText(`Year ${now.getFullYear() - 10}`).props.accessibilityState.selected).toBe(true);
  });

  it('keeps Add disabled until name, sex and birthday are all set', async () => {
    const view = render(<AddFamilyMemberSheet visible onCancel={jest.fn()} onAdded={jest.fn()} />);
    const add = () => view.getByTestId('family-submit');
    expect(add().props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(view.getByLabelText(FAMILY_COPY.name), 'Noah');
    expect(add().props.accessibilityState.disabled).toBe(true);
    fireEvent.press(view.getByLabelText('Male'));
    expect(add().props.accessibilityState.disabled).toBe(true);
    await chooseBirthday(view);
    expect(view.getByText(formatBirthdayLong(pickedDay))).toBeTruthy();
    expect(add().props.accessibilityState.disabled).toBe(false);
  });

  it('posts name, sex and date_of_birth only (no relationship)', async () => {
    addFamilyMember.mockResolvedValue(undefined);
    const onAdded = jest.fn();
    const view = render(<AddFamilyMemberSheet visible onCancel={jest.fn()} onAdded={onAdded} />);
    fireEvent.changeText(view.getByLabelText(FAMILY_COPY.name), ' Noah ');
    fireEvent.press(view.getByLabelText('Male'));
    await chooseBirthday(view);
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
    await chooseBirthday(view);
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
    await chooseBirthday(view);
    fireEvent.press(view.getByTestId('family-submit'));
    await waitFor(() => expect(view.getByText('Only children under 18 can be added to a household.')).toBeTruthy());
    expect(view.queryByText(/Couldn't add/)).toBeNull();
    expect(view.getByTestId('family-submit').props.accessibilityState.disabled).toBe(false);
  });

  it('the day grid cannot pick the day someone turns 18 or any future day', async () => {
    const view = render(<AddFamilyMemberSheet visible onCancel={jest.fn()} onAdded={jest.fn()} />);
    await openBirthdayPicker(view);
    fireEvent.press(view.getByLabelText('Next'));
    const edge = limits.min;
    // The grid opens ten years back; walk to the earliest allowed month.
    const monthsBack = (now.getFullYear() - 10 - edge.year) * 12 + (now.getMonth() + 1 - edge.month);
    for (let step = 0; step < monthsBack; step += 1) {
      fireEvent.press(view.getByLabelText('Previous month'));
    }
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

const modalStates = (view: ReturnType<typeof render>) =>
  view.UNSAFE_getAllByType(Modal).map((modal) => ({ visible: Boolean(modal.props.visible), onDismiss: modal.props.onDismiss as (() => void) | undefined }));

describe('Add family member: Birthday picker handoff (iOS cannot present a second modal over a presented one)', () => {
  beforeEach(() => {
    addFamilyMember.mockReset();
    updateFamilyMember.mockReset();
  });

  it('never has the form sheet and the picker presented together: form hides, then the picker opens, then the form returns', async () => {
    const view = render(<AddFamilyMemberSheet visible onCancel={jest.fn()} onAdded={jest.fn()} />);
    expect(modalStates(view).map((m) => m.visible)).toEqual([true, false]);
    fireEvent.press(view.getByTestId('family-birthday-row'));
    // Same render: the form is already hidden, the picker is NOT yet open (no overlap).
    expect(modalStates(view).map((m) => m.visible)).toEqual([false, false]);
    await view.findByLabelText('Next');
    expect(modalStates(view).map((m) => m.visible)).toEqual([false, true]);
    fireEvent.press(view.getAllByLabelText('Cancel').pop() as never);
    expect(modalStates(view).map((m) => m.visible)).toEqual([false, false]);
    await view.findByTestId('family-submit');
    expect(modalStates(view).map((m) => m.visible)).toEqual([true, false]);
  });

  it('opens the picker as soon as the form reports it has finished closing (onDismiss), without waiting for the timer', () => {
    const view = render(<AddFamilyMemberSheet visible onCancel={jest.fn()} onAdded={jest.fn()} />);
    fireEvent.press(view.getByTestId('family-birthday-row'));
    expect(modalStates(view).map((m) => m.visible)).toEqual([false, false]);
    act(() => {
      modalStates(view)[0].onDismiss?.();
    });
    expect(modalStates(view).map((m) => m.visible)).toEqual([false, true]);
  });

  it('keeps the typed name, sex and chosen date when the form comes back; Done sets the Birthday field', async () => {
    const view = render(<AddFamilyMemberSheet visible onCancel={jest.fn()} onAdded={jest.fn()} />);
    fireEvent.changeText(view.getByLabelText(FAMILY_COPY.name), 'Noah');
    fireEvent.press(view.getByLabelText('Male'));
    await chooseBirthday(view);
    expect(view.getByDisplayValue('Noah')).toBeTruthy();
    expect(view.getByLabelText('Male').props.accessibilityState.selected).toBe(true);
    expect(view.getByText(formatBirthdayLong(pickedDay))).toBeTruthy();
  });

  it('Cancel in the picker returns to the form with the Birthday field and the other values unchanged', async () => {
    const view = render(<AddFamilyMemberSheet visible onCancel={jest.fn()} onAdded={jest.fn()} />);
    fireEvent.changeText(view.getByLabelText(FAMILY_COPY.name), 'Noah');
    fireEvent.press(view.getByLabelText('Female'));
    await chooseBirthday(view);
    await openBirthdayPicker(view);
    fireEvent.press(view.getAllByLabelText('Cancel').pop() as never);
    await view.findByTestId('family-submit');
    expect(view.getByText(formatBirthdayLong(pickedDay))).toBeTruthy();
    expect(view.getByDisplayValue('Noah')).toBeTruthy();
    expect(view.getByLabelText('Female').props.accessibilityState.selected).toBe(true);
  });

  it('Cancel from an empty Birthday leaves the placeholder', async () => {
    const view = render(<AddFamilyMemberSheet visible onCancel={jest.fn()} onAdded={jest.fn()} />);
    await openBirthdayPicker(view);
    fireEvent.press(view.getAllByLabelText('Cancel').pop() as never);
    await view.findByTestId('family-submit');
    expect(view.getByText('Month, day and year')).toBeTruthy();
  });
});

describe('Edit family member sheet for an adult / spouse row', () => {
  const spouse = { id: 9, name: 'Rachel', relationship: 'spouse' as const, sex: null, birth_month: null, birth_year: null, birth_day: null, date_of_birth: null, age: null };

  it('does not crash, shows no birthday editing and never reads "null"', () => {
    const view = render(<AddFamilyMemberSheet visible member={spouse} onCancel={jest.fn()} onAdded={jest.fn()} />);
    expect(view.getByDisplayValue('Rachel')).toBeTruthy();
    expect(view.queryByTestId('family-birthday-row')).toBeNull();
    expect(view.queryByText('Month, day and year')).toBeNull();
    expect(view.queryByText(/null|undefined/i)).toBeNull();
  });

  it('saves only name and sex (never a birth date, so it cannot become a child)', async () => {
    updateFamilyMember.mockResolvedValue(undefined);
    const onAdded = jest.fn();
    const view = render(<AddFamilyMemberSheet visible member={spouse} onCancel={jest.fn()} onAdded={onAdded} />);
    expect(view.getByTestId('family-submit').props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(view.getByLabelText(FAMILY_COPY.name), 'Rachel B');
    fireEvent.press(view.getByLabelText('Female'));
    fireEvent.press(view.getByTestId('family-submit'));
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(updateFamilyMember).toHaveBeenCalledWith(9, { name: 'Rachel B', sex: 'female' });
  });

  it('an empty-string sex does not crash and Remove from family still works', () => {
    const onRemove = jest.fn();
    const row = { ...spouse, sex: '' };
    const view = render(<AddFamilyMemberSheet visible member={row} onRemove={onRemove} onCancel={jest.fn()} onAdded={jest.fn()} />);
    fireEvent.press(view.getByLabelText('Remove from family'));
    expect(onRemove).toHaveBeenCalledWith(row);
  });
});
