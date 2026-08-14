import { ChatSkeleton, PageState } from '@/components/AppState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { config } from '@/lib/config';
import { asArrayResponse, type PaginatedResponse } from '@/lib/paginated';
import { apiRequest } from '@/lib/queryClient';
import { API_ROUTES, API_ROUTE_BUILDERS } from '@shared/schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, MessageCircle, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

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

export default function Chat() {
  const navigate = useNavigate();
  const params = useParams<{ matchId: string }>();
  const matchId = Number(params.matchId);
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const queryClient = useQueryClient();
  const { token, user } = useAuth();

  const { data: conversations = [], isLoading: isLoadingConversations } = useQuery<
    ConversationItem[] | PaginatedResponse<ConversationItem>
  >({
    queryKey: [API_ROUTES.MESSAGES_CONVERSATIONS],
    queryFn: async () => {
      const response = await apiRequest('GET', API_ROUTES.MESSAGES_CONVERSATIONS);
      return response.json() as Promise<ConversationItem[] | PaginatedResponse<ConversationItem>>;
    },
    retry: 1,
  });

  const conversationItems = asArrayResponse(conversations);

  const selectedConversation = conversationItems.find(
    (conversation) => conversation.matchId === matchId,
  );

  const {
    data: messages = [],
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery<ConversationMessage[] | PaginatedResponse<ConversationMessage>>({
    queryKey: [API_ROUTES.MESSAGES_CONVERSATIONS, selectedConversation?.id, 'messages'],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        API_ROUTE_BUILDERS.conversationMessages(selectedConversation?.id ?? 0),
      );
      return response.json() as Promise<
        ConversationMessage[] | PaginatedResponse<ConversationMessage>
      >;
    },
    retry: 1,
    enabled: !!selectedConversation,
  });

  const messageItems = asArrayResponse(messages);

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
  }, [messageItems]);

  useEffect(() => {
    const conversationId = selectedConversation?.id;

    if (!conversationId || !token) {
      return;
    }

    let isCancelled = false;

    const connect = () => {
      if (isCancelled) {
        return;
      }

      const wsUrl = `${config.websocketUrl}/ws/chat/${conversationId}/?token=${encodeURIComponent(
        token,
      )}`;
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
  }, [queryClient, selectedConversation?.id, token]);

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

  const chatHeader = (
    <header className="flex items-center space-x-3 border-b border-border bg-background p-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/app/matches')}
        className="p-2"
        aria-label="Back to matches"
      >
        <ArrowLeft className="w-5 h-5" />
      </Button>
      <div className="flex-1">
        <h2 className="font-semibold text-foreground truncate">
          {selectedConversation?.match ?? 'Chat'}
        </h2>
        <p className="text-xs text-muted-foreground">
          Live conversations and messaging.
        </p>
      </div>
    </header>
  );

  if (isLoadingConversations) {
    return <ChatSkeleton header={chatHeader} />;
  }

  if (!selectedConversation) {
    return (
      <div className="flex h-screen flex-col bg-background">
        {chatHeader}
        <PageState
          icon={MessageCircle}
          title="Conversation not found"
          description="This chat may still be getting created, or the match is no longer available."
          actionLabel="Back to matches"
          onAction={() => navigate('/app/matches')}
          className="flex-1"
        />
      </div>
    );
  }

  if (isLoading) {
    return <ChatSkeleton header={chatHeader} />;
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {chatHeader}

      {error && (
        <div className="px-4 py-2 space-y-2">
          <p className="text-sm text-red-600 dark:text-red-300">Failed to load messages.</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void refetch()}
            disabled={isRefetching}
          >
            {isRefetching ? 'Retrying...' : 'Retry'}
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messageItems.length === 0 ? (
          <PageState
            icon={MessageCircle}
            title="No messages yet"
            description="Send a quick hello to start coordinating the plan."
            className="min-h-[45vh]"
          />
        ) : (
          messageItems.map((msg) => {
            const isOwn = user?.id != null && String(msg.userId) === String(user.id);
            const senderName = isOwn
              ? 'You'
              : msg.user?.firstName || 'Them';

            return (
              <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div className="flex items-end space-x-2 max-w-xs">
                  <div
                    className={`rounded-2xl px-4 py-2 ${
                      isOwn
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border bg-card text-foreground'
                    }`}
                  >
                    <p className="text-xs opacity-70 mb-1">{senderName}</p>
                    <p className="text-sm">{msg.message}</p>
                    <p className={`text-xs mt-1 ${isOwn ? 'opacity-70' : 'text-muted-foreground'}`}>
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

      <div className="border-t border-border bg-background/80 p-4 backdrop-blur">
        <div className="flex items-center space-x-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1"
            disabled={sendMessageMutation.isPending}
            aria-label="Message text"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || sendMessageMutation.isPending}
            size="sm"
            className="px-3"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
