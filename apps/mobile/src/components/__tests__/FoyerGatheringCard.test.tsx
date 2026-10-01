import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { gatheringLocationLabel } from '@foyer/logic';
import { FoyerGatheringCard } from '../FoyerGatheringCard';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

const longTitle = "Youth Bonfire and S'mores Night with the whole youth group and friends";
const longAddress = "A member's backyard (address shared after you RSVP) near the creek, behind the barn";
const longDescription =
  'An evening around the fire for our teens: s\'mores, songs, and time to hang out. Parents are welcome to drop off and pick up. Bring a camp chair and a jacket.';

const renderCard = (overrides: Partial<React.ComponentProps<typeof FoyerGatheringCard>> = {}) =>
  render(
    <FoyerGatheringCard
      title={longTitle}
      audienceLabel="Everyone · Ages 13–17"
      goingLabel="9 going"
      timeLabel="Wed, Oct 14 · 7:00 PM"
      locationLabel={longAddress}
      description={longDescription}
      hostName="Mark S."
      {...overrides}
    />,
  );

describe('FoyerGatheringCard text never clips', () => {
  it('renders the full title, address and description without line limits', () => {
    renderCard();

    for (const text of [longTitle, longAddress, longDescription]) {
      const node = screen.getByText(text);
      expect(node.props.numberOfLines).toBeUndefined();
      expect(node.props.ellipsizeMode).toBeUndefined();
      expect(node.props.adjustsFontSizeToFit).toBeUndefined();
    }
  });

  it('lets text beside icons shrink instead of overflowing, and gives text no fixed height', () => {
    renderCard();

    const address = StyleSheet.flatten(screen.getByText(longAddress).props.style);
    expect(address.flex).toBe(1);
    expect(address.height).toBeUndefined();
    expect(address.maxHeight).toBeUndefined();

    const title = StyleSheet.flatten(screen.getByText(longTitle).props.style);
    expect(title.height).toBeUndefined();
    // Line height must cover the 25pt serif so descenders are not cut off.
    expect(title.lineHeight).toBeGreaterThanOrEqual(title.fontSize as number);
  });

  it('is never wider than its container', () => {
    renderCard();
    const root = screen.root;
    const style = StyleSheet.flatten(root?.props.style);
    expect(style.width).toBeUndefined();
    expect(style.alignSelf).toBe('stretch');
  });

  it('scales normal text with Dynamic Type; only the chip and cover badge are capped', () => {
    renderCard();

    expect(screen.getByText(longTitle).props.maxFontSizeMultiplier).toBeUndefined();
    expect(screen.getByText(longDescription).props.maxFontSizeMultiplier).toBeUndefined();
    expect(screen.getByText('Everyone · Ages 13–17').props.maxFontSizeMultiplier).toBe(1.4);
    expect(screen.getByText('Cover photo').props.maxFontSizeMultiplier).toBe(1.4);
  });

  it('shows the RSVP address placeholder instead of a blank address', () => {
    renderCard({ locationLabel: gatheringLocationLabel('') });
    expect(screen.getByText('Address shared after you RSVP')).toBeTruthy();
  });

  it('omits the description row when there is none', () => {
    renderCard({ description: null });
    expect(screen.queryByText(longDescription)).toBeNull();
  });
});
