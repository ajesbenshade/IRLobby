import { asArrayResponse, type PaginatedResponse } from '@/lib/paginated';

export interface InboxNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  href?: string;
}

type MatchLike = {
  id?: number | string;
  activity?: string | null;
  created_at?: string | null;
};

type MessageLike = {
  id?: number | string;
  message?: string | null;
  createdAt?: string | null;
  user?: {
    firstName?: string | null;
    email?: string | null;
  } | null;
};

type ConversationLike = {
  id?: number | string;
  match?: string | null;
  matchId?: number | string | null;
  messages?: MessageLike[] | PaginatedResponse<MessageLike> | null;
};

function readList<T>(value: unknown): T[] {
  return asArrayResponse(value as T[] | PaginatedResponse<T> | null | undefined);
}

/**
 * Matches and conversations are paginated (`{ results }`) on the API.
 * Treating that object as an array throws in render and trips the app ErrorBoundary.
 */
export function buildNotificationItems(
  matches: unknown,
  conversations: unknown,
): InboxNotification[] {
  const matchItems = readList<MatchLike>(matches).flatMap((match) => {
    if (match == null || match.id == null) {
      return [];
    }

    return [
      {
        id: `match-${match.id}`,
        title: "You're confirmed",
        body: match.activity ? `You're going to ${match.activity}.` : "You're going.",
        createdAt: match.created_at ?? '',
        href: '/app/gatherings',
      },
    ];
  });

  const messageItems = readList<ConversationLike>(conversations).flatMap((conversation) => {
    if (conversation == null || conversation.id == null) {
      return [];
    }

    const messages = readList<MessageLike>(conversation.messages);
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.id == null) {
      return [];
    }

    const sender =
      lastMessage.user?.firstName || lastMessage.user?.email?.split('@')[0] || 'Someone';
    const href =
      conversation.matchId != null ? `/app/gatherings/${conversation.matchId}/chat` : undefined;

    return [
      {
        id: `message-${conversation.id}-${lastMessage.id}`,
        title: conversation.match ? `New message in ${conversation.match}` : 'New message',
        body: `${sender}: ${lastMessage.message ?? ''}`,
        createdAt: lastMessage.createdAt ?? '',
        href,
      },
    ];
  });

  return [...messageItems, ...matchItems].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();
    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
  });
}
