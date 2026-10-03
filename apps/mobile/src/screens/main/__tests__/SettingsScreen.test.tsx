import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { account as accountCopy } from '@constants/copy';
import { api } from '@services/apiClient';
import * as SettingsModule from '../SettingsScreen';
import { SettingsScreen, loadSettings, toPayload } from '../SettingsScreen';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({ signOut: jest.fn() }),
}));

jest.mock('@services/apiClient', () => ({
  api: {
    get: jest.fn().mockResolvedValue({ data: {} }),
    patch: jest.fn(),
  },
}));

jest.mock('@services/pushNotificationService', () => ({
  deactivatePushTokens: jest.fn(),
  registerCurrentDevicePushToken: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

const renderScreen = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SettingsScreen />
    </QueryClientProvider>,
  );
};

describe('SettingsScreen account path', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it('navigates Settings → Account and does not delete from Settings', () => {
    renderScreen();

    fireEvent.press(screen.getByLabelText(accountCopy.settingsRowTitle));
    expect(mockNavigate).toHaveBeenCalledWith('Account');
    expect(screen.queryByText(accountCopy.deleteCta)).toBeNull();
  });
});

const storedPrivacy = { profileVisibility: 'friends', locationSharing: true, showAge: false, showEmail: true, futureKey: { nested: 1 } };

describe('SettingsScreen consolidation (option A)', () => {
  beforeEach(() => {
    (api.get as jest.Mock).mockResolvedValue({
      data: { preferences: { theme: 'light', interests: ['hiking'], privacy: storedPrivacy } },
    });
    (api.patch as jest.Mock).mockReset();
    (api.patch as jest.Mock).mockResolvedValue({ data: {} });
  });

  it('has no Privacy card, no Location card, no legacy visibility cycler and no Show age / Show my age row', async () => {
    renderScreen();
    await screen.findByText('Notifications');

    for (const text of [
      'Control what people can see',
      'Show age',
      'Show email',
      'Profile visibility',
      'Show my age',
      'Location',
      'Use my location to find nearby gatherings',
      'Never shown to other people.',
    ]) {
      expect(screen.queryByText(text)).toBeNull();
    }
    expect(screen.queryByLabelText('Use my location to find nearby gatherings')).toBeNull();
    expect('LOCATION_TOGGLE_LABEL' in SettingsModule).toBe(false);
    expect('LOCATION_TOGGLE_HELPER' in SettingsModule).toBe(false);
  });

  it('keeps header+hero, Account, Notifications, Preferences, Account actions in that order with the reworded subtitles', async () => {
    renderScreen();
    await screen.findByText('Notifications');

    expect(screen.getByText('Control how the app reaches you and how your account behaves day to day.')).toBeTruthy();
    expect(
      screen.getByText('Notification delivery and distance preferences update here without changing the rest of your profile flow.'),
    ).toBeTruthy();

    const text = JSON.stringify(screen.toJSON());
    const order = ['Account controls', 'Your account on The Foyer', 'Decide what earns your attention', 'Tune the app to your defaults', 'Export or sign out'];
    const positions = order.map((label) => text.indexOf(label));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    for (const row of ['Theme', 'Distance unit', 'Maximum distance', 'Retake vibe quiz', 'Export my data', 'Sign out']) {
      expect(screen.getByText(row)).toBeTruthy();
    }
  });

  it('saving another setting sends the stored preferences.privacy blob back untouched (unknown keys too)', async () => {
    renderScreen();
    await screen.findByText('Notifications');
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    await act(async () => {
      fireEvent.press(screen.getByText('Retake vibe quiz'));
    });
    // Theme cycles light -> dark.
    await act(async () => {
      fireEvent.press(screen.getByText('Light'));
    });

    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    const body = (api.patch as jest.Mock).mock.calls[0][1];
    expect(body.preferences.privacy).toEqual(storedPrivacy);
    expect(body.preferences.privacy.showAge).toBe(false);
    expect(body.preferences.interests).toEqual(['hiking']);
    expect(body.preferences.theme).toBe('dark');
  });

  it('never writes privacy defaults: an account with no stored privacy blob gets none', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { preferences: { theme: 'light' } } });
    const loaded = await loadSettings();
    expect(loaded.privacy).toBeUndefined();
    const payload = toPayload(loaded);
    expect('privacy' in payload.preferences).toBe(false);
    expect(JSON.stringify(payload)).not.toMatch(/locationSharing|showAge|profileVisibility/);
  });

  it('toPayload keeps whatever privacy keys were stored', async () => {
    const loaded = await loadSettings();
    expect(toPayload(loaded).preferences.privacy).toEqual(storedPrivacy);
  });
});
