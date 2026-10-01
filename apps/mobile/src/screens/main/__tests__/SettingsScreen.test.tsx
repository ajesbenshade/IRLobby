import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { account as accountCopy } from '@constants/copy';
import { LOCATION_TOGGLE_LABEL, SettingsScreen } from '../SettingsScreen';

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

describe('SettingsScreen location section', () => {
  it('puts the location toggle in its own Location section, not under "what people can see"', () => {
    renderScreen();

    expect(screen.getByText(LOCATION_TOGGLE_LABEL)).toBeTruthy();
    expect(screen.getByText('Never shown to other people.')).toBeTruthy();
    expect(screen.getByLabelText(LOCATION_TOGGLE_LABEL)).toBeTruthy();
    // Old label and the "never sent to the server" claim must not appear.
    expect(screen.queryByText('Location sharing')).toBeNull();
    expect(screen.queryByText(/never sent|not sent|stays on your device/i)).toBeNull();

    // The Privacy card keeps its heading but no longer holds the location row.
    const privacyHeading = screen.getByText('Control what people can see');
    const locationHeading = screen.getByText('Location');
    const privacyCard = privacyHeading.parent?.parent?.parent;
    expect(privacyCard).toBeTruthy();
    expect(() => within(privacyCard as never).getByText(LOCATION_TOGGLE_LABEL)).toThrow();
    expect(locationHeading).toBeTruthy();
  });
});
