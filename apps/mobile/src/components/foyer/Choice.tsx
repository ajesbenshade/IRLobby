import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { View } from '@components/RNCompat';
import { PILL_BURGUNDY, TOGGLE_BORDER_WIDTH, TOGGLE_OFF } from '@foyer/buttonTokens';

/**
 * Shared Checkbox and Radio visuals (design spec frame 237). The unchecked / unselected edge is 2pt #857f7a on white so it
 * stays visible on cream and white. Checked = burgundy fill with a white tick; radio selected = burgundy ring + dot.
 * Radio keeps the same 22pt circle in both states so nothing shifts.
 */
export const CHECKBOX_SIZE = 22;
export const RADIO_SIZE = 22;

export const checkboxBoxStyle = (checked: boolean): ViewStyle =>
  checked
    ? { backgroundColor: PILL_BURGUNDY, borderColor: PILL_BURGUNDY, borderWidth: TOGGLE_BORDER_WIDTH }
    : { backgroundColor: '#ffffff', borderColor: TOGGLE_OFF, borderWidth: TOGGLE_BORDER_WIDTH };

export const radioRingStyle = (selected: boolean): ViewStyle =>
  selected
    ? { backgroundColor: '#ffffff', borderColor: PILL_BURGUNDY, borderWidth: TOGGLE_BORDER_WIDTH }
    : { backgroundColor: '#ffffff', borderColor: TOGGLE_OFF, borderWidth: TOGGLE_BORDER_WIDTH };

export const Checkbox = ({ checked, style, testID }: { checked: boolean; style?: StyleProp<ViewStyle>; testID?: string }) => (
  <View testID={testID} style={[styles.box, checkboxBoxStyle(checked), style]}>
    {checked ? <MaterialCommunityIcons name="check" size={16} color="#ffffff" /> : null}
  </View>
);

export const Radio = ({ selected, style, testID }: { selected: boolean; style?: StyleProp<ViewStyle>; testID?: string }) => (
  <View testID={testID} style={[styles.ring, radioRingStyle(selected), style]}>
    {selected ? <View style={styles.dot} /> : null}
  </View>
);

const styles = StyleSheet.create({
  box: { width: CHECKBOX_SIZE, height: CHECKBOX_SIZE, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  ring: { width: RADIO_SIZE, height: RADIO_SIZE, borderRadius: RADIO_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: PILL_BURGUNDY },
});
