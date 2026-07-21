import { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { View } from '@components/RNCompat';
import { appColors } from '@theme/index';

interface ConfettiBurstProps {
  visible: boolean;
  pieces?: number;
}

interface Piece {
  id: number;
  startX: number;
  endX: number;
  endY: number;
  rotation: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
}

const COLORS = [
  appColors.primary,
  appColors.primaryGlow,
  appColors.secondary,
  appColors.accent,
  appColors.success,
];

const random = (min: number, max: number) => min + Math.random() * (max - min);

const ConfettiPiece = ({ piece, visible }: { piece: Piece; visible: boolean }) => {
  const translateX = useSharedValue(piece.startX);
  const translateY = useSharedValue(-30);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      opacity.value = 0;
      translateX.value = piece.startX;
      translateY.value = -30;
      rotate.value = 0;
      return;
    }
    opacity.value = withDelay(piece.delay, withTiming(1, { duration: 80 }));
    translateX.value = withDelay(
      piece.delay,
      withTiming(piece.endX, { duration: piece.duration, easing: Easing.out(Easing.quad) }),
    );
    translateY.value = withDelay(
      piece.delay,
      withTiming(piece.endY, { duration: piece.duration, easing: Easing.in(Easing.quad) }),
    );
    rotate.value = withDelay(
      piece.delay,
      withTiming(piece.rotation, { duration: piece.duration, easing: Easing.linear }),
    );
  }, [opacity, piece, rotate, translateX, translateY, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.piece,
        animatedStyle,
        {
          backgroundColor: piece.color,
          width: piece.size,
          height: piece.size * 0.4,
        },
      ]}
    />
  );
};

export const ConfettiBurst = ({ visible, pieces = 80 }: ConfettiBurstProps) => {
  const window = Dimensions.get('window');
  const items = useMemo<Piece[]>(() => {
    return new Array(pieces).fill(0).map((_, index) => {
      const startX = random(0, window.width);
      return {
        id: index,
        startX,
        endX: startX + random(-window.width / 2, window.width / 2),
        endY: window.height + 80,
        rotation: random(-540, 540),
        delay: Math.floor(random(0, 320)),
        duration: Math.floor(random(1400, 2400)),
        color: COLORS[index % COLORS.length],
        size: random(8, 14),
      };
    });
    // Re-roll pieces whenever visibility flips so each burst feels fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieces, visible, window.height, window.width]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {items.map((piece) => (
        <ConfettiPiece key={piece.id} piece={piece} visible={visible} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  piece: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 2,
  },
});
