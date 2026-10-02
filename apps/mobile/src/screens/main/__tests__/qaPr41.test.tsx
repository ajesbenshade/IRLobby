import fs from 'fs';
import path from 'path';
import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

import { SwipeActionButtons } from '@components/SwipeActionButtons';
import { PILL_BURGUNDY, PILL_BURGUNDY_PRESSED, PILL_DESTRUCTIVE } from '@foyer/buttonTokens';
import { pillColors } from '@components/foyer/ui';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));

const src = (rel: string) => fs.readFileSync(path.join(__dirname, '..', '..', '..', rel), 'utf8');

describe('PR #41 design QA fixes', () => {
  it('editing a gathering keeps its saved map coordinates (never sends 0,0)', () => {
    const text = src('screens/main/FoyerHostForm.tsx');
    expect(text).toMatch(/churchCenterOf\(\{ latitude: existing\.latitude, longitude: existing\.longitude \}\)/);
    expect(text).toMatch(/coords\?\.latitude \?\? Number\(existing\?\.latitude \?\? 0\)/);
    expect(text).toMatch(/coords\?\.longitude \?\? Number\(existing\?\.longitude \?\? 0\)/);
  });

  it('pressed burgundy is #870234 and a loading Add stays burgundy', () => {
    expect(PILL_BURGUNDY_PRESSED).toBe('#870234');
    expect(pillColors('primary', { disabled: false, loading: true, pressed: false }).backgroundColor).toBe(PILL_BURGUNDY);
    expect(pillColors('primary', { disabled: false, loading: false, pressed: true }).backgroundColor).toBe(PILL_BURGUNDY_PRESSED);
    expect(PILL_DESTRUCTIVE).toBe('#8a0a1f');
  });

  it('swipe: primary pill grows (flex 1), hints only on tappable states', () => {
    const open = render(<SwipeActionButtons onPass={jest.fn()} onGoing={jest.fn()} goingLabel="I'm going" goingKind="join" />);
    expect(StyleSheet.flatten(open.getByTestId('swipe-going').props.style).flex).toBe(1);
    expect(open.getByTestId('swipe-going').props.accessibilityHint).toMatch(/who is coming/);
    const full = render(<SwipeActionButtons onPass={jest.fn()} onGoing={jest.fn()} goingLabel="This gathering is full" goingKind="full" goingDisabled />);
    expect(full.getAllByTestId('swipe-going').pop()?.props.accessibilityHint).toBeUndefined();
  });

  it('Discover no longer repeats the full notice above a pill that already says full', () => {
    expect(src('screens/main/DiscoverScreen.tsx')).not.toMatch(/fullNotice/);
  });

  it('iOS location purpose string matches the map-only use', () => {
    expect(src('../app.config.ts')).toContain('center the map when you choose a place. You can turn this off in your profile.');
  });

  it('no hardcoded Unable-to fallbacks in GatheringDetail, no dead PHOTO_COPY.failedAll, declined tag uses the cancelled colours', () => {
    expect(src('screens/main/GatheringDetailScreen.tsx')).not.toMatch(/'Unable to /);
    expect(src('constants/foyerCopy.ts')).not.toMatch(/failedAll/);
    const gatherings = src('screens/main/FoyerGatherings.tsx');
    expect(gatherings).toMatch(/declined: \{ backgroundColor: '#e1dbd7' \}/);
    expect(gatherings).toMatch(/declined: \{ color: '#5b5551' \}/);
  });

  it('Discover has no hardcoded Unable-to fallbacks (they live in COMMON_COPY)', () => {
    expect(src('screens/main/DiscoverScreen.tsx')).not.toMatch(/'Unable to /);
    const { COMMON_COPY } = require('@constants/foyerCopy') as typeof import('@constants/foyerCopy');
    expect(COMMON_COPY.rsvpSaveFailed).toMatch(/RSVP/);
    expect(COMMON_COPY.rsvpOpenFailed).toBeTruthy();
  });

  it('removed share-switch and stale host-card comments are gone', () => {
    expect(src('components/foyer/AddFamilyMemberSheet.tsx')).not.toMatch(/Show on my profile/);
    expect(src('components/foyer/HostAttendeesCard.tsx')).not.toMatch(/relationship lines/);
  });
});
