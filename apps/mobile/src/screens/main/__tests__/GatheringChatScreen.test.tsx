import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { GatheringChatScreen } from '../GatheringChatScreen';

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: { activityId: 12, title: 'Family Game Night' } }),
}));
jest.mock('@hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 1 } }) }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('@services/activityService', () => ({ fetchActivity: jest.fn() }));
jest.mock('@services/chatService', () => ({
  fetchGatheringChatMessages: jest.fn(),
  sendGatheringChatMessage: jest.fn(),
}));

const { fetchGatheringChatMessages, sendGatheringChatMessage } = jest.requireMock('@services/chatService') as {
  fetchGatheringChatMessages: jest.Mock;
  sendGatheringChatMessage: jest.Mock;
};

const renderScreen = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <GatheringChatScreen />
    </QueryClientProvider>,
  );
};

const message = (id: number, userId: number, name: string, text: string) => ({
  id,
  userId,
  user: { id: userId, firstName: name },
  message: text,
  createdAt: '2026-10-03T22:00:00Z',
});

describe('GatheringChatScreen', () => {
  beforeEach(() => {
    fetchGatheringChatMessages.mockReset();
    sendGatheringChatMessage.mockReset();
  });

  it('loads the chat by activity id and shows the gathering, who can see it, and sender names', async () => {
    fetchGatheringChatMessages.mockResolvedValue([message(1, 2, 'Rachel', 'See you at six'), message(2, 1, 'Me', 'Bringing chips')]);
    renderScreen();
    expect(await screen.findByText('See you at six')).toBeTruthy();
    expect(fetchGatheringChatMessages).toHaveBeenCalledWith(12);
    expect(screen.getByText('Family Game Night')).toBeTruthy();
    expect(screen.getByText('Only the host and people who are going can see this chat.')).toBeTruthy();
    expect(screen.getByText('Rachel')).toBeTruthy();
    expect(screen.queryByText('Me')).toBeNull();
  });

  it('sends a message to the same gathering', async () => {
    fetchGatheringChatMessages.mockResolvedValue([message(1, 2, 'Rachel', 'Hi')]);
    sendGatheringChatMessage.mockResolvedValue(message(3, 1, 'Me', 'On my way'));
    renderScreen();
    await screen.findByText('Hi');
    fireEvent.changeText(screen.getByLabelText('Message'), ' On my way ');
    fireEvent.press(screen.getByLabelText('Send message'));
    await waitFor(() => expect(sendGatheringChatMessage).toHaveBeenCalledWith(12, 'On my way'));
  });

  it('empty chat explains it starts with two people going', async () => {
    fetchGatheringChatMessages.mockResolvedValue([]);
    renderScreen();
    expect(await screen.findByText('No messages yet')).toBeTruthy();
    expect(screen.getByText('Say hello. Chat starts once at least two people are going.')).toBeTruthy();
  });

  it('a 403 (not going / not hosting) shows the gate message and disables the composer', async () => {
    fetchGatheringChatMessages.mockRejectedValue({ response: { status: 403, data: { error: 'Not authorized' } } });
    renderScreen();
    expect(await screen.findByText('Chat opens for people who are going.')).toBeTruthy();
    expect(screen.getByLabelText('Send message').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByLabelText('Message').props.editable).toBe(false);
  });
});
