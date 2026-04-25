import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/queryClient';
import { API_ROUTES } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Bell, MessageCircle, RefreshCw, Users } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

interface MatchItem {
  id: number;
  activity?: string;
  user_a?: string;
  user_b?: string;
  created_at: string;
}

interface ConversationMessage {
  id: number;
  user?: {
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
  messages: ConversationMessage[];
}

interface NotificationItem {
  id: string;
  type: 'match' | 'message';
  title: string;
  body: string;
  createdAt: string;
  href: string;
}

function relativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return formatDistanceToNow(date, { addSuffix: true });
}

export default function NotificationsPage() {
  const {
    data: matches = [],
    isLoading: matchesLoading,
    error: matchesError,
    refetch: refetchMatches,
    isRefetching: matchesRefetching,
  } = useQuery<MatchItem[]>({
    queryKey: [API_ROUTES.MATCHES, 'notifications'],
    queryFn: async () => {
      const response = await apiRequest('GET', API_ROUTES.MATCHES);
      return (await response.json()) as MatchItem[];
    },
    retry: 1,
  });

  const {
    data: conversations = [],
    isLoading: conversationsLoading,
    error: conversationsError,
    refetch: refetchConversations,
    isRefetching: conversationsRefetching,
  } = useQuery<ConversationItem[]>({
    queryKey: [API_ROUTES.MESSAGES_CONVERSATIONS, 'notifications'],
    queryFn: async () => {
      const response = await apiRequest('GET', API_ROUTES.MESSAGES_CONVERSATIONS);
      return (await response.json()) as ConversationItem[];
    },
    retry: 1,
  });

  const notifications = useMemo<NotificationItem[]>(() => {
    const matchItems = matches.map<NotificationItem>((match) => ({
      id: `match-${match.id}`,
      type: 'match',
      title: 'New match confirmed',
      body: `${match.user_a ?? 'Someone'} and ${match.user_b ?? 'someone'} matched${
        match.activity ? ` for ${match.activity}` : ''
      }.`,
      createdAt: match.created_at,
      href: '/app/connections',
    }));

    const messageItems = conversations.flatMap<NotificationItem>((conversation) => {
      const lastMessage = conversation.messages?.[conversation.messages.length - 1];
      if (!lastMessage) {
        return [];
      }

      const sender =
        lastMessage.user?.firstName || lastMessage.user?.email?.split('@')[0] || 'Someone';

      return [
        {
          id: `message-${conversation.id}-${lastMessage.id}`,
          type: 'message',
          title: `New message in ${conversation.match}`,
          body: `${sender}: ${lastMessage.message}`,
          createdAt: lastMessage.createdAt,
          href: `/app/matches/${conversation.matchId}/chat`,
        },
      ];
    });

    return [...messageItems, ...matchItems].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
  }, [conversations, matches]);

  const error = matchesError ?? conversationsError;
  const isLoading = matchesLoading || conversationsLoading;
  const isRefetching = matchesRefetching || conversationsRefetching;
  const latest = notifications[0];
  const messageNotifications = notifications.filter((item) => item.type === 'message');
  const matchNotifications = notifications.filter((item) => item.type === 'match');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Catch up on matches and active conversations in one place.
        </p>
      </div>

      {latest ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-primary" />
              Latest update
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="font-medium">{latest.title}</p>
              <Badge variant="secondary">{latest.type === 'message' ? 'Message' : 'Match'}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{latest.body}</p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {relativeTime(latest.createdAt)}
              </span>
              <Button asChild size="sm" variant="outline">
                <Link to={latest.href}>Open</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card>
          <CardContent className="space-y-3 py-6">
            <p className="text-sm font-medium">Some notifications did not load</p>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : 'Unable to load notifications.'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void refetchMatches();
                void refetchConversations();
              }}
              disabled={isRefetching}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {isRefetching ? 'Refreshing...' : 'Refresh feed'}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="space-y-3 p-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {!isLoading && notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Bell className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No notifications yet</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              When a match lands or a conversation gets a new message, the update will appear here.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {messageNotifications.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-4 w-4 text-primary" />
              Conversation updates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {messageNotifications.map((item) => (
              <Link
                key={item.id}
                to={item.href}
                className="block rounded-lg border p-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{item.title}</p>
                  <Badge variant="outline">Message</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">{relativeTime(item.createdAt)}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {matchNotifications.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Match updates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {matchNotifications.map((item) => (
              <Link
                key={item.id}
                to={item.href}
                className="block rounded-lg border p-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{item.title}</p>
                  <Badge variant="secondary">Match</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">{relativeTime(item.createdAt)}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
