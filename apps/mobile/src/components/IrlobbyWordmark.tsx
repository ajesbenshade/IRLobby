import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { View } from '@components/RNCompat';
import { appColors, appTypography, brand, fontSize } from '@theme/index';

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
  const iconSize = size === 'sm' ? 16 : 20;
  return (
    <View style={[styles.row, style]}>
      <MaterialCommunityIcons name="palm-tree" size={iconSize} color={color} />
      <Text style={[styles.mark, size === 'sm' ? styles.markSm : null, { color }, textStyle]}>
        {brand.name}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mark: {
    fontFamily: appTypography.heading,
    fontSize: fontSize.wordmark,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  markSm: {
    fontSize: 14,
  },
});
