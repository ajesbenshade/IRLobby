import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import { View } from '@components/RNCompat';
import {
  DISABLED_FILL,
  DISABLED_TEXT,
  PILL_BURGUNDY,
  PILL_INK,
  PILL_WHITE,
} from '@foyer/buttonTokens';
import { RSVP_CHOOSE_PEOPLE_MESSAGE } from '@foyer/logic';
import { TIGHT_CHROME_MAX_FONT_SCALE } from '@navigation/tabBarLayout';
import { appColors, appTypography } from '@theme/index';

/** Cream paper tone from the Foyer palette; high contrast on burgundy (about 7:1). */
export const CREAM = '#f6f1ee';

/**
 * Every state of the primary Discover button (Design frame 141). `join` and `request` are burgundy with white
 * text; `askAgain` is a burgundy outline on white; `sent` is the rose disabled pill; the rest are the grey disabled pill.
 */
export type GoingKind = 'join' | 'request' | 'askAgain' | 'sent' | 'closed' | 'full' | 'cancelled';

export const FILLED_GOING_KINDS: GoingKind[] = ['join', 'request'];

export const isFilledGoingKind = (kind: GoingKind) => FILLED_GOING_KINDS.includes(kind);

/** Tappable states: the two filled ones and Ask again. */
export const isTappableGoingKind = (kind: GoingKind) => kind === 'join' || kind === 'request' || kind === 'askAgain';

export type SwipeButtonColors = { backgroundColor: string; borderColor: string; borderWidth: number; textColor: string };

export const SENT_FILL = '#e9c9d3';
export const SENT_TEXT = '#7a1a3f';

/**
 * Literal colours, applied inline as plain strings, and the fill and label colour always come from the same
 * table row. A TestFlight build showed `Request to join` as white text on the beige card because this fill came
 * from a Pressable style *callback* plus theme lookups; a dropped fill leaves the label white over the card.
 * Mirrors PillButton's fix.
 */
export const swipeGoingColors = (kind: GoingKind, pressed = false): SwipeButtonColors => {
  switch (kind) {
    case 'join':
    case 'request':
      return {
        backgroundColor: pressed ? '#870234' : PILL_BURGUNDY,
        borderColor: pressed ? '#870234' : PILL_BURGUNDY,
        borderWidth: 0,
        textColor: PILL_WHITE,
      };
    case 'askAgain':
      return {
        backgroundColor: pressed ? '#f3dde5' : PILL_WHITE,
        borderColor: PILL_BURGUNDY,
        borderWidth: 1.6,
        textColor: PILL_BURGUNDY,
      };
    case 'sent':
      return { backgroundColor: SENT_FILL, borderColor: SENT_FILL, borderWidth: 0, textColor: SENT_TEXT };
    default:
      return { backgroundColor: DISABLED_FILL, borderColor: DISABLED_FILL, borderWidth: 0, textColor: DISABLED_TEXT };
  }
};

export const swipePassColors = (pressed = false): SwipeButtonColors => ({
  backgroundColor: pressed ? '#f6f1ee' : PILL_WHITE,
  borderColor: '#c8beba',
  borderWidth: 1.2,
  textColor: PILL_INK,
});

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
  /** Which state the primary button is in. Defaults to `join`, or a grey state when `goingDisabled`. */
  goingKind?: GoingKind;
};

/**
 * Real, always-visible Pass / I'm going buttons for the Discover card. They call
 * the same handlers as the swipe gesture, so the gesture is only a shortcut.
 */
export const SwipeActionButtons = ({
  onPass,
  onGoing,
  disabled = false,
  error,
  goingLabel = "I'm going",
  goingDisabled = false,
  goingKind,
}: SwipeActionButtonsProps) => {
  const [passPressed, setPassPressed] = useState(false);
  const [goingPressed, setGoingPressed] = useState(false);
  const kind: GoingKind = goingKind ?? (goingDisabled ? 'closed' : 'join');
  const goingInactive = disabled || goingDisabled || !isTappableGoingKind(kind);
  const going = swipeGoingColors(kind, goingPressed && !goingInactive);
  const pass = swipePassColors(passPressed && !disabled);
  const quiet = !isTappableGoingKind(kind);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pass"
          accessibilityHint="Skips this gathering and shows the next one"
          accessibilityState={{ disabled }}
          testID="swipe-pass"
          disabled={disabled}
          onPress={onPass}
          onPressIn={() => setPassPressed(true)}
          onPressOut={() => setPassPressed(false)}
          style={[
            styles.button,
            styles.passWidth,
            { backgroundColor: pass.backgroundColor, borderColor: pass.borderColor, borderWidth: pass.borderWidth, opacity: disabled ? 0.5 : 1 },
          ]}
        >
          <Text maxFontSizeMultiplier={TIGHT_CHROME_MAX_FONT_SCALE} style={[styles.label, { color: pass.textColor }]}>
            Pass
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={goingLabel}
          accessibilityHint="Opens the list of who is coming, then confirms your RSVP"
          accessibilityState={{ disabled: goingInactive }}
          testID="swipe-going"
          disabled={goingInactive}
          onPress={onGoing}
          onPressIn={() => setGoingPressed(true)}
          onPressOut={() => setGoingPressed(false)}
          style={[
            styles.button,
            {
              backgroundColor: going.backgroundColor,
              borderColor: going.borderColor,
              borderWidth: going.borderWidth,
              // An in-flight request dims the filled button but never removes its fill.
              opacity: disabled && !quiet ? 0.5 : 1,
            },
          ]}
        >
          <Text maxFontSizeMultiplier={TIGHT_CHROME_MAX_FONT_SCALE} style={[styles.label, { color: going.textColor }]}>
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
};

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  row: { flexDirection: 'row', gap: 8 },
  /** Pass 110pt + primary pill (about 240pt on a 390pt screen) so 'This gathering was cancelled' fits at 15pt. */
  passWidth: { flex: 0, width: 110, paddingHorizontal: 8 },
  button: {
    flex: 1,
    minHeight: 54,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: appTypography.bodySemibold,
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
  },
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
