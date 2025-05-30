import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Send } from "lucide-react";
import { format } from "date-fns";
import type { ChatMessage } from "@shared/schema";

interface ChatProps {
  activityId: number;
  onBack: () => void;
}

export default function Chat({ activityId, onBack }: ChatProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['/api/activities', activityId, 'chat'],
    retry: 1,
  });

  const { data: activity } = useQuery({
    queryKey: ['/api/activities', activityId],
    retry: 1,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageText: string) => {
      const response = await apiRequest('POST', `/api/activities/${activityId}/chat`, {
        message: messageText,
      });
      return response.json();
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ 
        queryKey: ['/api/activities', activityId, 'chat'] 
      });
    },
  });

  const { sendMessage: sendWebSocketMessage } = useWebSocket({
    onMessage: (wsMessage) => {
      if (wsMessage.type === 'new_message') {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/activities', activityId, 'chat'] 
        });
      }
    },
  });

  useEffect(() => {
    if (user) {
      sendWebSocketMessage({
        type: 'join_activity',
        activityId,
        userId: user.id,
      });
    }
  }, [activityId, user, sendWebSocketMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 p-4 flex items-center space-x-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="p-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2 className="font-semibold text-gray-800 truncate">
            {activity?.title || 'Activity Chat'}
          </h2>
          <p className="text-sm text-gray-500">
            {activity?.currentParticipants || 0} participants
          </p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg: any) => {
            const isOwnMessage = msg.senderId === user?.id;
            const senderInitials = msg.sender?.firstName && msg.sender?.lastName
              ? `${msg.sender.firstName.charAt(0)}${msg.sender.lastName.charAt(0)}`
              : msg.sender?.email?.charAt(0) || 'U';

            return (
              <div
                key={msg.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-end space-x-2 max-w-xs ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  {!isOwnMessage && (
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={msg.sender?.profileImageUrl} />
                      <AvatarFallback className="text-xs">
                        {senderInitials}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  
                  <div className={`rounded-2xl px-4 py-2 ${
                    isOwnMessage 
                      ? 'bg-primary text-white' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {!isOwnMessage && (
                      <p className="text-xs opacity-70 mb-1">
                        {msg.sender?.firstName || msg.sender?.email?.split('@')[0] || 'User'}
                      </p>
                    )}
                    <p className="text-sm">{msg.message}</p>
                    <p className={`text-xs mt-1 ${
                      isOwnMessage ? 'text-white/70' : 'text-gray-500'
                    }`}>
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

      {/* Message Input */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center space-x-2">
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
