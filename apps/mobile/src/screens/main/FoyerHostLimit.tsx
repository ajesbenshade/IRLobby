import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoyerHeader } from '@components/FoyerHeader';
import { HostLimitNote } from '@components/foyer/HostLimitNote';
import { ScrollView, View } from '@components/RNCompat';
import { useHostLimit } from '@foyer/useHostLimit';
import { useTabScreenBottomPadding } from '@navigation/tabBarLayout';
import { appColors, appTypography } from '@theme/index';

import { FoyerHostForm } from './FoyerHostForm';

/** Host tab while the weekly limit is in effect (reached through a Host button, not the greyed tab): the note only, no form. */
export const HostLimitScreen = ({ opensAt }: { opensAt: Date }) => {
  const tabBottomPadding = useTabScreenBottomPadding();
  return (
    <View style={styles.root} testID="host-limit-screen">
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <Text style={styles.navTitle}>Host a gathering</Text>
      </SafeAreaView>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 48 + (tabBottomPadding ?? 0) }]}>
        <FoyerHeader />
      </ScrollView>
      <HostLimitNote opensAt={opensAt} />
    </View>
  );
};

/**
 * Host tab in Foyer mode. New gatherings are gated by the weekly limit (church admins never are). Editing an
 * existing gathering is never gated.
 */
export const FoyerHostEntry = ({ activityId }: { activityId?: number | string }) => {
  const limit = useHostLimit();
  if (!activityId && limit.blocked) {
    return <HostLimitScreen opensAt={limit.opensAt} />;
  }
  return <FoyerHostForm activityId={activityId} />;
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: appColors.background },
  topBar: { alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, minHeight: 48, justifyContent: 'flex-end' },
  navTitle: { textAlign: 'center', fontFamily: appTypography.bodySemibold, fontSize: 17, lineHeight: 24, color: appColors.ink },
  content: { padding: 20, gap: 14 },
});
