import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { SwipeActionButtons } from '../SwipeActionButtons';

describe('SwipeActionButtons', () => {
  it('renders real Pass and I\'m going buttons that call their handlers', () => {
    const onPass = jest.fn();
    const onGoing = jest.fn();
    render(<SwipeActionButtons onPass={onPass} onGoing={onGoing} />);

    fireEvent.press(screen.getByRole('button', { name: 'Pass' }));
    fireEvent.press(screen.getByRole('button', { name: "I'm going" }));

    expect(onPass).toHaveBeenCalledTimes(1);
    expect(onGoing).toHaveBeenCalledTimes(1);
  });

  it('styles Pass as an outlined ink pill and I\'m going as a solid burgundy pill with pure white text', () => {
    render(<SwipeActionButtons onPass={jest.fn()} onGoing={jest.fn()} />);

    const pass = StyleSheet.flatten(screen.getByRole('button', { name: 'Pass' }).props.style);
    const going = StyleSheet.flatten(screen.getByRole('button', { name: "I'm going" }).props.style);

    expect(pass.minHeight).toBe(54);
    expect(going.minHeight).toBe(54);
    expect(pass.borderColor).toBe('#222222');
    expect(pass.borderWidth).toBeGreaterThan(1);
    expect(going.backgroundColor).toBe('#a2033f');

    const goingLabel = StyleSheet.flatten(screen.getByText("I'm going").props.style);
    expect(goingLabel.color).toBe('#ffffff');
    expect(StyleSheet.flatten(screen.getByText('Pass').props.style).color).toBe('#222222');
  });

  it('uses the family wording under the buttons and never the old "a child" prompt', () => {
    render(<SwipeActionButtons onPass={jest.fn()} onGoing={jest.fn()} />);

    expect(screen.getByText('Choose yourself or your family.')).toBeTruthy();
    expect(screen.queryByText(/or a child/i)).toBeNull();
  });

  it('disables both buttons while a request is in flight', () => {
    const onPass = jest.fn();
    const onGoing = jest.fn();
    render(<SwipeActionButtons onPass={onPass} onGoing={onGoing} disabled />);

    fireEvent.press(screen.getByRole('button', { name: 'Pass' }));
    fireEvent.press(screen.getByRole('button', { name: "I'm going" }));

    expect(onPass).not.toHaveBeenCalled();
    expect(onGoing).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Pass' }).props.accessibilityState.disabled).toBe(true);
  });

  it('shows an inline error and caps font scaling only on the pill labels', () => {
    render(<SwipeActionButtons onPass={jest.fn()} onGoing={jest.fn()} error="Unable to save your RSVP." />);

    expect(screen.getByText('Unable to save your RSVP.')).toBeTruthy();
    expect(screen.getByText('Pass').props.maxFontSizeMultiplier).toBe(1.4);
    expect(screen.getByText('Unable to save your RSVP.').props.maxFontSizeMultiplier).toBeUndefined();
  });
});
