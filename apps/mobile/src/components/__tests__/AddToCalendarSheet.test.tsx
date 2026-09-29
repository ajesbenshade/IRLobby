import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { AddToCalendarSheet } from '../AddToCalendarSheet';

describe('Add to calendar sheet', () => {
  it('lists Google, Outlook, and Apple without asking for calendar access', () => {
    const onGoogle = jest.fn();
    const onOutlook = jest.fn();
    const onApple = jest.fn();
    const onDismiss = jest.fn();
    render(
      <AddToCalendarSheet onGoogle={onGoogle} onOutlook={onOutlook} onApple={onApple} onDismiss={onDismiss} />,
    );

    expect(screen.getByText("Opens in your calendar app. The Foyer doesn't need access to your calendar.")).toBeTruthy();
    expect(screen.getByText('Downloads an .ics file')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Google Calendar'));
    fireEvent.press(screen.getByLabelText('Outlook'));
    fireEvent.press(screen.getByLabelText('Apple Calendar'));
    fireEvent.press(screen.getByLabelText('Close calendar options'));

    expect(onGoogle).toHaveBeenCalledTimes(1);
    expect(onOutlook).toHaveBeenCalledTimes(1);
    expect(onApple).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
