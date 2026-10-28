import { DiscoverSheet } from '@/components/DiscoverSheet';
import { Button } from '@/components/ui/button';
import { buildNotificationItems } from '@/lib/notificationsInbox';
import { apiRequest } from '@/lib/queryClient';
import { API_ROUTES } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Bell, ChevronLeft } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

function relativeTime(value: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    return null;
  }

  return formatDistanceToNow(date, { addSuffix: true });
}

export default function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const matchesQuery = useQuery({
    queryKey: [API_ROUTES.MATCHES, 'discover-inbox'],
    queryFn: async () => {
      const response = await apiRequest('GET', API_ROUTES.MATCHES);
      return response.json() as Promise<unknown>;
    },
    enabled: isOpen,
    retry: 1,
  });

  const conversationsQuery = useQuery({
    queryKey: [API_ROUTES.MESSAGES_CONVERSATIONS, 'discover-inbox'],
    queryFn: async () => {
      const response = await apiRequest('GET', API_ROUTES.MESSAGES_CONVERSATIONS);
      return response.json() as Promise<unknown>;
    },
    enabled: isOpen,
    retry: 1,
  });

  const notifications = useMemo(
    () => buildNotificationItems(matchesQuery.data, conversationsQuery.data),
    [conversationsQuery.data, matchesQuery.data],
  );

  const isLoading = matchesQuery.isLoading || conversationsQuery.isLoading;
  const failed = matchesQuery.isError || conversationsQuery.isError;
  const isRefetching = matchesQuery.isRefetching || conversationsQuery.isRefetching;

  return (
    <DiscoverSheet
      open={isOpen}
      onClose={onClose}
      testId="discover-notifications-sheet"
      title={
        <span className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Notifications
        </span>
      }
      description="Catch up on your gatherings and chats in one place."
      leading={
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 text-sm font-semibold text-[#a2033f]"
          aria-label="Back to Discover"
        >
          <ChevronLeft className="h-5 w-5" />
          Discover
        </button>
      }
    >
      {failed ? (
        <div className="mb-4 space-y-3 rounded-2xl border border-border/70 p-4">
          <p className="text-sm font-medium">Some notifications did not load</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void matchesQuery.refetch();
              void conversationsQuery.refetch();
            }}
            disabled={isRefetching}
          >
            {isRefetching ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      ) : null}

      {isLoading && notifications.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading notifications</p>
      ) : null}

      {!isLoading && !failed && notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
          <Bell className="h-8 w-8 text-primary" />
          <p className="text-sm font-medium">No notifications yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            When a gathering is confirmed or a chat gets a new message, the update will appear here.
          </p>
        </div>
      ) : null}

      {notifications.length > 0 ? (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const when = relativeTime(notification.createdAt);
            const body = (
              <>
                <p className="text-sm font-semibold text-foreground">{notification.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
                {when ? <p className="mt-2 text-xs text-muted-foreground">{when}</p> : null}
              </>
            );
            const className =
              'block rounded-2xl border border-border/70 p-3 transition-colors hover:bg-[#f9e8ee]/60';

            return notification.href ? (
              <Link
                key={notification.id}
                to={notification.href}
                className={className}
                onClick={onClose}
              >
                {body}
              </Link>
            ) : (
              <div key={notification.id} className={className}>
                {body}
              </div>
            );
          })}
        </div>
      ) : null}
    </DiscoverSheet>
  );
}
