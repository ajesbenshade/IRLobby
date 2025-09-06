import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Send, Users } from "lucide-react";
import { format } from "date-fns";
import type { ChatMessage } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import UserProfileModal from "@/components/UserProfileModal";

interface ChatProps {
  activityId: number;
  onBack: () => void;
}

export default function Chat({ activityId, onBack }: ChatProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isUserProfileModalOpen, setIsUserProfileModalOpen] = useState(false);

  const openUserProfile = (userId: string) => {
    setSelectedUserId(userId);
    setIsUserProfileModalOpen(true);
  };

  const closeUserProfile = () => {
    setIsUserProfileModalOpen(false);
    setSelectedUserId(null);
  };

  // Fetch messages with proper error handling
  const { data: messages = [], isLoading, error } = useQuery({
    queryKey: ['/api/activities', activityId, 'chat'],
    queryFn: async () => {
      console.log(`Fetching chat messages for activity: ${activityId}`);
      try {
        const response = await apiRequest('GET', `/api/activities/${activityId}/chat`);
        const data = await response.json();
        console.log(`Fetched ${data.length} chat messages`);
        return data;
      } catch (err) {
        console.error('Error fetching chat messages:', err);
        throw err;
      }
    },
    retry: 1,
  });

  useEffect(() => {
    if (error) {
      console.error('Chat messages fetch error:', error);
    }
  }, [error]);

  const { data: activity, isLoading: isActivityLoading } = useQuery({
    queryKey: ['/api/activities', activityId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/activities/${activityId}`);
      return response.json();
    },
    retry: 1,
  });

  // Fetch participants for this activity
  const { data: participants = [], isLoading: isParticipantsLoading } = useQuery({
    queryKey: ['/api/activities', activityId, 'participants'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/activities/${activityId}/participants`);
        return response.json();
      } catch (err) {
        console.error('Error fetching participants:', err);
        throw err;
      }
    },
    retry: 1,
    enabled: !!activityId,
  });

  const sendFriendRequest = async (userId: string) => {
    try {
      // Call API to send friend request
      console.log(`Sending friend request to user ${userId}`);
      const response = await apiRequest('POST', '/api/friends/request', { 
        receiverId: userId 
      });
      return response.json();
    } catch (error) {
      console.error('Failed to send friend request:', error);
    }
  };

  const sendMessageMutation = useMutation({
    mutationFn: async (messageText: string) => {
      console.log(`Sending message to activity ${activityId}: ${messageText}`);
      const response = await apiRequest('POST', `/api/activities/${activityId}/chat`, {
        message: messageText,
      });
      return response.json();
    },
    onSuccess: (data) => {
      console.log('Message sent successfully:', data);
      setMessage("");
      queryClient.invalidateQueries({ 
        queryKey: ['/api/activities', activityId, 'chat'] 
      });
    },
    onError: (error) => {
      console.error('Failed to send message:', error);
    }
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
        <Button 
          variant="outline" 
          size="sm" 
          className="flex items-center gap-1"
          onClick={() => setIsParticipantsModalOpen(true)}
        >
          <Users className="w-4 h-4" />
          <span>Participants</span>
        </Button>
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
                    <Avatar 
                      className="w-8 h-8 cursor-pointer" 
                      onClick={() => openUserProfile(msg.senderId)}
                    >
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
                      <p 
                        className="text-xs opacity-70 mb-1 cursor-pointer hover:underline" 
                        onClick={() => openUserProfile(msg.senderId)}
                      >
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

      {/* Participants Modal */}
      <Dialog open={isParticipantsModalOpen} onOpenChange={setIsParticipantsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Participants</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isParticipantsLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : participants.length === 0 ? (
              <p className="text-center text-gray-500">No participants found</p>
            ) : (
              participants.map((participant: any) => (
                <div key={participant.id} className="flex items-center space-x-4">
                  <Avatar 
                    className="cursor-pointer" 
                    onClick={() => openUserProfile(participant.id)}
                  >
                    <AvatarImage src={participant.profileImageUrl} alt={participant.firstName} />
                    <AvatarFallback>
                      {participant.firstName?.[0] || participant.email?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 
                        className="text-sm font-medium text-gray-900 cursor-pointer hover:underline"
                        onClick={() => openUserProfile(participant.id)}
                      >
                        {participant.firstName} {participant.lastName}
                      </h4>
                      {participant.isHost && (
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">Host</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{participant.email}</p>
                  </div>
                  {user?.id !== participant.id && (
                    <Button onClick={() => sendFriendRequest(participant.id)} size="sm">
                      Add Friend
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* User Profile Modal */}
      {selectedUserId && (
        <UserProfileModal
          isOpen={isUserProfileModalOpen}
          onClose={closeUserProfile}
          userId={selectedUserId}
          onSendFriendRequest={user?.id !== selectedUserId ? () => sendFriendRequest(selectedUserId) : undefined}
        />
      )}
    </div>
  );
}
