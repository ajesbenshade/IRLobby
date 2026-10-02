import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { DatePickerSheet } from '../DatePickerSheet';
import { TimePickerSheet } from '../TimePickerSheet';
import { birthDayLimits, hostDayLimits, familyBirthMonthLimits, endTimeSlots, timeSlots, DEFAULT_START_MINUTES } from '@foyer/dates';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));

describe('DatePickerSheet', () => {
  it('day mode: past days are disabled, a future day can be chosen, Done saves', () => {
    const onDone = jest.fn();
    const now = new Date();
    render(
      <DatePickerSheet visible mode="day" title="Date" value={null} limits={hostDayLimits()} onCancel={jest.fn()} onDone={onDone} />,
    );
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const label = (day: number) => `${months[now.getMonth()]} ${day}, ${now.getFullYear()}`;
    if (now.getDate() > 1) {
      expect(screen.getByLabelText(label(now.getDate() - 1)).props.accessibilityState.disabled).toBe(true);
    }
    expect(screen.getByLabelText('Previous month').props.accessibilityState.disabled).toBe(true);
    const done = screen.getByLabelText('Done');
    expect(done.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByLabelText(label(now.getDate())));
    fireEvent.press(screen.getByLabelText('Done'));
    expect(onDone).toHaveBeenCalledWith({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });
  });

  it('birthdate mode: opens on the month/year wheel, Next goes to the day grid, Confirm saves', () => {
    const onDone = jest.fn();
    render(
      <DatePickerSheet visible mode="birthdate" title="Birth date" value={{ year: 1988, month: 3, day: 4 }} limits={birthDayLimits()} onCancel={jest.fn()} onDone={onDone} />,
    );
    expect(screen.getByLabelText('Month March')).toBeTruthy();
    expect(screen.getByLabelText('Year 1988')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByLabelText('Back')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('March 4, 1988'));
    fireEvent.press(screen.getByLabelText('Confirm'));
    expect(onDone).toHaveBeenCalledWith({ year: 1988, month: 3, day: 4 });
  });

  it('month-year mode: wheel only, Confirm saves month and year with no day grid', () => {
    const onDone = jest.fn();
    render(
      <DatePickerSheet visible mode="monthYear" title="Birth month and year" value={{ year: 2012, month: 3 }} limits={familyBirthMonthLimits()} onCancel={jest.fn()} onDone={onDone} />,
    );
    expect(screen.queryByLabelText('Previous month')).toBeNull();
    fireEvent.press(screen.getByLabelText('Confirm'));
    expect(onDone).toHaveBeenCalledWith({ year: 2012, month: 3 });
  });

  it('Cancel closes with no change', () => {
    const onCancel = jest.fn();
    const onDone = jest.fn();
    render(<DatePickerSheet visible mode="day" title="Date" value={null} limits={hostDayLimits()} onCancel={onCancel} onDone={onDone} />);
    fireEvent.press(screen.getAllByLabelText('Cancel').pop() as never);
    expect(onCancel).toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('TimePickerSheet', () => {
  it('start time opens on 7:00 PM and Done returns it', () => {
    const onDone = jest.fn();
    render(
      <TimePickerSheet visible title="Start time" slots={timeSlots()} value={null} defaultValue={DEFAULT_START_MINUTES} onCancel={jest.fn()} onDone={onDone} />,
    );
    expect(screen.getByLabelText('7:00 PM').props.accessibilityState.selected).toBe(true);
    fireEvent.press(screen.getByLabelText('Done'));
    expect(onDone).toHaveBeenCalledWith(DEFAULT_START_MINUTES);
  });

  it('end time is optional: No end time returns null', () => {
    const onDone = jest.fn();
    render(
      <TimePickerSheet visible title="Ends" slots={endTimeSlots(DEFAULT_START_MINUTES)} value={null} allowNone onCancel={jest.fn()} onDone={onDone} />,
    );
    expect(screen.getByLabelText('No end time').props.accessibilityState.selected).toBe(true);
    expect(screen.queryByLabelText('7:00 PM')).toBeNull();
    fireEvent.press(screen.getByLabelText('Done'));
    expect(onDone).toHaveBeenCalledWith(null);
  });
});

describe('DatePickerSheet age and future-month rules (injected today)', () => {
  const NOW = new Date(2026, 9, 2, 12, 0, 0); // Oct 2, 2026, device-local

  const openBirth = (value: { year: number; month: number; day: number }) => {
    const onDone = jest.fn();
    render(
      <DatePickerSheet
        visible
        mode="birthdate"
        title="Birth date"
        value={value}
        limits={birthDayLimits(NOW)}
        now={NOW}
        onCancel={jest.fn()}
        onDone={onDone}
      />,
    );
    fireEvent.press(screen.getByLabelText('Next'));
    return onDone;
  };

  it('turning 13 today is allowed', () => {
    const onDone = openBirth({ year: 2013, month: 10, day: 2 });
    expect(screen.queryByText('Accounts are not available under age 13.')).toBeNull();
    fireEvent.press(screen.getByLabelText('Confirm'));
    expect(onDone).toHaveBeenCalledWith({ year: 2013, month: 10, day: 2 });
  });

  it('one day younger than 13 shows the pill and keeps Confirm disabled', () => {
    const onDone = openBirth({ year: 2013, month: 10, day: 3 });
    expect(screen.getByText('Accounts are not available under age 13.')).toBeTruthy();
    // The message replaces the date readout instead of sitting under the grid.
    expect(screen.queryByText(/Thursday|Friday|Saturday|Sunday|Monday|Tuesday|Wednesday/)).toBeNull();
    expect(screen.queryByText('Pick a day')).toBeNull();
    expect(screen.getByTestId('picker-confirm').props.accessibilityState?.disabled).toBe(true);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('family month/year: a future month is greyed with a note and cannot be confirmed', () => {
    const onDone = jest.fn();
    render(
      <DatePickerSheet
        visible
        mode="monthYear"
        title="Birth month and year"
        value={{ year: 2026, month: 11 }}
        limits={familyBirthMonthLimits(NOW)}
        now={NOW}
        onCancel={jest.fn()}
        onDone={onDone}
      />,
    );
    expect(screen.getByText('Pick a month that has already passed.')).toBeTruthy();
    expect(screen.getByTestId('picker-confirm').props.accessibilityState?.disabled).toBe(true);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('confirm pill is the 54pt filled burgundy pill', () => {
    openBirth({ year: 1988, month: 3, day: 4 });
    const style = [screen.getByTestId('picker-confirm').props.style].flat(Infinity).filter(Boolean);
    const merged = Object.assign({}, ...style);
    expect(merged.minHeight ?? merged.height).toBeGreaterThanOrEqual(54);
  });
});
