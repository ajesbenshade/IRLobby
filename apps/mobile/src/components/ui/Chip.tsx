import { Pressable, StyleSheet, Text } from 'react-native';

import { appColors, radii } from '@theme/index';

type ChipTone = 'neutral' | 'primary' | 'gold';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: ChipTone;
};

export const Chip = ({
  label,
  selected = false,
  onPress,
  tone = 'neutral',
}: ChipProps) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={({ pressed }) => [
      styles.chip,
      selected && tone === 'neutral' ? styles.selected : null,
      selected && tone === 'primary' ? styles.selectedPrimary : null,
      selected && tone === 'gold' ? styles.selectedGold : null,
      tone === 'gold' && !selected ? styles.goldIdle : null,
      pressed ? styles.pressed : null,
    ]}
  >
    <Text
      style={[
        styles.label,
        selected ? styles.labelSelected : null,
        tone === 'gold' ? styles.labelGold : null,
      ]}
    >
      {label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: appColors.cardStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
  },
  selected: {
    backgroundColor: appColors.primaryWash,
    borderColor: appColors.primaryWashStrong,
  },
  selectedPrimary: {
    backgroundColor: appColors.primary,
    borderColor: appColors.primary,
  },
  selectedGold: {
    backgroundColor: 'rgba(232, 200, 114, 0.16)',
    borderColor: appColors.accent,
  },
  goldIdle: {
    borderColor: 'rgba(232, 200, 114, 0.35)',
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    color: appColors.mutedInk,
    fontSize: 13,
    fontWeight: '600',
  },
  labelSelected: {
    color: appColors.ink,
  },
  labelGold: {
    color: appColors.accent,
  },
});
