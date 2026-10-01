import { useContext } from 'react';
import { useWindowDimensions } from 'react-native';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Single source of truth for the floating Foyer tab bar geometry.
 *
 * `MainTabs` styles the bar from `getTabBarLayout`, and tab screens reserve
 * space beneath their content from the very same function, so the bar and the
 * scroll padding can never drift apart.
 */

/**
 * Height of the icon + label area that sits above the bottom safe-area inset.
 * Icon (20) + gap (1) + label line (13) = 34, leaving 8pt above and below.
 */
export const TAB_BAR_CONTENT_HEIGHT = 50;
/** Minimum clearance between the icon/label stack and the bar's top/bottom edge. */
export const TAB_BAR_MIN_LABEL_CLEARANCE = 8;
/** Minimum distance between the bar and the screen edge on devices with no inset. */
export const TAB_BAR_MIN_BOTTOM_OFFSET = 12;
/** Breathing room between the last piece of scroll content and the bar. */
export const TAB_BAR_CONTENT_GAP = 16;
/** Icon size drawn in each tab. */
export const TAB_ICON_SIZE = 20;
/** Label line height at 1x Dynamic Type, plus the 1pt gap under the icon. */
export const TAB_LABEL_LINE_HEIGHT = 13;
const TAB_LABEL_GAP = 1;
/** Tight chrome (tab labels, pills) stops scaling here; everything else grows with Dynamic Type. */
export const TIGHT_CHROME_MAX_FONT_SCALE = 1.4;
/** Minimum bottom padding for a bottom sheet or pinned footer, on top of the safe-area inset. */
export const SHEET_BOTTOM_GAP = 16;

export type TabBarLayout = {
  /** Height of the bar itself (the ~50pt area above the inset). */
  height: number;
  /** Distance from the bottom of the screen to the bottom of the bar. */
  bottomOffset: number;
  /** Bar height plus the inset it sits on (~84pt on a home-indicator iPhone). */
  totalHeight: number;
  /** Bottom padding scroll content needs so nothing hides behind the bar. */
  scrollBottomPadding: number;
};

export const getTabBarLayout = (bottomInset: number, fontScale = 1): TabBarLayout => {
  const inset = Math.max(0, bottomInset);
  // Tab labels cap their own scaling (see TIGHT_CHROME_MAX_FONT_SCALE), so the bar does too.
  const scale = Math.min(Math.max(fontScale, 1), TIGHT_CHROME_MAX_FONT_SCALE);
  // Grows with Dynamic Type so larger labels are never squeezed.
  const height = Math.max(
    TAB_BAR_CONTENT_HEIGHT,
    Math.ceil(
      TAB_BAR_MIN_LABEL_CLEARANCE * 2 + TAB_ICON_SIZE + TAB_LABEL_GAP + TAB_LABEL_LINE_HEIGHT * scale,
    ),
  );
  const bottomOffset = Math.max(TAB_BAR_MIN_BOTTOM_OFFSET, inset);

  return {
    height,
    bottomOffset,
    totalHeight: height + inset,
    scrollBottomPadding: height + bottomOffset + TAB_BAR_CONTENT_GAP,
  };
};

/** Layout for the tab bar itself. Reads the bottom safe-area inset. */
export const useTabBarLayout = (): TabBarLayout => {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  return getTabBarLayout(insets.bottom, fontScale);
};

/**
 * Bottom padding a screen needs to clear the floating tab bar, or `undefined`
 * when the screen is not rendered inside the tab navigator (e.g. stack screens
 * pushed above the tabs, which have no bar to clear).
 */
export const useTabScreenBottomPadding = (): number | undefined => {
  const insideTabs = useContext(BottomTabBarHeightContext) !== undefined;
  const insets = useContext(SafeAreaInsetsContext);
  const { fontScale } = useWindowDimensions();

  if (!insideTabs) {
    return undefined;
  }
  return getTabBarLayout(insets?.bottom ?? 0, fontScale).scrollBottomPadding;
};

/** Bottom padding for a sheet or pinned footer so its last control clears the home indicator. */
export const getSheetBottomPadding = (bottomInset: number): number =>
  Math.max(0, bottomInset) + SHEET_BOTTOM_GAP;

/** Same as `getSheetBottomPadding`, reading the safe-area inset (0 when no provider is mounted). */
export const useSheetBottomPadding = (): number => {
  const insets = useContext(SafeAreaInsetsContext);
  return getSheetBottomPadding(insets?.bottom ?? 0);
};
