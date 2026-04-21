import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Text as NativeText, View } from '@components/RNCompat';
import { appColors, radii, spacing } from '@theme/index';

interface VibeOptionCardProps {
  emoji: string;
  label: string;
  helper?: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  style?: ViewStyle;
}

export const VibeOptionCard = ({
  emoji,
  label,
  helper,
  selected,
  disabled = false,
  onPress,
  style,
}: VibeOptionCardProps) => {
  const scale = useSharedValue(1);
  const glow = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    glow.value = withTiming(selected ? 1 : 0, { duration: 220, easing: Easing.out(Easing.quad) });
  }, [glow, selected]);

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 14, stiffness: 220 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 14, stiffness: 220 });
  };

  const handlePress = () => {
    if (disabled) return;
    void Haptics.impactAsync(
      selected ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
    );
    scale.value = withSequence(
      withTiming(1.04, { duration: 100, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 14, stiffness: 220 }),
    );
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderColor: interpolateColor(
      glow.value,
      [0, 1],
      [appColors.line, appColors.primary],
    ),
    shadowOpacity: 0.05 + glow.value * 0.25,
    shadowRadius: 6 + glow.value * 14,
  }));

  const innerHighlightStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
  }));

  return (
    <Animated.View style={[styles.card, animatedStyle, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected, disabled }}
        accessibilityLabel={label}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={({ pressed }) => [styles.pressable, pressed ? styles.pressed : null]}
      >
        <Animated.View pointerEvents="none" style={[styles.glowOverlay, innerHighlightStyle]} />
        <View style={styles.row}>
          <NativeText style={styles.emoji}>{emoji}</NativeText>
          <View style={styles.copy}>
            <NativeText style={[styles.label, selected ? styles.labelSelected : null]}>
              {label}
            </NativeText>
            {helper ? <NativeText style={styles.helper}>{helper}</NativeText> : null}
          </View>
          <View
            style={[styles.checkDot, selected ? styles.checkDotSelected : null]}
            accessibilityElementsHidden
          >
            {selected ? <NativeText style={styles.checkDotMark}>✓</NativeText> : null}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

interface VibeProgressBarProps {
  current: number;
  total: number;
}

export const VibeProgressBar = ({ current, total }: VibeProgressBarProps) => {
  const target = useMemo(() => (total <= 0 ? 0 : Math.min(1, current / total)), [current, total]);
  const fill = useSharedValue(target);

  useEffect(() => {
    fill.value = withTiming(target, { duration: 320, easing: Easing.out(Easing.cubic) });
  }, [fill, target]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.round(fill.value * 100)}%`,
  }));

  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, fillStyle]} />
      </View>
      <NativeText style={styles.progressLabel}>
        {Math.min(current, total)} / {total}
      </NativeText>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    backgroundColor: appColors.card,
    borderWidth: 2,
    borderColor: appColors.line,
    shadowColor: appColors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  pressable: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  pressed: {
    opacity: 0.96,
  },
  glowOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: appColors.primarySoft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  emoji: {
    fontSize: 30,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: appColors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  labelSelected: {
    color: appColors.primaryDeep,
  },
  helper: {
    color: appColors.mutedInk,
    fontSize: 13,
    fontWeight: '500',
  },
  checkDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: appColors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDotSelected: {
    backgroundColor: appColors.primary,
    borderColor: appColors.primary,
  },
  checkDotMark: {
    color: appColors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: appColors.line,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: appColors.primary,
    borderRadius: 999,
  },
  progressLabel: {
    minWidth: 38,
    textAlign: 'right',
    color: appColors.mutedInk,
    fontWeight: '700',
    fontSize: 12,
  },
});
