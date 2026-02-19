import { api } from './apiClient';
import { API_ROUTES, API_ROUTE_BUILDERS } from '@shared/schema';

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
  matchId?: number;
  activityId?: number | null;
  messages: ConversationMessage[];
  created_at: string;
}

export const fetchConversations = async (): Promise<ConversationItem[]> => {
  const response = await api.get<ConversationItem[]>(API_ROUTES.MESSAGES_CONVERSATIONS);
  return response.data;
};

export const fetchConversationMessages = async (
  conversationId: number | string,
): Promise<ConversationMessage[]> => {
  const response = await api.get<ConversationMessage[]>(
    API_ROUTE_BUILDERS.conversationMessages(conversationId),
  );
  return response.data;
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
