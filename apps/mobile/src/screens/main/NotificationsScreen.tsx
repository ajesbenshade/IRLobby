import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';

import {
  AccentPill,
  AppScrollView,
  EmptyStatePanel,
  PageHeader,
  PanelCard,
  SectionIntro,
} from '@components/AppChrome';
import { RefreshControl, Text as NativeText, View } from '@components/RNCompat';
import { NotificationRowSkeleton } from '@components/skeletons';
import { fetchConversations } from '@services/chatService';
import { fetchMatches } from '@services/matchService';
import { appColors, radii, spacing } from '@theme/index';
import { getErrorMessage } from '@utils/error';

type NotificationType = 'match' | 'message';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  type: NotificationType;
}

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const NotificationsScreen = () => {
  const {
    data: matches = [],
    error: matchesError,
    isLoading: matchesLoading,
    isRefetching: matchesRefetching,
    refetch: refetchMatches,
  } = useQuery({
    queryKey: ['mobile-matches'],
    queryFn: fetchMatches,
  });

  const {
    data: conversations = [],
    error: conversationsError,
    isLoading: conversationsLoading,
    isRefetching: conversationsRefetching,
    refetch: refetchConversations,
  } = useQuery({
    queryKey: ['mobile-conversations'],
    queryFn: fetchConversations,
  });

  const notifications = useMemo<NotificationItem[]>(() => {
    const matchItems: NotificationItem[] = matches.map((match) => ({
      id: `match-${match.id}`,
      title: 'New match confirmed',
      body: `${match.user_a} and ${match.user_b} matched for ${match.activity}.`,
      createdAt: match.created_at,
      type: 'match',
    }));

    const messageItems: NotificationItem[] = conversations.flatMap((conversation) => {
      const lastMessage = conversation.messages[conversation.messages.length - 1];
      if (!lastMessage) {
        return [];
      }

      const sender = lastMessage.user?.firstName || lastMessage.user?.email || 'Someone';
      return [
        {
          id: `message-${conversation.id}-${lastMessage.id}`,
          title: `New message in ${conversation.match}`,
          body: `${sender}: ${lastMessage.message}`,
          createdAt: lastMessage.createdAt,
          type: 'message',
        },
      ];
    });

    return [...matchItems, ...messageItems].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
  }, [conversations, matches]);

  const matchNotifications = notifications.filter((item) => item.type === 'match');
  const messageNotifications = notifications.filter((item) => item.type === 'message');
  const latest = notifications[0];
  const isLoading = matchesLoading || conversationsLoading;
  const isRefetching = matchesRefetching || conversationsRefetching;

  return (
    <AppScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => {
            void refetchMatches();
            void refetchConversations();
          }}
        />
      }
    >
      <PageHeader
        eyebrow="Activity feed"
        title="Notifications"
        subtitle="A single place for fresh matches and active conversations, without the noise of a generic inbox."
        rightContent={<AccentPill tone="neutral">{notifications.length} updates</AccentPill>}
      />

      {matchesError || conversationsError ? (
        <PanelCard tone="warm" style={styles.feedbackCard}>
          <SectionIntro
            eyebrow="Attention"
            title="Some notifications did not load"
            subtitle="The timeline is still using the same match and conversation data sources; retry if one side of the feed stalled."
          />
          <HelperText type="error" visible>
            {getErrorMessage(matchesError ?? conversationsError, 'Unable to load notifications.')}
          </HelperText>
          <Button
            mode="outlined"
            onPress={() => {
              void refetchMatches();
              void refetchConversations();
            }}
            disabled={isRefetching}
          >
            {isRefetching ? 'Retrying...' : 'Refresh feed'}
          </Button>
        </PanelCard>
      ) : null}

      {latest ? (
        <PanelCard tone="accent" style={styles.summaryCard}>
          <AccentPill>{latest.type === 'message' ? 'Latest message' : 'Latest match'}</AccentPill>
          <Text variant="titleLarge" style={styles.summaryTitle}>
            {latest.title}
          </Text>
          <Text style={styles.summaryBody}>{latest.body}</Text>
          <Text style={styles.summaryTime}>{formatTimestamp(latest.createdAt)}</Text>
        </PanelCard>
      ) : null}

      {isLoading ? (
        <PanelCard>
          <View style={styles.listStack}>
            {Array.from({ length: 5 }).map((_, index) => (
              <NotificationRowSkeleton key={`notification-skeleton-${index}`} />
            ))}
          </View>
        </PanelCard>
      ) : null}

      {!isLoading && notifications.length === 0 ? (
        <EmptyStatePanel
          title="No notifications yet"
          description="When a match lands or a conversation gets a new message, the update will appear here with the same visual rhythm as the rest of the app."
        />
      ) : null}

      {messageNotifications.length > 0 ? (
        <PanelCard>
          <SectionIntro
            eyebrow="Messages"
            title="Conversation updates"
            subtitle="Fresh replies from your active conversations."
          />
          <View style={styles.listStack}>
            {messageNotifications.map((item) => (
              <View key={item.id} style={styles.feedRow}>
                <View style={[styles.iconBubble, styles.iconBubbleMessage]}>
                  <Text style={styles.iconText}>M</Text>
                </View>
                <View style={styles.feedContent}>
                  <View style={styles.feedMetaRow}>
                    <Text variant="titleMedium" style={styles.feedTitle}>
                      {item.title}
                    </Text>
                    <AccentPill tone="neutral">Message</AccentPill>
                  </View>
                  <NativeText style={styles.feedBody} numberOfLines={2}>
                    {item.body}
                  </NativeText>
                  <Text style={styles.feedTime}>{formatTimestamp(item.createdAt)}</Text>
                </View>
              </View>
            ))}
          </View>
        </PanelCard>
      ) : null}

      {matchNotifications.length > 0 ? (
        <PanelCard>
          <SectionIntro
            eyebrow="Matches"
            title="Connection updates"
            subtitle="Confirmed matches from the discovery side of the app."
          />
          <View style={styles.listStack}>
            {matchNotifications.map((item) => (
              <View key={item.id} style={styles.feedRow}>
                <View style={[styles.iconBubble, styles.iconBubbleMatch]}>
                  <Text style={styles.iconText}>+</Text>
                </View>
                <View style={styles.feedContent}>
                  <View style={styles.feedMetaRow}>
                    <Text variant="titleMedium" style={styles.feedTitle}>
                      {item.title}
                    </Text>
                    <AccentPill tone="secondary">Match</AccentPill>
                  </View>
                  <NativeText style={styles.feedBody} numberOfLines={2}>
                    {item.body}
                  </NativeText>
                  <Text style={styles.feedTime}>{formatTimestamp(item.createdAt)}</Text>
                </View>
              </View>
            ))}
          </View>
        </PanelCard>
      ) : null}
    </AppScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  feedbackCard: {
    gap: spacing.sm,
  },
  summaryCard: {
    gap: spacing.sm,
  },
  summaryTitle: {
    color: appColors.ink,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  summaryBody: {
    color: appColors.mutedInk,
    lineHeight: 22,
  },
  summaryTime: {
    color: appColors.softInk,
    fontSize: 12,
    fontWeight: '700',
  },
  loadingText: {
    color: appColors.mutedInk,
    lineHeight: 20,
  },
  listStack: {
    gap: spacing.sm,
  },
  feedRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#e8edf5',
    backgroundColor: '#f9fbff',
    padding: spacing.md,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubbleMessage: {
    backgroundColor: '#e8edff',
  },
  iconBubbleMatch: {
    backgroundColor: '#fff2d5',
  },
  iconText: {
    color: appColors.primaryDeep,
    fontSize: 18,
    fontWeight: '900',
  },
  feedContent: {
    flex: 1,
    gap: 6,
  },
  feedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  feedTitle: {
    flex: 1,
    color: appColors.ink,
    fontWeight: '800',
  },
  feedBody: {
    color: appColors.mutedInk,
    lineHeight: 20,
  },
  feedTime: {
    color: appColors.softInk,
    fontSize: 12,
    fontWeight: '700',
  },
});
