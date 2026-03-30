import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';

import { AppScrollView, EmptyStatePanel, PageHeader, PanelCard, StatCard } from '@components/AppChrome';
import { useAuth } from '@hooks/useAuth';
import type { MainTabParamList } from '@navigation/types';
import { fetchActivities, fetchHostedActivities } from '@services/activityService';
import { appColors } from '@theme/index';
import { getErrorMessage } from '@utils/error';

import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

export const HomeScreen = () => {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const { user } = useAuth();

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
    data: discover = [],
    isLoading: discoverLoading,
    isRefetching: discoverRefetching,
    error: discoverError,
    refetch: refetchDiscover,
  } = useQuery({
    queryKey: ['mobile-discover-activities'],
    queryFn: () => fetchActivities(),
  });

  const isRefreshing = hostedRefetching || discoverRefetching;
  const firstName = user?.firstName || user?.email?.split('@')[0] || 'there';
  const latestHosted = hosted.slice(0, 3);

  return (
    <AppScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => {
            void refetchHosted();
            void refetchDiscover();
          }}
        />
      }
    >
      <PageHeader
        eyebrow="Dashboard"
        title={`Welcome back, ${firstName}`}
        subtitle="A cleaner snapshot of what you’re hosting, what’s nearby, and where momentum is building."
      />

      <View style={styles.statGrid}>
        <StatCard
          label="Hosted"
          value={hostedLoading ? '...' : String(hosted.length)}
          detail="Events you’ve already put into the world."
        />
        <StatCard
          label="Discoverable"
          value={discoverLoading ? '...' : String(discover.length)}
          detail="Open activities you can jump into next."
          tone="secondary"
        />
      </View>

      <PanelCard style={styles.ctaCard}>
        <Text variant="titleLarge" style={styles.ctaTitle}>
          Move from browsing to booking something real.
        </Text>
        <Text style={styles.ctaSubtitle}>
          Keep the app useful by creating a plan or checking what is trending nearby.
        </Text>
        <View style={styles.ctaActions}>
          <Button mode="contained" onPress={() => navigation.navigate('Create')} buttonColor={appColors.primary}>
            Create activity
          </Button>
          <Button mode="outlined" onPress={() => navigation.navigate('Discover')}>
            Explore now
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
            Latest hosted
          </Text>
          <Text style={styles.sectionMeta}>Your freshest activity updates</Text>
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
                <Text style={styles.activitySubtitle}>Hosted by you and ready to manage.</Text>
              </View>
            </View>
          ))}
          {!hostedLoading && latestHosted.length === 0 && (
            <EmptyStatePanel
              title="No hosted activities yet"
              description="Your hosted events will appear here once you publish one."
              action={
                <Button mode="contained" buttonColor={appColors.primary} onPress={() => navigation.navigate('Create')}>
                  Create your first activity
                </Button>
              }
            />
          )}
        </View>
      </PanelCard>
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
    backgroundColor: '#f8f9ff',
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
    backgroundColor: '#ebefff',
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
});
