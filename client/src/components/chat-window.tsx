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
  chatRoomId: string;
  onClose: () => void;
}

export function ChatWindow({ chatRoomId, onClose }: ChatWindowProps) {
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useQuery({
    queryKey: [`/api/activities/${chatRoomId}/chat`],
  });

  const { isConnected } = useWebSocket({
    onMessage: (newMessage) => {
      if (newMessage.type === 'chat_message' && newMessage.activityId === chatRoomId) {
        // Add new message to the cache
        queryClient.setQueryData(
          [`/api/activities/${chatRoomId}/chat`],
          (oldMessages: any[]) => {
            if (!oldMessages) return [newMessage.data];
            return [...oldMessages, newMessage.data];
          }
        );
      }
    }
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageText: string) => {
      return await apiRequest(`/api/activities/${chatRoomId}/chat`, {
        method: 'POST',
        body: JSON.stringify({
          message: messageText,
          messageType: "text",
        })
      });
    },
    onSuccess: () => {
      setMessage("");
      scrollToBottom();
    },
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
