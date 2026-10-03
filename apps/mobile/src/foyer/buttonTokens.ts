/** Disabled and pressed colours from the design spec "button-states". */
export const DISABLED_FILL = '#e1dbd7';
export const DISABLED_OUTLINE_FILL = '#f3f0ee';
export const DISABLED_OUTLINE = '#cec8c4';
export const DISABLED_TEXT = '#7a7572';
export const PRESSED_TINT = '#f9e8ee';
export const MIN_TARGET = 54;

/**
 * Literal hex values for the filled pills. They are deliberately NOT read from the theme or from a
 * Pressable style callback: a TestFlight build showed confirm buttons as white text on a white
 * background, so the fill is applied inline as a plain colour string and unit-tested.
 */
export const PILL_BURGUNDY = '#a2033f';
export const PILL_BURGUNDY_PRESSED = '#870234';
export const PILL_DESTRUCTIVE = '#8a0a1f';
export const PILL_DESTRUCTIVE_PRESSED = '#680617';
export const PILL_WHITE = '#ffffff';
export const PILL_INK = '#222222';
export const PILL_CREAM = '#f6f1ee';


/**
 * Shared OFF-state colours for every Switch, Checkbox and Radio (design spec "Toggle off-state (Oct 2 eve)", frame 237).
 * #857f7a is 3.53:1 on cream and 3.95:1 on white, which clears WCAG 1.4.11 (3:1 for UI components).
 */
export const TOGGLE_OFF = '#857f7a';
export const TOGGLE_OFF_DISABLED = '#c9c3bf';
export const TOGGLE_ON = '#a2033f';
export const TOGGLE_ON_DISABLED = 'rgba(162, 3, 63, 0.5)';
export const TOGGLE_THUMB = '#ffffff';
export const TOGGLE_BORDER_WIDTH = 2;
export const TOGGLE_DISABLED_LABEL_OPACITY = 0.5;
export const SWITCH_WIDTH = 51;
export const SWITCH_HEIGHT = 31;
export const SWITCH_ROW_MIN_HEIGHT = 48;
