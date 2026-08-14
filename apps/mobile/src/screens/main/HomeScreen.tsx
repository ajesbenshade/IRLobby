import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Image, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import { AppScrollView, EmptyStatePanel, PageHeader, PanelCard } from '@components/AppChrome';
import { View } from '@components/RNCompat';
import { AppButton } from '@components/ui/Button';
import { useAuth } from '@hooks/useAuth';
import type { MainTabParamList } from '@navigation/types';
import { fetchActivities, fetchHostedActivities } from '@services/activityService';
import { appColors, spacing } from '@theme/index';
import { getErrorMessage } from '@utils/error';

import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

type HomeOverviewContentProps = {
  compact?: boolean;
  onOpenDiscover?: () => void;
};

const formatTime = (value?: string) => {
  if (!value) {
    return 'Time TBD';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Time TBD';
  }
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const HomeOverviewContent = ({ compact = false, onOpenDiscover }: HomeOverviewContentProps) => {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const { user } = useAuth();

  const {
    data: hosted = [],
    isLoading: hostedLoading,
    error: hostedError,
  } = useQuery({
    queryKey: ['mobile-hosted-activities'],
    queryFn: fetchHostedActivities,
  });

  const {
    data: discover = [],
    isLoading: discoverLoading,
    error: discoverError,
  } = useQuery({
    queryKey: ['mobile-discover-activities'],
    queryFn: () => fetchActivities(),
  });

  const firstName = user?.firstName || user?.email?.split('@')[0] || 'there';
  const tonightPlan = discover[0] ?? hosted[0];
  const latestHosted = hosted.slice(0, compact ? 2 : 3);
  const cover = tonightPlan?.images?.[0];

  const handleOpenDiscover = () => {
    if (onOpenDiscover) {
      onOpenDiscover();
      return;
    }
    navigation.navigate('Discover');
  };

  return (
    <>
      {compact ? (
        <PanelCard style={styles.snapshotCard}>
          <Text style={styles.snapshotEyebrow}>Tonight</Text>
          <Text variant="titleLarge" style={styles.snapshotTitle}>
            Hey, {firstName}
          </Text>
          <Text style={styles.snapshotSubtitle}>What are you up to tonight?</Text>
        </PanelCard>
      ) : null}

      {tonightPlan ? (
        <PanelCard style={styles.tonightCard}>
          {cover ? (
            <Image source={{ uri: cover }} style={styles.tonightCover} />
          ) : (
            <View style={styles.tonightCoverFallback}>
              <Text style={styles.tonightCoverLetter}>
                {tonightPlan.title.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.tonightCopy}>
            <Text style={styles.snapshotEyebrow}>Up next</Text>
            <Text variant="titleLarge" style={styles.tonightTitle}>
              {tonightPlan.title}
            </Text>
            <Text style={styles.tonightMeta}>
              {tonightPlan.location || 'Location TBD'} · {formatTime(tonightPlan.time)}
            </Text>
            <View style={styles.ctaActions}>
              <AppButton onPress={handleOpenDiscover}>Open deck</AppButton>
              <AppButton variant="outline" onPress={() => navigation.navigate('Create')}>
                Host something
              </AppButton>
            </View>
          </View>
        </PanelCard>
      ) : (
        <PanelCard style={styles.ctaCard}>
          <Text variant="titleLarge" style={styles.ctaTitle}>
            {compact ? 'Nothing on the board yet.' : 'Turn scrolling into a plan.'}
          </Text>
          <Text style={styles.ctaSubtitle}>
            {compact
              ? 'Host a hang or jump into Discover.'
              : 'Host a hang or hop into the deck.'}
          </Text>
          <View style={styles.ctaActions}>
            <AppButton onPress={() => navigation.navigate('Create')}>Host something</AppButton>
            <AppButton variant="outline" onPress={handleOpenDiscover}>
              Explore plans
            </AppButton>
          </View>
        </PanelCard>
      )}

      {(hostedError || discoverError) ? (
        <Text style={styles.errorText}>
          {getErrorMessage(hostedError ?? discoverError, 'Unable to load home data.')}
        </Text>
      ) : null}

      <Text style={styles.caption}>
        {hostedLoading ? 'Checking your plans…' : `${hosted.length} hosting`}
        {' · '}
        {discoverLoading ? 'scanning nearby' : `${discover.length} nearby`}
      </Text>

      <PanelCard>
        <View style={styles.sectionHeader}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Your latest plans
          </Text>
          <Text style={styles.sectionMeta}>
            {compact ? 'What you’re hosting right now.' : 'Your freshest plan updates.'}
          </Text>
        </View>

        <View style={styles.listContent}>
          {latestHosted.map((activity) => (
            <View key={String(activity.id)} style={styles.activityRow}>
              <View style={styles.activityIndex}>
                <Text style={styles.activityIndexText}>
                  {activity.title.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.activityCopy}>
                <Text variant="titleSmall" style={styles.activityTitle}>
                  {activity.title}
                </Text>
                <Text style={styles.activitySubtitle}>
                  {formatTime(activity.time)} · Hosted by you
                </Text>
              </View>
            </View>
          ))}
          {!hostedLoading && latestHosted.length === 0 ? (
            <EmptyStatePanel
              title="No plans yet"
              description="Post your first hang and people can join."
              action={
                <AppButton onPress={() => navigation.navigate('Create')}>
                  Host your first plan
                </AppButton>
              }
            />
          ) : null}
        </View>
      </PanelCard>
    </>
  );
};

export const HomeScreen = () => {
  const { user } = useAuth();
  const firstName = user?.firstName || user?.email?.split('@')[0] || 'there';

  return (
    <AppScrollView contentContainerStyle={styles.container}>
      <PageHeader
        eyebrow="Tonight"
        title={`Hey ${firstName}.`}
        subtitle="What are you up to tonight?"
      />
      <HomeOverviewContent />
    </AppScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  tonightCard: {
    padding: 0,
    overflow: 'hidden',
    gap: 0,
  },
  tonightCover: {
    width: '100%',
    height: 180,
  },
  tonightCoverFallback: {
    width: '100%',
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(91, 75, 255, 0.18)',
  },
  tonightCoverLetter: {
    color: appColors.primaryGlow,
    fontSize: 48,
    fontWeight: '600',
  },
  tonightCopy: {
    gap: 8,
    padding: spacing.lg,
  },
  tonightTitle: {
    color: appColors.ink,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  tonightMeta: {
    color: appColors.mutedInk,
    lineHeight: 20,
  },
  ctaCard: {
    gap: 12,
  },
  ctaTitle: {
    color: appColors.ink,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  ctaSubtitle: {
    color: appColors.mutedInk,
    lineHeight: 22,
  },
  ctaActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  caption: {
    color: appColors.softInk,
    fontSize: 13,
  },
  sectionHeader: {
    gap: 4,
    marginBottom: 16,
  },
  sectionTitle: {
    color: appColors.ink,
    fontWeight: '600',
  },
  sectionMeta: {
    color: appColors.mutedInk,
  },
  listContent: {
    gap: 12,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 4,
  },
  activityIndex: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(91, 75, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityIndexText: {
    color: appColors.primaryGlow,
    fontWeight: '600',
  },
  activityCopy: {
    flex: 1,
    gap: 2,
  },
  activityTitle: {
    color: appColors.ink,
  },
  activitySubtitle: {
    color: appColors.mutedInk,
  },
  snapshotCard: {
    gap: 8,
  },
  snapshotEyebrow: {
    color: appColors.softInk,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  snapshotTitle: {
    color: appColors.ink,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  snapshotSubtitle: {
    color: appColors.mutedInk,
  },
  errorText: {
    color: appColors.danger,
    fontSize: 14,
  },
});
