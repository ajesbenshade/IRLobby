import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { account as accountCopy } from '@constants/copy';
import { SettingsScreen } from '../SettingsScreen';

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
