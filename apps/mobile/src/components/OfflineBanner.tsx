import { StyleSheet } from 'react-native';

import { Text as NativeText, View } from '@components/RNCompat';
import { useOnline } from '@hooks/useOnline';
import { appColors, radii, spacing } from '@theme/index';

export interface OfflineBannerProps {
  /** Override the default message. */
  message?: string;
}

/**
 * Compact warning banner that renders only when the device is offline.
 * Safe to mount unconditionally — returns `null` when online.
 */
export const OfflineBanner = ({
  message = "You're offline — showing cached results.",
}: OfflineBannerProps) => {
  const online = useOnline();
  if (online) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel="Offline mode"
      style={styles.banner}
    >
      <NativeText style={styles.bannerText}>{message}</NativeText>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: appColors.warning,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  bannerText: {
    color: appColors.ink,
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
});
