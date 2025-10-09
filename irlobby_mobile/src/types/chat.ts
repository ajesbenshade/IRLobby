export interface ChatMessage {
  id: number | string;
  conversationId: number | string;
  message: string;
  createdAt: string;
  sender: {
    id: number | string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string | null;
  };
}

export interface Conversation {
  id: number | string;
  name?: string;
  lastMessage?: ChatMessage;
  unreadCount?: number;
  participantIds: Array<number | string>;
}
