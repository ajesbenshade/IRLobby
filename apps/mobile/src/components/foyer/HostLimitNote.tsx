import { StyleSheet } from 'react-native';

import { InfoNotice } from '@components/foyer/ui';
import { View } from '@components/RNCompat';
import { hostLimitBanner } from '@foyer/hostLimit';
import { useTabBarLayout } from '@navigation/tabBarLayout';

/** Space a tab screen leaves at the end of its scroll content so the note never covers the last row. */
export const HOST_LIMIT_NOTE_SPACE = 96;

/** Frame 246: the weekly-limit note floating just above the tab bar. */
export const HostLimitNote = ({ opensAt }: { opensAt: Date }) => {
  const bar = useTabBarLayout();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: bar.bottomOffset + bar.height + 10 }]} testID="host-limit-note">
      <InfoNotice message={hostLimitBanner(opensAt)} testID="host-limit-banner" />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16 },
});
