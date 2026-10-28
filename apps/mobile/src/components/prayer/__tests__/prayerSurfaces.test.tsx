import { fireEvent, render, screen } from '@testing-library/react-native';

import { DiscoverFeedFilterButton } from '@components/prayer/DiscoverFeedFilterButton';
import { PrayerVisibilityFields } from '@components/prayer/PrayerVisibilityFields';
import { PRAYER_COPY } from '@shared/prayer';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));

const circles = [{ id: 1, name: 'Young Adults' }];

describe('prayer create visibility', () => {
  const props = {
    circles,
    selectedIds: [1],
    onChangeSelected: jest.fn(),
    wholeChurch: false,
    onChangeWholeChurch: jest.fn(),
    circlesStatus: 'ready' as const,
  };

  it('shows the circle picker and the whole-church toggle, off by default', () => {
    render(<PrayerVisibilityFields {...props} />);
    expect(screen.getByText(PRAYER_COPY.whoCanSee)).toBeTruthy();
    expect(screen.getByText('Young Adults circle')).toBeTruthy();
    expect(screen.getByText(PRAYER_COPY.wholeChurchToggle)).toBeTruthy();
    expect(screen.getByText(PRAYER_COPY.wholeChurchOff)).toBeTruthy();
    expect(screen.getByTestId('prayer-whole-church').props.value).toBe(false);
  });
});

describe('Show on Discover', () => {
  it('lists gatherings and prayer, gatherings only, and prayer only', () => {
    render(<DiscoverFeedFilterButton value="both" onChange={jest.fn()} />);
    fireEvent.press(screen.getByTestId('discover-feed-filter'));
    expect(screen.getByText(PRAYER_COPY.filterTitle)).toBeTruthy();
    expect(screen.getAllByText(PRAYER_COPY.filterBoth).length).toBeGreaterThan(1);
    expect(screen.getByText(PRAYER_COPY.filterGatherings)).toBeTruthy();
    expect(screen.getByText(PRAYER_COPY.filterPrayer)).toBeTruthy();
    expect(screen.getByText(PRAYER_COPY.filterFootnote)).toBeTruthy();
  });
});
