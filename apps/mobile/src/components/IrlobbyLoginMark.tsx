import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { View } from '@components/RNCompat';
import { appColors, appTypography, brand, fontSize } from '@theme/index';

type IrlobbyLoginMarkProps = {
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  inverted?: boolean;
};

export const IrlobbyLoginMark = ({
  size = 'lg',
  style,
  inverted = false,
}: IrlobbyLoginMarkProps) => {
  const bubbleSize = size === 'lg' ? 52 : 36;
  const dotSize = size === 'lg' ? 7 : 5;

  return (
    <View style={[styles.wrap, style]} accessibilityRole="image" accessibilityLabel={brand.name}>
      <View
        style={[
          styles.bubble,
          {
            width: bubbleSize,
            height: bubbleSize,
            borderRadius: bubbleSize * 0.42,
          },
          inverted ? styles.bubbleInverted : null,
        ]}
      >
        <View
          style={[
            styles.dot,
            { width: dotSize, height: dotSize },
            inverted ? styles.dotInverted : null,
          ]}
        />
        <View
          style={[
            styles.dot,
            { width: dotSize, height: dotSize },
            inverted ? styles.dotInverted : null,
          ]}
        />
        <View
          style={[
            styles.dot,
            { width: dotSize, height: dotSize },
            inverted ? styles.dotInverted : null,
          ]}
        />
      </View>
      <View style={styles.copy}>
        <Text
          style={[
            styles.wordmark,
            size === 'md' ? styles.wordmarkMd : null,
            inverted ? styles.wordmarkInverted : null,
          ]}
        >
          {brand.name}
        </Text>
        <Text style={[styles.church, inverted ? styles.churchInverted : null]}>{brand.church}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bubble: {
    backgroundColor: appColors.primaryGlow,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  bubbleInverted: {
    backgroundColor: appColors.white,
  },
  dot: {
    borderRadius: 99,
    backgroundColor: appColors.white,
  },
  dotInverted: {
    backgroundColor: appColors.primary,
  },
  copy: {
    gap: 2,
  },
  wordmark: {
    fontFamily: appTypography.headingDisplay,
    fontSize: fontSize.wordmark,
    lineHeight: 32,
    color: appColors.primary,
    fontWeight: '700',
  },
  wordmarkMd: {
    fontSize: 22,
    lineHeight: 28,
  },
  wordmarkInverted: {
    color: appColors.white,
  },
  church: {
    fontFamily: appTypography.bodyMedium,
    fontSize: 13,
    color: appColors.mutedInk,
  },
  churchInverted: {
    color: 'rgba(255,255,255,0.82)',
  },
});
