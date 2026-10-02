import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { safeImpactHaptic } from '@lib/haptics';
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

/** Pill sizing from the design spec ("Vibe Quiz pills"). Exported so tests can assert the rules. */
export const VIBE_PILL = {
  minHeight: 52,
  radius: 26,
  gap: 12,
  unselectedBorder: 'rgba(34, 34, 34, 0.2)',
  selectedFill: '#a2033f',
  selectedText: '#f6f1ee',
  unselectedFill: '#f6f1ee',
} as const;

/**
 * One answer pill. Full width of the card's inner content (alignSelf: 'stretch',
 * no fixed width), wraps to two lines at large text, never offset left or right.
 */
export const VibeOptionCard = ({
  emoji,
  label,
  helper,
  selected,
  disabled = false,
  onPress,
  style,
}: VibeOptionCardProps) => {
  const handlePress = () => {
    if (disabled) return;
    void safeImpactHaptic(selected ? 'light' : 'medium');
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pill,
        selected ? styles.pillSelected : styles.pillUnselected,
        pressed ? styles.pressed : null,
        style,
      ]}
    >
      <NativeText style={styles.emoji}>{emoji}</NativeText>
      <View style={styles.copy}>
        <NativeText style={[styles.label, selected ? styles.labelSelected : null]}>{label}</NativeText>
        {helper ? (
          <NativeText style={[styles.helper, selected ? styles.helperSelected : null]}>{helper}</NativeText>
        ) : null}
      </View>
    </Pressable>
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
  pill: {
    alignSelf: 'stretch',
    minHeight: VIBE_PILL.minHeight,
    borderRadius: VIBE_PILL.radius,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pillSelected: {
    backgroundColor: VIBE_PILL.selectedFill,
    borderColor: VIBE_PILL.selectedFill,
  },
  pillUnselected: {
    backgroundColor: VIBE_PILL.unselectedFill,
    borderColor: VIBE_PILL.unselectedBorder,
  },
  pressed: {
    opacity: 0.9,
  },
  emoji: {
    fontSize: 24,
  },
  copy: {
    flex: 1,
    flexShrink: 1,
    gap: 2,
  },
  label: {
    color: appColors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    flexShrink: 1,
  },
  labelSelected: {
    color: VIBE_PILL.selectedText,
  },
  helper: {
    color: appColors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  helperSelected: {
    color: VIBE_PILL.selectedText,
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
