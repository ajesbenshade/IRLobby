import { useQuery } from '@tanstack/react-query';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { HelperText, Text } from 'react-native-paper';

import { AccentPill, AppScrollView, EmptyStatePanel, PageHeader, PanelCard, SectionIntro, StatCard } from '@components/AppChrome';
import { fetchHostedActivities } from '@services/activityService';
import { fetchMatches } from '@services/matchService';
import { appColors, radii, spacing } from '@theme/index';
import { getErrorMessage } from '@utils/error';

const formatDateLabel = (value?: string) => {
  if (!value) {
    return 'Date pending';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

const formatHostLabel = (host: unknown) => {
  if (typeof host === 'string') {
    return host;
  }

  if (host && typeof host === 'object') {
    const typedHost = host as {
      firstName?: string;
      lastName?: string;
      email?: string;
    };
    const name = [typedHost.firstName, typedHost.lastName].filter(Boolean).join(' ').trim();
    return name || typedHost.email || 'Host';
  }

  return 'Host';
};

export const MyEventsScreen = () => {
  const {
    data: hosted = [],
    isLoading: hostedLoading,
    isRefetching: hostedRefetching,
    error: hostedError,
    refetch: refetchHosted,
  } = useQuery({
    queryKey: ['mobile-hosted-activities'],
    queryFn: fetchHostedActivities,
  });

  const {
    data: matches = [],
    isLoading: matchesLoading,
    isRefetching: matchesRefetching,
    error: matchesError,
    refetch: refetchMatches,
  } = useQuery({
    queryKey: ['mobile-matches'],
    queryFn: fetchMatches,
  });

  const isRefreshing = hostedRefetching || matchesRefetching;
  const hostedCount = hosted.length;
  const matchedCount = matches.length;

  return (
    <AppScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => {
            void refetchHosted();
            void refetchMatches();
          }}
        />
      }
    >
      <PageHeader
        eyebrow="My Events"
        title="Your activity footprint"
        subtitle="Track what you have hosted, what you have matched into, and where your calendar momentum is building."
        rightContent={<AccentPill tone="neutral">{hostedCount + matchedCount} total</AccentPill>}
      />

      {(hostedError || matchesError) && (
        <HelperText type="error" visible>
          {getErrorMessage(hostedError ?? matchesError, 'Unable to load your events.')}
        </HelperText>
      )}

      <View style={styles.statsRow}>
        <StatCard
          label="Hosted"
          value={hostedLoading ? '...' : String(hostedCount)}
          detail="Activities you organized and published yourself."
        />
        <StatCard
          label="Matched"
          value={matchesLoading ? '...' : String(matchedCount)}
          detail="Conversations and activity matches created through the app."
          tone="secondary"
        />
      </View>

      <PanelCard tone="accent" style={styles.summaryCard}>
        <AccentPill>Weekly summary</AccentPill>
        <Text variant="titleLarge" style={styles.summaryTitle}>
          {hostedCount > 0 || matchedCount > 0
            ? 'You already have live social proof inside the app.'
            : 'Your calendar is still open for the first few wins.'}
        </Text>
        <Text style={styles.summarySubtitle}>
          {hostedCount > 0 || matchedCount > 0
            ? 'Keep the profile and discovery flows sharp so people move from seeing you to joining plans with less hesitation.'
            : 'Host an activity or keep swiping in discovery so this screen starts filling with hosted plans and real connections.'}
        </Text>
      </PanelCard>

      <PanelCard>
        <SectionIntro
          eyebrow="Hosted"
          title="Plans you created"
          subtitle="These are the experiences people see with your name attached as the organizer."
        />
        {hostedLoading ? (
          <Text style={styles.loadingCopy}>Loading hosted activities...</Text>
        ) : hostedCount > 0 ? (
          <View style={styles.listStack}>
            {hosted.slice(0, 5).map((activity) => (
              <View key={String(activity.id)} style={styles.eventRow}>
                <View style={styles.eventPrimary}>
                  <Text variant="titleMedium" style={styles.eventTitle}>
                    {activity.title}
                  </Text>
                  <Text style={styles.eventMeta}>
                    {formatDateLabel(activity.time)} · {activity.location || 'Location pending'}
                  </Text>
                  <Text style={styles.eventDescription} numberOfLines={2}>
                    {activity.description || 'No description added yet.'}
                  </Text>
                </View>
                <View style={styles.eventAside}>
                  <AccentPill tone="secondary">{activity.participant_count ?? 0} going</AccentPill>
                  {activity.category ? <Text style={styles.eventAsideCopy}>{activity.category}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <EmptyStatePanel
            title="No hosted events yet"
            description="Once you publish an activity, it will show up here with its attendance and schedule details."
          />
        )}
      </PanelCard>

      <PanelCard>
        <SectionIntro
          eyebrow="Matched"
          title="People and plans you connected with"
          subtitle="Your most recent matches show where discovery is already turning into real social movement."
        />
        {matchesLoading ? (
          <Text style={styles.loadingCopy}>Loading matches...</Text>
        ) : matchedCount > 0 ? (
          <View style={styles.listStack}>
            {matches.slice(0, 5).map((match) => (
              <View key={match.id} style={styles.matchRow}>
                <View style={styles.matchAvatarBubble}>
                  <Text style={styles.matchAvatarText}>{match.activity.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.eventPrimary}>
                  <Text variant="titleMedium" style={styles.eventTitle}>
                    {match.activity}
                  </Text>
                  <Text style={styles.eventMeta}>
                    {match.user_a} and {match.user_b}
                  </Text>
                  <Text style={styles.eventDescription} numberOfLines={2}>
                    Match created {formatDateLabel(match.created_at)}.
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <EmptyStatePanel
            title="No matches yet"
            description="New activity matches will land here once discovery starts pairing you with people and plans."
          />
        )}
      </PanelCard>
    </AppScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  summaryCard: {
    gap: spacing.sm,
  },
  summaryTitle: {
    color: appColors.ink,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  summarySubtitle: {
    color: appColors.mutedInk,
    lineHeight: 22,
  },
  loadingCopy: {
    color: appColors.mutedInk,
    lineHeight: 20,
  },
  listStack: {
    gap: spacing.sm,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#e8edf5',
    backgroundColor: '#f9fbff',
    padding: spacing.md,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#e8edf5',
    backgroundColor: '#f9fbff',
    padding: spacing.md,
  },
  eventPrimary: {
    flex: 1,
    gap: 6,
  },
  eventAside: {
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: 104,
  },
  eventTitle: {
    color: appColors.ink,
    fontWeight: '800',
  },
  eventMeta: {
    color: appColors.mutedInk,
    fontSize: 13,
    fontWeight: '600',
  },
  eventDescription: {
    color: appColors.softInk,
    lineHeight: 20,
  },
  eventAsideCopy: {
    color: appColors.softInk,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  matchAvatarBubble: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#e8edff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchAvatarText: {
    color: appColors.primaryDeep,
    fontSize: 20,
    fontWeight: '900',
  },
});
