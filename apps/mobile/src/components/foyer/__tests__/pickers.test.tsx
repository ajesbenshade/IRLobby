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

  it('birthdate mode: opens on the month/year wheel, Done goes to the day grid, second Done saves', () => {
    const onDone = jest.fn();
    render(
      <DatePickerSheet visible mode="birthdate" title="Birth date" value={{ year: 1988, month: 3, day: 4 }} limits={birthDayLimits()} onCancel={jest.fn()} onDone={onDone} />,
    );
    expect(screen.getByLabelText('Month March')).toBeTruthy();
    expect(screen.getByLabelText('Year 1988')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Done'));
    fireEvent.press(screen.getByLabelText('March 4, 1988'));
    fireEvent.press(screen.getByLabelText('Done'));
    expect(onDone).toHaveBeenCalledWith({ year: 1988, month: 3, day: 4 });
  });

  it('month-year mode: wheel only, Done saves month and year with no day grid', () => {
    const onDone = jest.fn();
    render(
      <DatePickerSheet visible mode="monthYear" title="Birth month and year" value={{ year: 2012, month: 3 }} limits={familyBirthMonthLimits()} onCancel={jest.fn()} onDone={onDone} />,
    );
    expect(screen.queryByLabelText('Previous month')).toBeNull();
    fireEvent.press(screen.getByLabelText('Done'));
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
