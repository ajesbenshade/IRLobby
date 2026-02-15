import { api } from './apiClient';

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

export const fetchConversations = async (): Promise<ConversationItem[]> => {
  const response = await api.get<ConversationItem[]>('/api/messages/conversations/');
  return response.data;
};

export const fetchConversationMessages = async (
  conversationId: number | string,
): Promise<ConversationMessage[]> => {
  const response = await api.get<ConversationMessage[]>(`/api/messages/conversations/${conversationId}/messages/`);
  return response.data;
};

export const sendConversationMessage = async (
  conversationId: number | string,
  message: string,
): Promise<ConversationMessage> => {
  const response = await api.post<ConversationMessage>(
    `/api/messages/conversations/${conversationId}/messages/`,
    { message },
  );
  return response.data;
};
