import { Pressable, StyleSheet } from 'react-native';

import { View } from '@components/RNCompat';
import type { PaywallFrame } from '@constants/iap';
import { appColors, radii, shadows } from '@theme/index';

import { PaywallContent } from './PaywallContent';

type PaywallSheetProps = {
  visible: boolean;
  frame: PaywallFrame;
  onDismiss: () => void;
};

/**
 * Dismissible bottom sheet that overlays the current tab.
 * The floating tab bar stays tappable so Home / Discover navigation is never hard-blocked.
 */
export const PaywallSheet = ({ visible, frame, onDismiss }: PaywallSheetProps) => {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss paywall"
        onPress={onDismiss}
        style={styles.backdrop}
      />
      <View style={styles.sheet}>
        <PaywallContent frame={frame} onDismiss={onDismiss} />
      </View>
    </View>
  );
};

const TAB_BAR_CLEARANCE = 86;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    bottom: TAB_BAR_CLEARANCE,
    backgroundColor: appColors.overlay,
  },
  sheet: {
    marginHorizontal: 12,
    marginBottom: TAB_BAR_CLEARANCE,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    borderRadius: radii.xl,
    backgroundColor: appColors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
    ...shadows.card,
  },
});
