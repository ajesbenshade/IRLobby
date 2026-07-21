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
          <Text style={styles.snapshotEyebrow}>Tonight</Text>
          <Text variant="titleLarge" style={styles.snapshotTitle}>
            Hey, {firstName}
          </Text>
          <Text style={styles.snapshotSubtitle}>
            What are you up to tonight?
          </Text>
        </PanelCard>
      ) : null}

      <View style={styles.statGrid}>
        <StatCard
          label="Hosting"
          value={hostedLoading ? '...' : String(hosted.length)}
          detail="Plans you’re running."
        />
        <StatCard
          label="Nearby"
          value={discoverLoading ? '...' : String(discover.length)}
          detail="Open plans you can jump into."
          tone="secondary"
        />
      </View>

      <PanelCard style={styles.ctaCard}>
        <Text variant="titleLarge" style={styles.ctaTitle}>
          {compact ? 'Start something or jump back in.' : 'Turn scrolling into a plan.'}
        </Text>
        <Text style={styles.ctaSubtitle}>
          {compact
            ? 'Quick view of what you’re running and a fast way back to Discover.'
            : 'Host a hang or hop into the deck.'}
        </Text>
        <View style={styles.ctaActions}>
          <Button mode="contained" onPress={() => navigation.navigate('Create')} buttonColor={appColors.primary}>
            Host something
          </Button>
          <Button mode="outlined" onPress={handleOpenDiscover}>
            {compact ? 'Open deck' : 'Explore plans'}
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
            Your latest plans
          </Text>
          <Text style={styles.sectionMeta}>{compact ? 'What you’re hosting right now.' : 'Your freshest plan updates.'}</Text>
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
                <Text style={styles.activitySubtitle}>Hosted by you.</Text>
              </View>
            </View>
          ))}
          {!hostedLoading && latestHosted.length === 0 && (
            <EmptyStatePanel
              title="No plans yet"
              description="Post your first hang and people can join."
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
  statGrid: {
    gap: 14,
  },
  ctaCard: {
    gap: 12,
    backgroundColor: appColors.primarySoft,
    borderColor: appColors.primarySoft,
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
