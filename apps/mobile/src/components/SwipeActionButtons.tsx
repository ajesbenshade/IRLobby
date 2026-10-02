import { Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import { View } from '@components/RNCompat';
import { RSVP_CHOOSE_PEOPLE_MESSAGE } from '@foyer/logic';
import { TIGHT_CHROME_MAX_FONT_SCALE } from '@navigation/tabBarLayout';
import { appColors, appTypography } from '@theme/index';

/** Cream paper tone from the Foyer palette; high contrast on burgundy (about 7:1). */
export const CREAM = '#f6f1ee';

type SwipeActionButtonsProps = {
  onPass: () => void;
  onGoing: () => void;
  /** Disables both buttons (an RSVP request is in flight). */
  disabled?: boolean;
  /** Inline error from the last attempt. Shown above the helper line. */
  error?: string | null;
  /** Require approval: `Request to join` / `Ask again` (default `I'm going`). */
  goingLabel?: string;
  /** `Request sent` / `Request closed` are not tappable. */
  goingDisabled?: boolean;
};

/**
 * Real, always-visible Pass / I'm going buttons for the Discover card. They call
 * the same handlers as the swipe gesture, so the gesture is only a shortcut.
 */
export const SwipeActionButtons = ({ onPass, onGoing, disabled = false, error, goingLabel = "I'm going", goingDisabled = false }: SwipeActionButtonsProps) => (
  <View style={styles.wrap}>
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Pass"
        accessibilityHint="Skips this gathering and shows the next one"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPass}
        style={({ pressed }) => [
          styles.button,
          styles.pass,
          disabled ? styles.disabled : null,
          pressed ? styles.pressed : null,
        ]}
      >
        <Text maxFontSizeMultiplier={TIGHT_CHROME_MAX_FONT_SCALE} style={[styles.label, styles.passLabel]}>
          Pass
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={goingLabel}
        accessibilityHint="Opens the list of who is coming, then confirms your RSVP"
        accessibilityState={{ disabled: disabled || goingDisabled }}
        disabled={disabled || goingDisabled}
        onPress={onGoing}
        style={({ pressed }) => [
          styles.button,
          styles.going,
          goingDisabled ? styles.goingClosed : disabled ? styles.disabled : null,
          pressed ? styles.pressed : null,
        ]}
      >
        <Text maxFontSizeMultiplier={TIGHT_CHROME_MAX_FONT_SCALE} style={[styles.label, goingDisabled ? styles.goingClosedLabel : styles.goingLabel]}>
          {goingLabel}
        </Text>
      </Pressable>
    </View>
    {error ? (
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
        {error}
      </Text>
    ) : null}
    <Text style={styles.helper}>{RSVP_CHOOSE_PEOPLE_MESSAGE}</Text>
  </View>
);

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  row: { flexDirection: 'row', gap: 12 },
  button: {
    flex: 1,
    minHeight: 54,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pass: {
    backgroundColor: CREAM,
    borderWidth: 1.5,
    borderColor: appColors.ink,
  },
  going: {
    backgroundColor: appColors.primary,
    borderWidth: 1.5,
    borderColor: appColors.primary,
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  goingClosed: { backgroundColor: '#e1dbd7', borderColor: '#e1dbd7' },
  goingClosedLabel: { color: '#7a7572' },
  label: {
    fontFamily: appTypography.bodySemibold,
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'center',
  },
  passLabel: { color: appColors.ink },
  goingLabel: { color: CREAM },
  error: {
    color: appColors.danger,
    fontFamily: appTypography.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  helper: {
    color: appColors.mutedInk,
    fontFamily: appTypography.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
