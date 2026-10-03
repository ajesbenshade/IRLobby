import { StyleSheet, Switch as NativeSwitch, type StyleProp, type ViewStyle } from 'react-native';

import { View } from '@components/RNCompat';
import {
  SWITCH_HEIGHT,
  SWITCH_WIDTH,
  TOGGLE_OFF,
  TOGGLE_OFF_DISABLED,
  TOGGLE_ON,
  TOGGLE_ON_DISABLED,
  TOGGLE_THUMB,
} from '@foyer/buttonTokens';

export type SwitchColors = {
  trackColor: { false: string; true: string };
  thumbColor: string;
  ios_backgroundColor: string;
};

/** Pure colour table (unit-tested). Disabled OFF is a paler track; disabled ON is burgundy at 50%. */
export const switchColors = (disabled?: boolean): SwitchColors => ({
  trackColor: disabled ? { false: TOGGLE_OFF_DISABLED, true: TOGGLE_ON_DISABLED } : { false: TOGGLE_OFF, true: TOGGLE_ON },
  thumbColor: TOGGLE_THUMB,
  ios_backgroundColor: disabled ? TOGGLE_OFF_DISABLED : TOGGLE_OFF,
});

type Props = {
  value: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * THE Switch for the whole app. Every screen uses this one component so the OFF track is always visible on cream and white
 * (the stock iOS grey disappeared). 51 x 31, track #857f7a OFF / #a2033f ON, white thumb. Do not import Switch from
 * react-native or react-native-paper anywhere else (a Jest test enforces that).
 */
export const Switch = ({ value, onValueChange, disabled, accessibilityLabel, testID, style }: Props) => {
  const colors = switchColors(disabled);
  return (
    <View style={[styles.box, style]}>
      <NativeSwitch
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={colors.trackColor}
        thumbColor={colors.thumbColor}
        ios_backgroundColor={colors.ios_backgroundColor}
        style={styles.native}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  box: { width: SWITCH_WIDTH, height: SWITCH_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  native: { elevation: 1 },
});
