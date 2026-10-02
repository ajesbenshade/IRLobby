import { CHAT_GATE_MESSAGE, isChatGateError } from '@foyer/logic';
import type { MainStackParamList } from '@navigation/types';

export type GatheringChatParams = MainStackParamList['GatheringChat'];

export type StackNavigate = { navigate: (name: any, params?: any) => void };

/**
 * Open the per-gathering chat. Back from the chat always lands on the gathering: when the caller is not
 * already on that gathering (Gatherings list, push), the gathering is pushed first.
 */
export const openGatheringChat = (
  navigation: StackNavigate,
  params: GatheringChatParams,
  options: { fromGathering?: boolean } = {},
) => {
  if (!options.fromGathering) {
    navigation.navigate('GatheringDetail', { activityId: params.activityId });
  }
  navigation.navigate('GatheringChat', params);
};

const NOT_ENOUGH_PEOPLE = /not enough participants/i;

type ErrorShape = { response?: { status?: number; data?: unknown } } | undefined | null;

/** 403 -> "Chat opens for people who are going."; 400 "Not enough participants" -> chat-starts copy. */
export const gatheringChatErrorMessage = (
  error: unknown,
  fallback: string,
  copy: { notEnough: string },
): string => {
  const response = (error as ErrorShape)?.response;
  const data = response?.data as { error?: unknown; detail?: unknown } | undefined;
  const serverMessage =
    typeof data?.error === 'string' ? data.error : typeof data?.detail === 'string' ? data.detail : undefined;
  if (isChatGateError(response?.status, serverMessage)) {
    return CHAT_GATE_MESSAGE;
  }
  if (serverMessage && NOT_ENOUGH_PEOPLE.test(serverMessage)) {
    return copy.notEnough;
  }
  return fallback;
};

type NavState = {
  routes: Array<{ name: string; params?: any; state?: NavState }>;
  index?: number;
  [key: string]: unknown;
};

/**
 * Deep links such as `/gatherings/12/chat` would otherwise build a stack of just the chat. Put the
 * gathering underneath so Back returns to it. Walks nested navigator states.
 */
export const withGatheringBelowChat = <T extends NavState | undefined>(state: T): T => {
  if (!state) {
    return state;
  }
  const routes: NavState['routes'] = [];
  let changed = false;
  state.routes.forEach((route, position) => {
    const child = route.state ? withGatheringBelowChat(route.state) : route.state;
    const next = child === route.state ? route : { ...route, state: child };
    if (next !== route) {
      changed = true;
    }
    const activityId = next.params?.activityId;
    const previous = state.routes[position - 1];
    if (next.name === 'GatheringChat' && activityId != null && previous?.name !== 'GatheringDetail') {
      routes.push({ name: 'GatheringDetail', params: { activityId } });
      changed = true;
    }
    routes.push(next);
  });
  if (!changed) {
    return state;
  }
  const index = typeof state.index === 'number' ? state.index + (routes.length - state.routes.length) : state.index;
  return { ...state, routes, index } as T;
};
