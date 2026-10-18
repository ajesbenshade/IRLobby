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

  it('Foyer (settings-v3): header+hero, Account, Notifications, Help (Send feedback), Account actions in that order; no Preferences card', async () => {
    renderScreen();
    await screen.findByText('Notifications');

    expect(screen.getByText('Control how the app reaches you and how your account behaves day to day.')).toBeTruthy();
    expect(screen.getByText('Notifications, feedback and account actions live here, separate from your profile.')).toBeTruthy();
    expect(screen.getByText('Email the team at support@irlobby.com')).toBeTruthy();

    const text = JSON.stringify(screen.toJSON());
    const order = ['Account controls', 'Your account on The Foyer', 'Decide what earns your attention', 'Send feedback', 'Export or sign out'];
    const positions = order.map((label) => text.indexOf(label));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    for (const row of ['Send feedback', 'Export my data', 'Sign out']) {
      expect(screen.getByText(row)).toBeTruthy();
    }
    for (const gone of ['New matches', 'Theme', 'Distance unit', 'Maximum distance', 'Retake vibe quiz', 'Tune the app to your defaults']) {
      expect(screen.queryByText(gone)).toBeNull();
    }
    expect(text).not.toMatch(/vibe|matches|distance|Preferences/i);
  });

  it('legacy irlobby mode keeps its Preferences rows and New matches', async () => {
    const previous = process.env.EXPO_PUBLIC_APP_MODE;
    process.env.EXPO_PUBLIC_APP_MODE = 'irlobby';
    try {
      renderScreen();
      await screen.findByText('Notifications');
      for (const row of ['New matches', 'Theme', 'Distance unit', 'Maximum distance', 'Retake vibe quiz']) {
        expect(screen.getByText(row)).toBeTruthy();
      }
      expect(screen.queryByText('Send feedback')).toBeNull();
    } finally {
      process.env.EXPO_PUBLIC_APP_MODE = previous;
    }
  });

  it('saving another setting sends the stored preferences.privacy blob back untouched (unknown keys too)', async () => {
    renderScreen();
    await screen.findByText('Notifications');
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    // Wait for the stored settings to load (the pill goes from Syncing to Live).
    await screen.findByText('Live');

    await act(async () => {
      fireEvent(screen.getByLabelText('Messages'), 'valueChange', false);
    });

    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    const body = (api.patch as jest.Mock).mock.calls[0][1];
    expect(body.preferences.privacy).toEqual(storedPrivacy);
    expect(body.preferences.privacy.showAge).toBe(false);
    expect(body.preferences.interests).toEqual(['hiking']);
    // Hidden preferences are still carried through untouched.
    expect(body.preferences.theme).toBe('light');
    expect(body.preferences.notifications.messages).toBe(false);
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

  it('every notification switch has an accessibility label, and while a save is running they are disabled and their labels dim to 50%', async () => {
    let finish: () => void = () => undefined;
    (api.patch as jest.Mock).mockReturnValue(new Promise<void>((resolve) => (finish = () => resolve())));
    renderScreen();
    await screen.findByText('Notifications');
    const titles = ['Push notifications', 'Email notifications', 'Activity reminders', 'Messages'];
    for (const title of titles) {
      expect(screen.getByLabelText(title).props.disabled).toBeFalsy();
    }
    const opacityOf = (title: string) => {
      // The row's text block is the nearest ancestor that carries the fade.
      let node = screen.getByText(title).parent;
      for (let depth = 0; node && depth < 4; depth += 1, node = node.parent) {
        const opacity = Object.assign({}, ...[node.props?.style].flat(4).filter(Boolean)).opacity;
        if (opacity !== undefined) {
          return opacity;
        }
      }
      return undefined;
    };
    expect(opacityOf('Messages')).toBeUndefined();
    await act(async () => {
      fireEvent(screen.getByLabelText('Messages'), 'valueChange', false);
    });
    await waitFor(() => expect(screen.getByLabelText('Messages').props.disabled).toBe(true));
    for (const title of titles) {
      expect(screen.getByLabelText(title).props.disabled).toBe(true);
      expect(opacityOf(title)).toBe(0.5);
    }
    await act(async () => {
      finish();
    });
    await waitFor(() => expect(screen.getByLabelText('Messages').props.disabled).toBeFalsy());
    expect(opacityOf('Messages')).toBeUndefined();
  });
});

describe('SettingsScreen beta: Send feedback and plain error copy', () => {
  beforeEach(() => {
    (api.get as jest.Mock).mockResolvedValue({ data: { preferences: {} } });
    (api.patch as jest.Mock).mockReset();
  });

  it('Send feedback opens a mailto to support@irlobby.com with the beta subject and version lines', async () => {
    const { Linking } = require('react-native');
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    renderScreen();
    await screen.findByText('Notifications');
    await act(async () => {
      fireEvent.press(screen.getByTestId('settings-send-feedback'));
    });
    expect(openURL).toHaveBeenCalledTimes(1);
    const url = openURL.mock.calls[0][0] as string;
    expect(url.startsWith('mailto:support@irlobby.com?subject=The%20Foyer%20beta%20feedback&body=')).toBe(true);
    const body = decodeURIComponent(url.split('body=')[1]);
    expect(body).toMatch(/The Foyer \S+/);
    expect(body).toMatch(/(iOS|Android|ios|android)/);
    expect(body).not.toMatch(/null|undefined/);
    openURL.mockRestore();
  });

  it('a failed save shows only "Something didn\'t save. Try again." (no raw error, no dev-speak)', async () => {
    (api.patch as jest.Mock).mockRejectedValue(new Error('Request failed with status code 500'));
    renderScreen();
    await screen.findByText('Notifications');
    await act(async () => {
      fireEvent(screen.getByLabelText('Messages'), 'valueChange', false);
    });
    expect(await screen.findByText("Something didn't save. Try again.")).toBeTruthy();
    const text = JSON.stringify(screen.toJSON());
    expect(text).not.toMatch(/status code 500|need another pass|underlying settings logic/);
  });
});
