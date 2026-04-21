import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

import { OfflineBanner } from '@components/OfflineBanner';
import { Text as NativeText, View } from '@components/RNCompat';
import { appColors, spacing } from '@theme/index';

import type { MainStackParamList } from '@navigation/types';
import { VibeQuizResultsView } from './VibeQuizResultsView';

type Nav = NativeStackNavigationProp<MainStackParamList, 'VibeQuizResults'>;
type RouteProps = RouteProp<MainStackParamList, 'VibeQuizResults'>;

export const VibeQuizResultsScreen = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const { vibeProfile, vibeTags, discoverTags } = route.params;

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const goToDiscover = () => {
    navigation.navigate('Tabs');
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <OfflineBanner />
      <Text variant="headlineMedium" style={styles.title}>
        Your Vibe
      </Text>
      <VibeQuizResultsView
        vibeProfile={vibeProfile}
        vibeTags={vibeTags}
        discoverTags={discoverTags}
        ctaLabel="See All My Matches →"
        onCta={goToDiscover}
        // 24h cache for the standalone screen so persisted data survives restarts.
        gcTimeMs={24 * 60 * 60 * 1000}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Browse all activities"
        onPress={goToDiscover}
        style={styles.secondary}
      >
        <NativeText style={styles.secondaryText}>Browse all activities</NativeText>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: appColors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    gap: spacing.lg,
  },
  title: {
    color: appColors.ink,
    fontWeight: '900',
    textAlign: 'center',
  },
  secondary: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryText: {
    color: appColors.softInk,
    fontWeight: '600',
    fontSize: 14,
  },
});
