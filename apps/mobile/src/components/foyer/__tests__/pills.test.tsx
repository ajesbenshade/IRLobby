import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';

import { CancelRsvpSheet } from '../CancelRsvpSheet';
import { PillButton, pillColors } from '../ui';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('@services/foyerService', () => ({
  cancelRsvp: jest.fn(),
  clearPass: jest.fn(),
  withdrawJoinRequest: jest.fn(),
}));

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

describe('pill colours', () => {
  it('primary is filled burgundy with white text, grey when disabled', () => {
    expect(pillColors('primary')).toMatchObject({ backgroundColor: '#a2033f', textColor: '#ffffff' });
    expect(pillColors('primary', { disabled: true })).toMatchObject({ backgroundColor: '#e1dbd7', textColor: '#7a7572' });
  });

  it('destructive is #8a0a1f filled; outline keeps a visible border', () => {
    expect(pillColors('destructive')).toMatchObject({ backgroundColor: '#8a0a1f', textColor: '#ffffff' });
    expect(pillColors('outline').borderWidth).toBeGreaterThan(0);
    expect(pillColors('destructiveOutline')).toMatchObject({ borderColor: '#8a0a1f', textColor: '#8a0a1f' });
  });
});

describe('PillButton', () => {
  it('renders a filled burgundy pill that is at least 54pt tall', () => {
    render(<PillButton label="Confirm" onPress={jest.fn()} testID="pill" />);
    const style = flat(screen.getByTestId('pill').props.style);
    expect(style.backgroundColor).toBe('#a2033f');
    expect(style.minHeight ?? style.height).toBeGreaterThanOrEqual(54);
  });

  it('shows a loading label with a spinner', () => {
    render(<PillButton label="Post gathering" loading loadingLabel="Posting…" />);
    expect(screen.getByText('Posting…')).toBeTruthy();
  });
});

describe('Cancel RSVP sheet', () => {
  const renderSheet = (props: Partial<React.ComponentProps<typeof CancelRsvpSheet>> = {}) =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CancelRsvpSheet visible activityId={4} title="Game night" onClose={jest.fn()} onCancelled={jest.fn()} {...props} />
      </QueryClientProvider>,
    );

  it('shows a filled "Cancel my RSVP" and an outlined "Keep my RSVP"', () => {
    renderSheet();
    expect(screen.getByText("You'll be removed from the guest list and the host will be told.")).toBeTruthy();
    expect(screen.getByLabelText('Cancel my RSVP')).toBeTruthy();
    expect(screen.getByLabelText('Keep my RSVP')).toBeTruthy();
  });

  it('shows a host nothing at all', () => {
    renderSheet({ isHost: true });
    expect(screen.queryByText('Cancel my RSVP')).toBeNull();
  });
});
