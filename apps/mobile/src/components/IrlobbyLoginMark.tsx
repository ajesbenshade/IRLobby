import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { View } from '@components/RNCompat';
import { appColors, appTypography } from '@theme/index';

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
    <View style={[styles.wrap, style]} accessibilityRole="image" accessibilityLabel="IRLobby">
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
      <Text style={[styles.wordmark, size === 'md' ? styles.wordmarkMd : null]}>
        <Text style={[styles.ir, inverted ? styles.irInverted : null]}>IR</Text>
        <Text style={[styles.lobby, inverted ? styles.lobbyInverted : null]}>Lobby</Text>
      </Text>
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
  wordmark: {
    fontFamily: appTypography.headingDisplay,
    fontSize: 36,
    letterSpacing: -1.2,
  },
  wordmarkMd: {
    fontSize: 24,
    letterSpacing: -0.6,
  },
  ir: {
    color: appColors.primary,
    fontWeight: '800',
  },
  lobby: {
    color: appColors.ink,
    fontWeight: '800',
  },
  irInverted: {
    color: appColors.white,
  },
  lobbyInverted: {
    color: appColors.white,
  },
});
