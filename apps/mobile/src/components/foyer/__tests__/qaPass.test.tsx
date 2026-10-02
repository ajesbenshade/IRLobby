import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { CANCEL_COPY } from '@constants/foyerCopy';
import { HostAttendeesCard } from '../HostAttendeesCard';
import { InlineError, PILL_DESTRUCTIVE } from '../ui';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));

const data = {
  going_count: 12,
  households: [
    {
      name: 'Esbenshade',
      people: Array.from({ length: 12 }, (_, index) => ({ name: `Person ${index}`, relationship: 'adult', age_band: 'adult' })),
    },
  ],
} as never;

describe('HostAttendeesCard', () => {
  it('reads Who was invited / N RSVPed / Show N more on a cancelled gathering, with no "going"', () => {
    render(<HostAttendeesCard data={data} cancelled />);
    expect(screen.getByText(CANCEL_COPY.invitedHeading)).toBeTruthy();
    expect(screen.getByText('12 RSVPed')).toBeTruthy();
    expect(screen.queryByText("Who's coming")).toBeNull();
    expect(screen.queryByText(/going/)).toBeNull();
    expect(screen.queryByText(/Who was invited ·/)).toBeNull();
    expect(screen.getByText('Show 4 more')).toBeTruthy();
  });

  it('keeps Who is coming / N going on a live gathering', () => {
    render(<HostAttendeesCard data={data} />);
    expect(screen.getByText("Who's coming")).toBeTruthy();
    expect(screen.getByText('12 going')).toBeTruthy();
    fireEvent.press(screen.getByText('Show 4 more going'));
  });
});

describe('InlineError', () => {
  it('uses the dark red #8a0a1f', () => {
    render(<InlineError message="Nope" />);
    expect(StyleSheet.flatten(screen.getByText('Nope').props.style).color).toBe('#8a0a1f');
    expect(PILL_DESTRUCTIVE).toBe('#8a0a1f');
  });
});
