import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';

import { AccentPill, AppScrollView, EmptyStatePanel, PageHeader, PanelCard } from '@components/AppChrome';
import type { MainTabParamList } from '@navigation/types';
import { fetchMatches } from '@services/matchService';
import { appColors } from '@theme/index';
import { getErrorMessage } from '@utils/error';

import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

export const MatchesScreen = () => {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const { data = [], isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['mobile-matches'],
    queryFn: fetchMatches,
  });

  return (
    <AppScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
    >
      <PageHeader
        eyebrow="Connections"
        title="Matches"
        subtitle="A cleaner view of the people and activities where interest lined up on both sides."
      />

      {isLoading && <Text style={styles.loadingText}>Loading matches...</Text>}

      {error && (
        <View style={styles.errorContainer}>
          <HelperText type="error" visible>
            {getErrorMessage(error, 'Unable to load matches.')}
          </HelperText>
          <Button mode="outlined" onPress={() => void refetch()} disabled={isRefetching}>
            {isRefetching ? 'Retrying...' : 'Retry'}
          </Button>
        </View>
      )}

      {!isLoading && data.length === 0 && (
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

      {data.map((match) => (
        <PanelCard key={match.id} style={styles.card} tone="default">
          <View style={styles.cardContent}>
            <View style={styles.headerRow}>
              <View style={styles.flexText}>
                <AccentPill>Matched</AccentPill>
                <Text variant="titleMedium" style={styles.titleText}>
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
    </AppScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  loadingText: {
    color: appColors.mutedInk,
  },
  card: {
    marginBottom: 0,
  },
  cardContent: {
    gap: 14,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  flexText: {
    flex: 1,
    gap: 10,
  },
  titleText: {
    color: appColors.ink,
    fontWeight: '800',
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
  errorContainer: {
    gap: 8,
  },
});
