import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { GoingSheet } from '../GoingSheet';

describe("You're going confirmation", () => {
  it('offers photos and chat, and dismiss does not undo the RSVP', () => {
    const onPhotos = jest.fn();
    const onChat = jest.fn();
    const onAddToCalendar = jest.fn();
    const onDismiss = jest.fn();
    render(
      <GoingSheet
        title="Women's Fall Brunch"
        onPhotos={onPhotos}
        onChat={onChat}
        onAddToCalendar={onAddToCalendar}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByText("You're going")).toBeTruthy();
    expect(screen.getByText("Women's Fall Brunch")).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Photos'));
    fireEvent.press(screen.getByLabelText('Chat'));
    fireEvent.press(screen.getByLabelText('Add to calendar'));
    fireEvent.press(screen.getByLabelText('Done'));

    expect(onPhotos).toHaveBeenCalledTimes(1);
    expect(onChat).toHaveBeenCalledTimes(1);
    expect(onAddToCalendar).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
