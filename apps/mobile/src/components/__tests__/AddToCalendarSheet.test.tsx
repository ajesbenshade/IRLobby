import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const MockReact = require('react');
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: { name: string }) => MockReact.createElement(Text, null, name),
  };
});

import { AddToCalendarSheet } from '../AddToCalendarSheet';

describe('Add to calendar sheet', () => {
  it('lists Google, Outlook, and Apple without asking for calendar access', () => {
    const onGoogle = jest.fn();
    const onOutlook = jest.fn();
    const onApple = jest.fn();
    const onDismiss = jest.fn();
    render(
      <AddToCalendarSheet
        summary="Women's Fall Brunch · Sat, Oct 17 · 9:30 AM"
        onGoogle={onGoogle}
        onOutlook={onOutlook}
        onApple={onApple}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByText("Women's Fall Brunch · Sat, Oct 17 · 9:30 AM")).toBeTruthy();
    expect(screen.getByText("Opens in your calendar app. The Foyer doesn't need access to your calendar.")).toBeTruthy();
    expect(screen.getByText('Downloads an .ics file')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Google Calendar'));
    fireEvent.press(screen.getByLabelText('Outlook'));
    fireEvent.press(screen.getByLabelText('Apple Calendar'));
    fireEvent.press(screen.getByLabelText('Cancel'));

    expect(onGoogle).toHaveBeenCalledTimes(1);
    expect(onOutlook).toHaveBeenCalledTimes(1);
    expect(onApple).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(4);
  });
});
