import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { StyleSheet } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';

import { AppScrollView, EmptyStatePanel, PageHeader, PanelCard, StatCard } from '@components/AppChrome';
import { View } from '@components/RNCompat';
import { useAuth } from '@hooks/useAuth';
import type { MainTabParamList } from '@navigation/types';
import { fetchActivities, fetchHostedActivities } from '@services/activityService';
import { appColors } from '@theme/index';
import { getErrorMessage } from '@utils/error';

import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

type HomeOverviewContentProps = {
  compact?: boolean;
  onOpenDiscover?: () => void;
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
  const latestHosted = hosted.slice(0, compact ? 2 : 3);

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
          <Text style={styles.snapshotEyebrow}>Quick pulse</Text>
          <Text variant="titleLarge" style={styles.snapshotTitle}>
            Hey, {firstName}
          </Text>
          <Text style={styles.snapshotSubtitle}>
            Your latest momentum stays lightweight here so the swipe deck can keep center stage.
          </Text>
        </PanelCard>
      ) : null}

      <View style={styles.statGrid}>
        <StatCard
          label="Hosting"
          value={hostedLoading ? '...' : String(hosted.length)}
          detail="Plans you already put into the group chat universe."
        />
        <StatCard
          label="Open now"
          value={discoverLoading ? '...' : String(discover.length)}
          detail="Fresh options you can jump into next."
          tone="secondary"
        />
      </View>

      <PanelCard style={styles.ctaCard}>
        <Text variant="titleLarge" style={styles.ctaTitle}>
          {compact ? 'Start something or jump back into the deck.' : 'Turn scrolling into an actual plan.'}
        </Text>
        <Text style={styles.ctaSubtitle}>
          {compact
            ? 'This compact view keeps your counts, latest hosted plans, and a fast path back to discovery in one place.'
            : 'Host a hang, check what is buzzing nearby, and keep momentum moving while people are still down.'}
        </Text>
        <View style={styles.ctaActions}>
          <Button mode="contained" onPress={() => navigation.navigate('Create')} buttonColor={appColors.primary}>
            Host something
          </Button>
          <Button mode="outlined" onPress={handleOpenDiscover}>
            {compact ? 'Open swipe deck' : 'Explore now'}
          </Button>
        </View>
      </PanelCard>

      {(hostedError || discoverError) && (
        <HelperText type="error" visible>
          {getErrorMessage(hostedError ?? discoverError, 'Unable to load home data.')}
        </HelperText>
      )}

      <PanelCard>
        <View style={styles.sectionHeader}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Latest plans
          </Text>
          <Text style={styles.sectionMeta}>{compact ? 'A quick look at what you are hosting' : 'Your freshest plan updates'}</Text>
        </View>

        <View style={styles.listContent}>
          {latestHosted.map((activity, index) => (
            <View key={String(activity.id)} style={styles.activityRow}>
              <View style={styles.activityIndex}>
                <Text style={styles.activityIndexText}>{index + 1}</Text>
              </View>
              <View style={styles.activityCopy}>
                <Text variant="titleSmall" style={styles.activityTitle}>
                  {activity.title}
                </Text>
                <Text style={styles.activitySubtitle}>Hosted by you and ready to rally the crew.</Text>
              </View>
            </View>
          ))}
          {!hostedLoading && latestHosted.length === 0 && (
            <EmptyStatePanel
              title="No hosted plans yet"
              description="Once you post your first hang, it will land here for quick edits and updates."
              action={
                <Button mode="contained" buttonColor={appColors.primary} onPress={() => navigation.navigate('Create')}>
                  Host your first plan
                </Button>
              }
            />
          )}
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
        eyebrow="Your scene"
        title={`Welcome back, ${firstName}`}
        subtitle="See what you’re hosting, what is nearby, and where tonight’s momentum is picking up."
      />

      <HomeOverviewContent />
    </AppScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  statGrid: {
    gap: 14,
  },
  ctaCard: {
    gap: 12,
    backgroundColor: '#fff0f5',
    borderColor: '#ffd2e0',
  },
  ctaTitle: {
    color: appColors.ink,
    fontWeight: '800',
    letterSpacing: -0.5,
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
  sectionHeader: {
    gap: 4,
    marginBottom: 16,
  },
  sectionTitle: {
    color: appColors.ink,
    fontWeight: '800',
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
    backgroundColor: '#ffe4ee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityIndexText: {
    color: appColors.primaryDeep,
    fontWeight: '800',
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
    backgroundColor: '#fffaf0',
    borderColor: '#ffe0a3',
  },
  snapshotEyebrow: {
    color: appColors.softInk,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  snapshotTitle: {
    color: appColors.ink,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  snapshotSubtitle: {
    color: appColors.mutedInk,
    lineHeight: 21,
  },
});
