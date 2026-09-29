import { StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { View } from '@components/RNCompat';
import { appColors, appTypography } from '@theme/index';

type IrlobbyWordmarkProps = {
  color?: string;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export const IrlobbyWordmark = ({
  color = appColors.primary,
  size = 'md',
  style,
  textStyle,
}: IrlobbyWordmarkProps) => {
  return (
    <View style={[styles.wrap, style]} accessibilityRole="header" accessibilityLabel="The Foyer, Franconia Mennonite Church">
      <Text style={[styles.mark, size === 'sm' ? styles.markSm : null, { color }, textStyle]}>
        The Foyer
      </Text>
      <Text style={[styles.church, size === 'sm' ? styles.churchSm : null, { color }]}>
        Franconia Mennonite Church
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-start',
  },
  mark: {
    fontFamily: appTypography.heading,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  markSm: {
    fontSize: 16,
  },
  church: {
    marginTop: 1,
    fontSize: 11,
    letterSpacing: 0.2,
    opacity: 0.8,
  },
  churchSm: {
    fontSize: 9,
  },
});
