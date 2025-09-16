import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Send } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface ChatWindowProps {
  chatRoomId: string; // This is actually the activityId
  onClose: () => void;
}

export function ChatWindow({ chatRoomId, onClose }: ChatWindowProps) {
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Correct query key to match server route
  const { data: messages = [], isLoading, error } = useQuery({
    queryKey: [`/api/activities/${chatRoomId}/chat`],
    queryFn: async () => {
      console.log(`Fetching chat messages for activity: ${chatRoomId}`);
      try {
        const response = await fetch(`/api/activities/${chatRoomId}/chat`, {
          credentials: 'include',  // Use cookies instead of localStorage token
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch chat messages: ${errorText}`);
        }
        
        const data = await response.json();
        console.log(`Fetched ${data.length} chat messages`);
        return data;
      } catch (err) {
        console.error('Error fetching chat messages:', err);
        throw err;
      }
    }
  });

  // Log any errors
  useEffect(() => {
    if (error) {
      console.error('Chat messages fetch error:', error);
    }
  }, [error]);

  const { isConnected, sendMessage: sendWebSocketMessage } = useWebSocket({
    onOpen: () => {
      console.log('WebSocket connected, joining activity chat');
      // Join the activity chat room
      if (user) {
        sendWebSocketMessage({
          type: 'join_activity',
          activityId: parseInt(chatRoomId),
          userId: user.id
        });
      }
    },
    onMessage: (newMessage) => {
      console.log('WebSocket message received:', newMessage);
      if (newMessage.type === 'chat_message' && newMessage.activityId === parseInt(chatRoomId)) {
        console.log('New chat message received, updating cache');
        // Add new message to the cache
        queryClient.setQueryData(
          [`/api/activities/${chatRoomId}/chat`],
          (oldMessages: any[] = []) => {
            // Check if message already exists to avoid duplicates
            const exists = oldMessages.some(m => m.id === newMessage.data.id);
            if (exists) return oldMessages;
            return [...oldMessages, newMessage.data];
          }
        );
      }
    }
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageText: string) => {
      console.log(`Sending message to activity ${chatRoomId}: ${messageText}`);
      
      // Send via WebSocket for real-time updates
      sendWebSocketMessage({
        type: 'send_message',
        activityId: parseInt(chatRoomId),
        message: messageText
      });
      
      // Also send via HTTP to ensure it's saved to database
      return await apiRequest(
        'POST', 
        `/api/activities/${chatRoomId}/chat`, 
        {
          message: messageText,
          messageType: "text",
        }
      );
    },
    onSuccess: () => {
      console.log('Message sent successfully');
      setMessage("");
      scrollToBottom();
    },
    onError: (error) => {
      console.error('Failed to send message:', error);
    }
  });

  const handleSendMessage = () => {
    if (!message.trim()) return;
    sendMessageMutation.mutate(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm p-4 flex items-center">
        <Button onClick={onClose} variant="ghost" size="icon" className="mr-3">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-800">Activity Chat</h2>
          <div className="flex items-center text-sm text-gray-500">
            <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
            {isConnected ? 'Connected' : 'Connecting...'}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!messages || messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg: any) => {
            const isOwn = msg.userId === user?.id;
            const userName = msg.user?.firstName || msg.user?.email?.split('@')[0] || 'User';
            
            return (
              <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs ${isOwn ? 'order-last' : 'order-first'}`}>
                  {!isOwn && (
                    <p className="text-xs text-gray-500 mb-1 px-3">{userName}</p>
                  )}
                  <Card className={`${isOwn ? 'bg-primary text-white' : 'bg-white'}`}>
                    <CardContent className="p-3">
                      <p className="text-sm">{msg.message}</p>
                      <p className={`text-xs mt-1 ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
                        {format(new Date(msg.createdAt), "h:mm a")}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="bg-white border-t p-4">
        <div className="flex space-x-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1"
            disabled={sendMessageMutation.isPending}
          />
          <Button 
            onClick={handleSendMessage}
            disabled={!message.trim() || sendMessageMutation.isPending}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
