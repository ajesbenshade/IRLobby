import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { View } from '@components/RNCompat';
import { appColors, appTypography, radii, shadows, spacing } from '@theme/index';

type AuthSignInToastProps = {
  visible: boolean;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
};

export const AuthSignInToast = ({
  visible,
  title,
  body,
  actionLabel,
  onAction,
}: AuthSignInToastProps) => {
  const insets = useSafeAreaInsets();

  if (!visible) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { paddingBottom: Math.max(insets.bottom, spacing.md) },
      ]}
    >
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${title} ${body}`}
        style={styles.toast}
      >
        <View style={styles.icon} accessibilityElementsHidden>
          <Text style={styles.iconMark}>!</Text>
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          hitSlop={8}
          style={({ pressed }) => [styles.action, pressed ? styles.actionPressed : null]}
        >
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF8F4',
    borderRadius: radii.xl,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(226, 84, 56, 0.16)',
    ...shadows.float,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: appColors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconMark: {
    color: appColors.white,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: appColors.ink,
    fontFamily: appTypography.bodySemibold,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  body: {
    color: appColors.mutedInk,
    fontFamily: appTypography.bodyMedium,
    fontSize: 14,
    lineHeight: 18,
  },
  action: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionLabel: {
    color: appColors.primaryDeep,
    fontFamily: appTypography.bodySemibold,
    fontSize: 15,
    fontWeight: '700',
  },
});
