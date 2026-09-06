import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ChatScreen } from '../ChatScreen';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, firstName: 'Ada' } }),
}));

jest.mock('@services/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
}));

jest.mock('@services/chatService', () => ({
  fetchConversations: jest.fn(),
  fetchConversationMessages: jest.fn(),
  sendConversationMessage: jest.fn(),
}));

jest.mock('@services/matchService', () => ({
  fetchMatches: jest.fn(),
}));

jest.mock('@components/SafetyActionsModal', () => ({
  SafetyActionsModal: () => null,
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

const { fetchConversations } = jest.requireMock('@services/chatService') as {
  fetchConversations: jest.Mock;
};
const { fetchMatches } = jest.requireMock('@services/matchService') as {
  fetchMatches: jest.Mock;
};

const renderScreen = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ChatScreen />
    </QueryClientProvider>,
  );
};

describe('ChatScreen', () => {
  beforeEach(() => {
    fetchConversations.mockReset();
    fetchMatches.mockReset();
    fetchConversations.mockResolvedValue([]);
    fetchMatches.mockResolvedValue([]);
  });

  it('opens the conversation list without throwing', async () => {
    renderScreen();

    expect(await screen.findByText('Your conversations')).toBeTruthy();
    expect(screen.getByText('No chats yet')).toBeTruthy();
  });

  it('does not throw when matches is a DRF page object instead of an array', async () => {
    fetchMatches.mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });

    renderScreen();

    await waitFor(() => {
      expect(fetchMatches).toHaveBeenCalled();
    });

    expect(await screen.findByText('Your conversations')).toBeTruthy();
    expect(screen.queryByText('Hiccup detected')).toBeNull();
  });
});
