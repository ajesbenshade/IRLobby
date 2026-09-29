import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { AccentPill, AppScrollView, EmptyStatePanel, PageHeader, PanelCard, SectionIntro, StatCard } from '@components/AppChrome';
import { RefreshControl, Text as NativeText, View } from '@components/RNCompat';
import { AppButton } from '@components/ui/Button';
import { config } from '@constants/config';
import type { MainStackParamList, MainTabParamList } from '@navigation/types';
import { fetchGatherings, fetchHostedActivities } from '@services/activityService';
import { fetchMatches } from '@services/matchService';
import { appColors, radii, spacing } from '@theme/index';
import { getErrorMessage } from '@utils/error';

import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

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
  const navigation = useNavigation<
    CompositeNavigationProp<
      BottomTabNavigationProp<MainTabParamList, 'Activity'>,
      NativeStackNavigationProp<MainStackParamList>
    >
  >();
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

  const gatheringsQuery = useQuery({
    queryKey: ['mobile-gatherings'],
    queryFn: fetchGatherings,
    enabled: config.foyerMode,
  });
  const gatherings = gatheringsQuery.data ?? [];

  const isRefreshing = hostedRefetching || matchesRefetching || gatheringsQuery.isRefetching;
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

      {config.foyerMode ? (
        <PanelCard>
          <SectionIntro
            eyebrow="After the card"
            title="Your gatherings"
            subtitle="Come back to chat once you or a child in your household is going."
          />
          {gatherings.length === 0 ? (
            <Text style={styles.loadingCopy}>No gatherings yet.</Text>
          ) : (
            gatherings.map((activity) => (
              <View key={String(activity.id)} style={styles.eventRow}>
                <View style={styles.eventPrimary}>
                  <Text variant="titleMedium" style={styles.eventTitle}>
                    {activity.title}
                  </Text>
                  <Text style={styles.eventMeta}>{activity.location || 'Location pending'}</Text>
                </View>
                <AppButton
                  compact
                  onPress={() => navigation.getParent()?.navigate('Chat')}
                >
                  Chat
                </AppButton>
              </View>
            ))
          )}
        </PanelCard>
      ) : null}

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
        <View style={styles.segmentRow}>
          {([
            { value: 'events', label: 'My Events' },
            { value: 'matches', label: 'Matches' },
          ] as const).map((segment) => {
            const selected = activeSegment === segment.value;
            return (
              <Pressable
                key={segment.value}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setActiveSegment(segment.value)}
                style={[styles.segmentTab, selected ? styles.segmentTabSelected : null]}
              >
                <Text style={[styles.segmentTabLabel, selected ? styles.segmentTabLabelSelected : null]}>
                  {segment.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </PanelCard>

      {(hostedError || matchesError) ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {getErrorMessage(hostedError ?? matchesError, 'Unable to load your events.')}
          </Text>
          <AppButton
            variant="outline"
            onPress={() => {
              void refetchHosted();
              void refetchMatches();
            }}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Retrying...' : 'Retry'}
          </AppButton>
        </View>
      ) : null}

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
                      <NativeText style={styles.eventDescription} numberOfLines={2}>
                        {activity.description || 'No description added yet.'}
                      </NativeText>
                    </View>
                    <View style={styles.eventAside}>
                      <AccentPill tone="secondary">{activity.participant_count ?? 0} going</AccentPill>
                      {activity.category ? <Text style={styles.eventAsideCopy}>{activity.category}</Text> : null}
                      <AppButton
                        compact
                        variant="outline"
                        onPress={() =>
                          navigation.navigate('EditActivity', {
                            activityId: activity.id,
                          })
                        }
                      >
                        Edit
                      </AppButton>
                      {config.ticketingEnabled && !config.foyerMode ? (
                        <AppButton
                          compact
                          variant="outline"
                          onPress={() =>
                            navigation.navigate('DoorScan', {
                              activityId: activity.id,
                              title: activity.title,
                              admitted: activity.participant_count ?? 0,
                              capacity: activity.maxTickets ?? activity.max_tickets ?? activity.capacity ?? 40,
                            })
                          }
                        >
                          Door scan
                        </AppButton>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : hostedError ? null : (
              <EmptyStatePanel
                title="No hosted plans yet"
                description="Post something for tonight. Nearby people will see it in Discover."
                action={
                  <Button mode="contained" buttonColor={appColors.primary} onPress={() => navigation.navigate('Create')}>
                    Host a plan
                  </Button>
                }
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
          ) : matchesError ? null : (
            <EmptyStatePanel
              title="No matches yet"
              description="Swipe right on plans you want. Matches show up here so you can message and meet."
              action={
                <Button mode="contained" buttonColor={appColors.primary} onPress={() => navigation.navigate('Discover')}>
                  Open Discover
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
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: appColors.lineStrong,
    backgroundColor: appColors.cardStrong,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  segmentTabSelected: {
    backgroundColor: appColors.primary,
    borderColor: appColors.primary,
  },
  segmentTabLabel: {
    color: appColors.ink,
    fontWeight: '700',
  },
  segmentTabLabelSelected: {
    color: appColors.white,
  },
  errorContainer: {
    gap: 8,
  },
  errorText: {
    color: appColors.danger,
    fontSize: 14,
    lineHeight: 20,
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
    borderColor: appColors.line,
    backgroundColor: appColors.cardStrong,
    padding: spacing.md,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: appColors.line,
    backgroundColor: appColors.cardStrong,
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
    backgroundColor: appColors.primaryWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personBubbleWarm: {
    backgroundColor: 'rgba(232, 200, 114, 0.14)',
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
    borderTopColor: appColors.line,
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
