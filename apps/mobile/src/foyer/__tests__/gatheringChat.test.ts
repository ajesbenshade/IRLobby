import { getStateFromPath } from '@react-navigation/native';

import { messagePushTarget } from '@services/pushNotificationNavigation';
import { gatheringChatErrorMessage, openGatheringChat, withGatheringBelowChat } from '../gatheringChat';
import { CHAT_GATE_MESSAGE } from '../logic';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(),
}));

describe('openGatheringChat', () => {
  it('from the Gatherings list: pushes the gathering, then its chat, so Back returns to the gathering', () => {
    const navigate = jest.fn();
    openGatheringChat({ navigate }, { activityId: 12, title: 'Game Night' });
    expect(navigate.mock.calls).toEqual([
      ['GatheringDetail', { activityId: 12 }],
      ['GatheringChat', { activityId: 12, title: 'Game Night' }],
    ]);
  });

  it('from the gathering itself: just opens the chat', () => {
    const navigate = jest.fn();
    openGatheringChat({ navigate }, { activityId: 12 }, { fromGathering: true });
    expect(navigate.mock.calls).toEqual([['GatheringChat', { activityId: 12 }]]);
  });
});

describe('gatheringChatErrorMessage', () => {
  const copy = { notEnough: 'Chat starts once at least two people are going.' };
  it('maps 403 / "Not authorized" to the going-only message', () => {
    expect(gatheringChatErrorMessage({ response: { status: 403, data: { error: 'Not authorized' } } }, 'x', copy)).toBe(CHAT_GATE_MESSAGE);
  });
  it('maps "Not enough participants" to the chat-starts copy', () => {
    expect(
      gatheringChatErrorMessage({ response: { status: 400, data: { error: 'Not enough participants to start chat' } } }, 'x', copy),
    ).toBe(copy.notEnough);
  });
  it('falls back otherwise', () => {
    expect(gatheringChatErrorMessage(new Error('boom'), 'fallback', copy)).toBe('fallback');
  });
});

describe('deep link /gatherings/:activityId/chat', () => {
  const config = {
    screens: {
      Main: {
        screens: {
          Tabs: { screens: { Discover: 'discover', Activity: 'activity', Create: 'create', Profile: 'profile' } },
          GatheringDetail: 'gatherings/:activityId',
          GatheringChat: 'gatherings/:activityId/chat',
        },
      },
    },
  };
  const parse = (path: string) => withGatheringBelowChat(getStateFromPath(path, config as never) as never) as any;

  it('puts the gathering under the chat so Back returns to it', () => {
    const state = parse('/gatherings/12/chat');
    const stack = state.routes[0].state;
    expect(stack.routes.map((route: any) => route.name)).toEqual(['GatheringDetail', 'GatheringChat']);
    expect(stack.routes[0].params).toEqual({ activityId: '12' });
    expect(stack.routes[1].params).toEqual({ activityId: '12' });
    expect(stack.index ?? stack.routes.length - 1).toBe(1); // partial state: last route is focused
  });

  it('leaves other links alone', () => {
    const state = parse('/gatherings/12');
    expect(state.routes[0].state.routes.map((route: any) => route.name)).toEqual(['GatheringDetail']);
    const tabs = parse('/discover');
    expect(tabs.routes[0].state.routes[0].name).toBe('Tabs');
  });

  it('does not double-insert when the gathering is already underneath', () => {
    const state = {
      routes: [{ name: 'GatheringDetail', params: { activityId: 1 } }, { name: 'GatheringChat', params: { activityId: 1 } }],
      index: 1,
    };
    expect(withGatheringBelowChat(state)).toBe(state);
  });
});

describe('message push routing', () => {
  it('gathering message -> that gathering chat (not the hidden Chat tab)', () => {
    expect(messagePushTarget({ type: 'new_message', activityId: 7, conversationId: 3 })).toEqual({
      screen: 'GatheringChat',
      params: { activityId: 7, conversationId: 3 },
    });
  });
  it('friend (1:1) message -> DirectChat', () => {
    expect(messagePushTarget({ type: 'new_message', activityId: null, conversationId: 9 })).toEqual({
      screen: 'DirectChat',
      params: { conversationId: 9 },
    });
  });
  it('nothing to open without ids', () => {
    expect(messagePushTarget({ type: 'new_message' })).toBeNull();
  });
});
