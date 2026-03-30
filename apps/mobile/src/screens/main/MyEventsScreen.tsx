import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { Button, HelperText, SegmentedButtons, Text } from 'react-native-paper';

import { AccentPill, AppScrollView, EmptyStatePanel, PageHeader, PanelCard, SectionIntro, StatCard } from '@components/AppChrome';
import type { MainTabParamList } from '@navigation/types';
import { fetchHostedActivities } from '@services/activityService';
import { fetchMatches } from '@services/matchService';
import { appColors, radii, spacing } from '@theme/index';
import { getErrorMessage } from '@utils/error';

import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

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
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const [activeSegment, setActiveSegment] = useState<'events' | 'matches'>('events');
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
        eyebrow="Activity"
        title={activeSegment === 'events' ? 'Plans you are driving' : 'People already aligned'}
        subtitle={
          activeSegment === 'events'
            ? 'Keep hosted plans, recent traction, and your next hosting move in one place without crowding the bottom bar.'
            : 'Review confirmed overlaps and warm leads inside the same activity hub instead of jumping to a separate tab.'
        }
        rightContent={<AccentPill tone="neutral">{hostedCount + matchedCount} total</AccentPill>}
      />

      <PanelCard style={styles.segmentShell} tone={activeSegment === 'events' ? 'accent' : 'default'}>
        <View style={styles.segmentShellHeader}>
          <AccentPill tone={activeSegment === 'events' ? 'secondary' : 'neutral'}>
            {activeSegment === 'events' ? 'Default view' : 'Focused view'}
          </AccentPill>
          <Text style={styles.segmentShellCopy}>
            {activeSegment === 'events'
              ? 'My Events stays first so hosted plans remain the center of gravity.'
              : 'Matches gives you a cleaner follow-up lane when discovery starts converting.'}
          </Text>
        </View>
        <SegmentedButtons
          value={activeSegment}
          onValueChange={(value) => setActiveSegment(value as 'events' | 'matches')}
          buttons={[
            { value: 'events', label: 'My Events' },
            { value: 'matches', label: 'Matches' },
          ]}
          style={styles.segmentedControl}
        />
      </PanelCard>

      {(hostedError || matchesError) && (
        <HelperText type="error" visible>
          {getErrorMessage(hostedError ?? matchesError, 'Unable to load your events.')}
        </HelperText>
      )}

      {activeSegment === 'events' ? (
        <>
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
        </>
      ) : (
        <PanelCard>
          <SectionIntro
            eyebrow="Matched"
            title="People and plans you connected with"
            subtitle="Keep a clean view of the activity matches that are already moving from discovery toward real plans."
          />
          {matchesLoading ? (
            <Text style={styles.loadingCopy}>Loading matches...</Text>
          ) : matchedCount > 0 ? (
            <View style={styles.matchesStack}>
              {matches.map((match) => (
                <PanelCard key={match.id} style={styles.matchCard} tone="default">
                  <View style={styles.matchCardContent}>
                    <View style={styles.matchHeaderRow}>
                      <View style={styles.flexText}>
                        <AccentPill>Matched</AccentPill>
                        <Text variant="titleMedium" style={styles.eventTitle}>
                          {match.activity}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.peopleRow}>
                      <View style={styles.personBubble}>
                        <Text style={styles.personInitial}>{String(match.user_a).charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={styles.connectionText}>{match.user_a}</Text>
                      <Text style={styles.connectionDivider}>↔</Text>
                      <View style={[styles.personBubble, styles.personBubbleWarm]}>
                        <Text style={styles.personInitial}>{String(match.user_b).charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={styles.connectionText}>{match.user_b}</Text>
                    </View>
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Created</Text>
                      <Text style={styles.secondaryText}>{new Date(match.created_at).toLocaleString()}</Text>
                    </View>
                  </View>
                </PanelCard>
              ))}
            </View>
          ) : (
            <EmptyStatePanel
              title="No matches yet"
              description="Start swiping on activities you actually want to attend and this space will turn into your warm lead list."
              action={
                <Button mode="contained" buttonColor={appColors.primary} onPress={() => navigation.navigate('Discover')}>
                  Keep exploring
                </Button>
              }
            />
          )}
        </PanelCard>
      )}
    </AppScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  segmentShell: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  segmentShellHeader: {
    gap: 8,
  },
  segmentShellCopy: {
    color: appColors.mutedInk,
    lineHeight: 20,
  },
  segmentedControl: {
    marginBottom: 0,
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
  matchesStack: {
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
  matchCard: {
    marginBottom: 0,
  },
  matchCardContent: {
    gap: 14,
  },
  matchHeaderRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  flexText: {
    flex: 1,
    gap: 10,
  },
  peopleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  personBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ebefff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personBubbleWarm: {
    backgroundColor: '#ffefcf',
  },
  personInitial: {
    color: appColors.primaryDeep,
    fontWeight: '800',
  },
  connectionText: {
    color: appColors.ink,
    fontWeight: '600',
  },
  connectionDivider: {
    color: appColors.softInk,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
    paddingTop: 14,
  },
  metaLabel: {
    color: appColors.mutedInk,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  secondaryText: {
    color: appColors.mutedInk,
  },
});
