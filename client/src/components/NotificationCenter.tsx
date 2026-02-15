import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiRequest } from '@/lib/queryClient';
import { API_ROUTES } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Bell } from 'lucide-react';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MatchItem {
  id: number;
  activity: string;
  created_at: string;
  user_a: string;
  user_b: string;
}

interface ConversationItem {
  id: number;
  match: string;
  created_at: string;
  messages: Array<{
    id: number;
    message: string;
    createdAt: string;
    user?: {
      firstName?: string;
      email?: string;
    };
  }>;
}

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

export default function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const { data: matches = [] } = useQuery<MatchItem[]>({
    queryKey: [API_ROUTES.MATCHES],
    queryFn: async () => {
      const response = await apiRequest('GET', API_ROUTES.MATCHES);
      return response.json();
    },
    enabled: isOpen,
  });

  const { data: conversations = [] } = useQuery<ConversationItem[]>({
    queryKey: [API_ROUTES.MESSAGES_CONVERSATIONS],
    queryFn: async () => {
      const response = await apiRequest('GET', API_ROUTES.MESSAGES_CONVERSATIONS);
      return response.json();
    },
    enabled: isOpen,
  });

  const notifications: NotificationItem[] = [
    ...matches.map((match) => ({
      id: `match-${match.id}`,
      title: 'New match confirmed',
      body: `${match.user_a} and ${match.user_b} matched for ${match.activity}.`,
      createdAt: match.created_at,
    })),
    ...conversations
      .map((conversation) => {
        const lastMessage = conversation.messages[conversation.messages.length - 1];
        if (!lastMessage) {
          return null;
        }

        const sender = lastMessage.user?.firstName || lastMessage.user?.email || 'Someone';

        return {
          id: `message-${conversation.id}-${lastMessage.id}`,
          title: `New message in ${conversation.match}`,
          body: `${sender}: ${lastMessage.message}`,
          createdAt: lastMessage.createdAt,
        };
      })
      .filter((item): item is NotificationItem => item !== null),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          {notifications.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No notifications yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div key={notification.id} className="rounded-md border p-3">
                  <p className="text-sm font-semibold">{notification.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{notification.body}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
