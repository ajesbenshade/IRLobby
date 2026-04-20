import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Text } from 'react-native-paper';

import { Text as NativeText, View } from '@components/RNCompat';
import { appColors, palette, radii, spacing } from '@theme/index';

type MatchCelebrationProps = {
  visible: boolean;
  message?: string;
  onDismiss: () => void;
};

/**
 * Full-screen celebratory overlay shown when a swipe results in a match.
 * Uses a gradient backdrop, scaling sparkle text, and success haptic.
 */
export const MatchCelebration = ({ visible, message, onDismiss }: MatchCelebrationProps) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      scale.setValue(0.6);
      return;
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale, visible]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View style={[styles.overlay, { opacity }]} pointerEvents="auto">
      <Pressable style={styles.backdropPressable} onPress={onDismiss}>
        <LinearGradient
          colors={[palette.primary, palette.primaryDeep, palette.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
            <NativeText style={styles.sparkle}>✨</NativeText>
            <Text variant="displaySmall" style={styles.headline}>
              It’s a match!
            </Text>
            <Text style={styles.subline}>{message ?? 'Say hi in chat.'}</Text>
            <NativeText style={styles.tap}>Tap anywhere to continue</NativeText>
          </Animated.View>
        </LinearGradient>
      </Pressable>
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
  backdropPressable: {
    flex: 1,
  },
  gradient: {
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
  },
  sparkle: {
    fontSize: 64,
    marginBottom: spacing.xs,
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
  tap: {
    color: appColors.white,
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.7,
    marginTop: spacing.lg,
  },
});
