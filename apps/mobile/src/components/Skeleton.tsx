import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, type ViewStyle } from 'react-native';

import { appColors, radii } from '@theme/index';

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle | ViewStyle[];
};

/**
 * Animated shimmer placeholder. Use in place of spinners while content loads.
 */
export const Skeleton = ({ width = '100%', height = 16, radius = radii.sm, style }: SkeletonProps) => {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        { width: width as number, height, borderRadius: radius, opacity },
        style as ViewStyle,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: appColors.cardStrong,
  },
});
