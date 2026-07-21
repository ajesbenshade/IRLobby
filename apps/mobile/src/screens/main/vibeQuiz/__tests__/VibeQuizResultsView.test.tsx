import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { VibeQuizResultsView } from '../VibeQuizResultsView';

jest.mock('@services/activityService', () => ({
  fetchActivities: jest.fn(),
}));

jest.mock('@hooks/useOnline', () => ({
  useOnline: () => true,
}));

const { fetchActivities } = jest.requireMock('@services/activityService') as {
  fetchActivities: jest.Mock;
};

const renderWithClient = (ui: React.ReactElement) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

describe('VibeQuizResultsView', () => {
  beforeEach(() => {
    fetchActivities.mockReset();
  });

  it('renders the profile name and tag chips for each vibeTag', async () => {
    fetchActivities.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const onCta = jest.fn();
    renderWithClient(
      <VibeQuizResultsView
        vibeProfile="cozy_night_owl"
        vibeTags={['board_games', 'deep_talks']}
        discoverTags={['board games', 'deep talks']}
        ctaLabel="See My Matches →"
        onCta={onCta}
      />,
    );

    await waitFor(() => expect(fetchActivities).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/we found 2 activities/i)).toBeTruthy();
    expect(screen.getByText(/board games/i)).toBeTruthy();
    expect(screen.getByText(/deep talks/i)).toBeTruthy();
  });

  it('invokes onCta when the primary button is pressed', async () => {
    fetchActivities.mockResolvedValue([]);
    const onCta = jest.fn();
    renderWithClient(
      <VibeQuizResultsView
        vibeProfile="hype_energy_host"
        vibeTags={['live_music']}
        discoverTags={['live music']}
        ctaLabel="Save & close"
        onCta={onCta}
      />,
    );

    fireEvent.press(await screen.findByLabelText('Save & close'));
    expect(onCta).toHaveBeenCalledTimes(1);
  });

  it('disables the CTA while it is pending', async () => {
    fetchActivities.mockResolvedValue([]);
    const onCta = jest.fn();
    renderWithClient(
      <VibeQuizResultsView
        vibeProfile="adventure_seeker"
        vibeTags={['outdoors']}
        discoverTags={['outdoors']}
        ctaLabel="See Matches"
        onCta={onCta}
        isCtaPending
      />,
    );

    expect(await screen.findByText('Saving your vibe…')).toBeTruthy();
  });
});
