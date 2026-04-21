import { useEffect, useMemo } from 'react';
import { Pressable, Share, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';
import { Text } from 'react-native-paper';

import { Text as NativeText, View } from '@components/RNCompat';
import { ConfettiBurst } from '@screens/main/vibeQuiz/ConfettiBurst';
import { appColors, palette, radii, spacing } from '@theme/index';

type MatchCelebrationProps = {
  visible: boolean;
  onDismiss: () => void;
  /** Headline copy override (defaults to "It's a match!"). */
  message?: string;
  /** Optional human name to personalize the subline ("You and {matchName}…"). */
  matchName?: string;
  /** Optional activity title shown beneath the headline. */
  activityTitle?: string;
  /** Optional callback wired to a primary CTA (e.g. open chat). */
  onPrimaryAction?: () => void;
  /** Label for the primary CTA when `onPrimaryAction` is provided. */
  primaryActionLabel?: string;
  /** When true, skip confetti + the looping heart pulse (entrance + haptics still play). */
  reducedMotion?: boolean;
};

const BACKDROP_GRADIENT: readonly [string, string, string] = [
  palette.primary,
  palette.primaryDeep,
  palette.accent,
];

const CTA_GRADIENT: readonly [string, string] = [palette.primary, palette.primaryDeep];

/**
 * Full-screen celebratory overlay shown when a swipe results in a match.
 *
 * Animation timeline (~600ms in, then idle pulse):
 *   0ms    – Heavy haptic + confetti burst + backdrop fade in
 *   ~150ms – Card spring overshoots to 1.15× then settles to 1×
 *   ~180ms – Medium haptic
 *   ~300ms – Heart emoji springs in and starts a slow pulse
 *   ~420ms – Success notification haptic
 *
 * Pure Reanimated v4 + the existing `ConfettiBurst` (no new native deps).
 * Backward compatible with callers that only pass `{ visible, message, onDismiss }`.
 */
export const MatchCelebration = ({
  visible,
  onDismiss,
  message,
  matchName,
  activityTitle,
  onPrimaryAction,
  primaryActionLabel = 'Start chatting',
  reducedMotion = false,
}: MatchCelebrationProps) => {
  const opacity = useSharedValue(0);
  const cardScale = useSharedValue(0.6);
  const heartScale = useSharedValue(0);

  // Tune the confetti volume on older devices to keep the animation buttery.
  // `Device.deviceYearClass` is `null` on web/simulators — coalesce to a modern
  // year so unknown devices keep the rich experience instead of dropping confetti.
  const confettiPieces = useMemo(() => {
    const yearClass = Device.deviceYearClass ?? 2020;
    return yearClass <= 2018 ? 45 : 75;
  }, []);

  useEffect(() => {
    if (!visible) {
      cancelAnimation(heartScale);
      opacity.value = 0;
      cardScale.value = 0.6;
      heartScale.value = 0;
      return;
    }

    // Multi-stage haptic sequence — feels physical without being obnoxious.
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const t1 = setTimeout(
      () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
      180,
    );
    const t2 = setTimeout(
      () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      420,
    );

    // Backdrop + card entrance.
    opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    cardScale.value = withSequence(
      withSpring(1.15, { damping: 6, stiffness: 140 }),
      withSpring(1, { damping: 10, stiffness: 120 }),
    );

    // Heart pops in slightly later. Skip the perpetual pulse when reduced motion
    // is requested so we don't run a looping animation on low-end / a11y users.
    heartScale.value = withDelay(
      300,
      reducedMotion
        ? withSpring(1, { damping: 8, stiffness: 140 })
        : withSequence(
            withSpring(1.2, { damping: 5, stiffness: 160 }),
            withRepeat(
              withSequence(
                withTiming(0.92, { duration: 700, easing: Easing.inOut(Easing.quad) }),
                withTiming(1.05, { duration: 700, easing: Easing.inOut(Easing.quad) }),
              ),
              -1,
              true,
            ),
          ),
    );

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [cardScale, heartScale, opacity, reducedMotion, visible]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }));

  if (!visible) {
    return null;
  }

  const subline = matchName
    ? `You and ${matchName} both swiped right!`
    : message ?? 'Say hi in chat.';

  const handlePrimary = () => {
    if (!onPrimaryAction) {
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPrimaryAction();
    onDismiss();
  };

  const canShare = Boolean(matchName);
  const handleShare = async () => {
    if (!canShare) return;
    try {
      void Haptics.selectionAsync();
      const tail = activityTitle ? ` for ${activityTitle}` : '';
      await Share.share({
        message: `Just matched with ${matchName} on IRLobby${tail}! 🎉`,
      });
    } catch {
      /* user cancelled or share unavailable — ignore */
    }
  };

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="auto">
      <LinearGradient
        colors={BACKDROP_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Confetti sits behind the card so it doesn't intercept taps. */}
        {reducedMotion ? null : (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <ConfettiBurst visible pieces={confettiPieces} />
          </View>
        )}

        {/* Tap-to-dismiss backdrop — wraps the card so any outside tap closes. */}
        <Pressable style={styles.backdropPressable} onPress={onDismiss}>
          <Animated.View style={[styles.card, cardStyle]}>
            <Animated.Text style={[styles.heart, heartStyle]}>❤️</Animated.Text>

            <Text
              variant="displaySmall"
              style={styles.headline}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              accessibilityLabel={
                matchName
                  ? `${message ?? "It's a match"} with ${matchName}`
                  : message ?? "It's a match!"
              }
            >
              {message ?? "It's a match!"}
            </Text>

            <Text style={styles.subline}>{subline}</Text>

            {activityTitle ? (
              <Text style={styles.activity}>
                Ready for{' '}
                <NativeText style={styles.activityHighlight}>{activityTitle}</NativeText>?
              </Text>
            ) : null}

            {onPrimaryAction ? (
              <View style={styles.actions}>
                <Pressable style={styles.ctaWrap} onPress={handlePrimary}>
                  <LinearGradient
                    colors={CTA_GRADIENT}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.ctaGradient}
                  >
                    <NativeText style={styles.ctaLabel}>💬 {primaryActionLabel}</NativeText>
                  </LinearGradient>
                </Pressable>
                <Pressable onPress={onDismiss} style={styles.secondaryBtn}>
                  <NativeText style={styles.secondaryLabel}>Maybe later</NativeText>
                </Pressable>
                {canShare ? (
                  <Pressable
                    onPress={() => void handleShare()}
                    style={styles.secondaryBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Share this match"
                  >
                    <NativeText style={styles.secondaryLabel}>📤 Share</NativeText>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <NativeText style={styles.tap}>Tap anywhere to continue</NativeText>
            )}
          </Animated.View>
        </Pressable>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    elevation: 999,
  },
  gradient: {
    flex: 1,
  },
  backdropPressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radii.xl,
    backgroundColor: 'rgba(255,255,255,0.12)',
    width: '100%',
    maxWidth: 420,
  },
  heart: {
    fontSize: 96,
    marginBottom: spacing.xs,
    textShadowColor: 'rgba(255, 90, 140, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  headline: {
    color: appColors.white,
    fontWeight: '900',
    letterSpacing: -1,
    textAlign: 'center',
  },
  subline: {
    color: appColors.white,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.95,
  },
  activity: {
    color: appColors.white,
    fontSize: 15,
    textAlign: 'center',
    opacity: 0.92,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  activityHighlight: {
    color: appColors.secondary,
    fontWeight: '800',
  },
  actions: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  ctaWrap: {
    width: '100%',
    borderRadius: radii.pill,
    overflow: 'hidden',
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    color: appColors.white,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  secondaryBtn: {
    paddingVertical: spacing.sm,
  },
  secondaryLabel: {
    color: appColors.white,
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.75,
  },
  tap: {
    color: appColors.white,
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.7,
    marginTop: spacing.lg,
  },
});
