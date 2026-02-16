import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/queryClient';
import { API_ROUTES, API_ROUTE_BUILDERS } from '@shared/schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface ChatProps {
  matchId: number;
  onBack: () => void;
}

interface ConversationMessage {
  id: number;
  userId: number;
  user?: {
    id: number;
    firstName?: string;
    email?: string;
  };
  message: string;
  createdAt: string;
}

interface ConversationItem {
  id: number;
  match: string;
  matchId: number;
  activityId?: number | null;
  messages: ConversationMessage[];
  created_at: string;
}

export default function Chat({ matchId, onBack }: ChatProps) {
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const queryClient = useQueryClient();

  const { data: conversations = [], isLoading: isLoadingConversations } = useQuery<ConversationItem[]>({
    queryKey: [API_ROUTES.MESSAGES_CONVERSATIONS],
    queryFn: async () => {
      const response = await apiRequest('GET', API_ROUTES.MESSAGES_CONVERSATIONS);
      return response.json();
    },
    retry: 1,
  });

  const selectedConversation = conversations.find((conversation) => conversation.matchId === matchId);

  const {
    data: messages = [],
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery<ConversationMessage[]>({
    queryKey: [API_ROUTES.MESSAGES_CONVERSATIONS, selectedConversation?.id, 'messages'],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        API_ROUTE_BUILDERS.conversationMessages(selectedConversation?.id ?? 0),
      );
      return response.json();
    },
    retry: 1,
    enabled: !!selectedConversation,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageText: string) => {
      if (!selectedConversation) {
        throw new Error('No conversation selected.');
      }

      const response = await apiRequest(
        'POST',
        API_ROUTE_BUILDERS.conversationMessages(selectedConversation.id),
        {
          message: messageText,
        },
      );
      return response.json();
    },
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({
        queryKey: [API_ROUTES.MESSAGES_CONVERSATIONS, selectedConversation?.id, 'messages'],
      });
      queryClient.invalidateQueries({
        queryKey: [API_ROUTES.MESSAGES_CONVERSATIONS],
      });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const conversationId = selectedConversation?.id;
    const token = localStorage.getItem('authToken');

    if (!conversationId || !token) {
      return;
    }

    const configuredApiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
    const websocketBaseUrl = configuredApiBase
      ? configuredApiBase.replace(/^https?:\/\//, (prefix) =>
          prefix === 'https://' ? 'wss://' : 'ws://',
        )
      : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

    let isCancelled = false;

    const connect = () => {
      if (isCancelled) {
        return;
      }

      const wsUrl = `${websocketBaseUrl}/ws/chat/${conversationId}/?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);
      websocketRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as {
            type?: string;
            conversationId?: number;
          };

          if (payload.type === 'chat.message' && payload.conversationId === conversationId) {
            queryClient.invalidateQueries({
              queryKey: [API_ROUTES.MESSAGES_CONVERSATIONS, conversationId, 'messages'],
            });
            queryClient.invalidateQueries({ queryKey: [API_ROUTES.MESSAGES_CONVERSATIONS] });
          }
        } catch {
          // no-op: ignore malformed websocket payloads
        }
      };

      ws.onclose = () => {
        if (isCancelled) {
          return;
        }

        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, 3000);
      };
    };

    connect();

    return () => {
      isCancelled = true;
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      websocketRef.current?.close();
      websocketRef.current = null;
    };
  }, [queryClient, selectedConversation?.id]);

  const handleSendMessage = () => {
    if (message.trim()) {
      sendMessageMutation.mutate(message.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isLoadingConversations) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!selectedConversation) {
    return (
      <div className="flex flex-col h-screen bg-white">
        <header className="bg-white border-b border-gray-200 p-4 flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-800 truncate">Chat</h2>
            <p className="text-xs text-gray-500">Live conversations and messaging.</p>
          </div>
        </header>
        <div className="flex items-center justify-center flex-1 p-6 text-center">
          <p className="text-gray-500">Conversation not found for this match.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="bg-white border-b border-gray-200 p-4 flex items-center space-x-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="p-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2 className="font-semibold text-gray-800 truncate">{selectedConversation.match}</h2>
          <p className="text-xs text-gray-500">Live conversations and messaging.</p>
        </div>
      </header>

      {error && (
        <div className="px-4 py-2 space-y-2">
          <p className="text-sm text-red-600">Failed to load messages.</p>
          <Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isRefetching}>
            {isRefetching ? 'Retrying...' : 'Retry'}
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No messages yet.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const senderName = msg.user?.firstName || msg.user?.email?.split('@')[0] || 'User';

            return (
              <div key={msg.id} className="flex justify-start">
                <div className="flex items-end space-x-2 max-w-xs">
                  <div className="rounded-2xl px-4 py-2 bg-gray-100 text-gray-800">
                    <p className="text-xs opacity-70 mb-1">{senderName}</p>
                    <p className="text-sm">{msg.message}</p>
                    <p className="text-xs mt-1 text-gray-500">
                      {format(new Date(msg.createdAt), 'h:mm a')}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center space-x-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1"
            disabled={sendMessageMutation.isPending}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || sendMessageMutation.isPending}
            size="sm"
            className="px-3"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
