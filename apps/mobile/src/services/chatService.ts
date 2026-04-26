import { api } from './apiClient';
import { API_ROUTES, API_ROUTE_BUILDERS } from '@shared/schema';
import { captureException } from '../lib/monitoring';

export interface ConversationMessage {
  id: number;
  userId: number;
  user: {
    id: number;
    firstName?: string;
    email?: string;
  };
  message: string;
  createdAt: string;
}

export interface ConversationItem {
  id: number;
  match: string;
  messages: ConversationMessage[];
  created_at: string;
}

type ChatApiUser = {
  id?: number | string | null;
  firstName?: string | null;
  first_name?: string | null;
  email?: string | null;
  username?: string | null;
};

type ChatApiMessage = {
  id?: number | string | null;
  userId?: number | string | null;
  user_id?: number | string | null;
  sender?: number | string | null;
  user?: ChatApiUser | null;
  sender_username?: string | null;
  message?: string | null;
  text?: string | null;
  body?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
};

type ChatApiConversation = {
  id?: number | string | null;
  match?: string | null;
  activity?: string | null;
  title?: string | null;
  name?: string | null;
  messages?: ChatApiMessage[] | null;
  latest_message?: ChatApiMessage | null;
  last_message?: ChatApiMessage | null;
  created_at?: string | null;
  createdAt?: string | null;
};

const asNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

const asString = (value: unknown, fallback = ''): string => (
  typeof value === 'string' ? value : fallback
);

const normalizeMessageUser = (message: ChatApiMessage): ConversationMessage['user'] => {
  const rawUser = message.user;
  const resolvedId = rawUser?.id ?? message.userId ?? message.user_id ?? message.sender;

  return {
    id: asNumber(resolvedId),
    firstName: rawUser?.firstName ?? rawUser?.first_name ?? undefined,
    email: rawUser?.email ?? rawUser?.username ?? message.sender_username ?? undefined,
  };
};

const normalizeMessage = (message: ChatApiMessage): ConversationMessage => ({
  id: asNumber(message.id),
  userId: asNumber(message.userId ?? message.user_id ?? message.sender),
  user: normalizeMessageUser(message),
  message: asString(message.message ?? message.text ?? message.body),
  createdAt: asString(message.createdAt ?? message.created_at),
});

const normalizeMessages = (value: unknown): ConversationMessage[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is ChatApiMessage => Boolean(item) && typeof item === 'object')
    .map(normalizeMessage);
};

const resolveConversationMessages = (conversation: ChatApiConversation): ConversationMessage[] => {
  const normalizedMessages = normalizeMessages(conversation.messages);
  if (normalizedMessages.length > 0) {
    return normalizedMessages;
  }

  const fallbackMessage = conversation.latest_message ?? conversation.last_message;
  return fallbackMessage ? [normalizeMessage(fallbackMessage)] : [];
};

const normalizeConversation = (conversation: ChatApiConversation): ConversationItem => ({
  id: asNumber(conversation.id),
  match: asString(
    conversation.match ?? conversation.activity ?? conversation.title ?? conversation.name,
    'Conversation',
  ),
  messages: resolveConversationMessages(conversation),
  created_at: asString(conversation.created_at ?? conversation.createdAt),
});

const pickConversationArray = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const candidates = [
      (payload as { conversations?: unknown }).conversations,
      (payload as { results?: unknown }).results,
      (payload as { data?: unknown }).data,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate;
      }
    }
  }

  return [];
};

const reportUnexpectedPayload = (kind: 'conversations' | 'messages', payload: unknown) => {
  captureException(new Error(`Unexpected ${kind} payload shape`), {
    kind,
    isArray: Array.isArray(payload),
    payloadType: typeof payload,
    keys:
      payload && typeof payload === 'object'
        ? Object.keys(payload as Record<string, unknown>).slice(0, 10)
        : [],
  });
};

export const fetchConversations = async (): Promise<ConversationItem[]> => {
  const response = await api.get<ConversationItem[]>(API_ROUTES.MESSAGES_CONVERSATIONS);
  const conversations = pickConversationArray(response.data);

  if (!Array.isArray(response.data) && conversations.length === 0 && response.data != null) {
    reportUnexpectedPayload('conversations', response.data);
  }

  return conversations
    .filter((item): item is ChatApiConversation => Boolean(item) && typeof item === 'object')
    .map(normalizeConversation);
};

export const fetchConversationMessages = async (
  conversationId: number | string,
): Promise<ConversationMessage[]> => {
  const response = await api.get<ConversationMessage[]>(
    API_ROUTE_BUILDERS.conversationMessages(conversationId),
  );

  if (!Array.isArray(response.data) && response.data != null) {
    reportUnexpectedPayload('messages', response.data);
  }

  return normalizeMessages(response.data);
};

export const sendConversationMessage = async (
  conversationId: number | string,
  message: string,
): Promise<ConversationMessage> => {
  const response = await api.post<ConversationMessage>(
    API_ROUTE_BUILDERS.conversationMessages(conversationId),
    { message },
  );
  return response.data;
};
