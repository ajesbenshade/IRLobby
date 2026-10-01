import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';

import { ScrollView, View } from '@components/RNCompat';
import { useSheetBottomPadding } from '@navigation/tabBarLayout';
import { appColors, radii } from '@theme/index';

type SheetScaffoldProps = PropsWithChildren<{
  /** Pinned under the scrolling body (primary buttons), always above the home indicator. */
  footer?: ReactNode;
}>;

/**
 * Shared bottom-sheet frame: rounded paper sheet whose body scrolls when the
 * content outgrows the screen (largest Dynamic Type, long titles) while the
 * footer stays reachable above the safe area. Nothing in a sheet has a fixed height.
 */
export const SheetScaffold = ({ children, footer }: SheetScaffoldProps) => {
  const { height } = useWindowDimensions();
  const bottomPadding = useSheetBottomPadding();

  return (
    <View style={[styles.sheet, { maxHeight: Math.round(height * 0.9) }]}>
      <View style={styles.handle} />
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {footer ? <View style={[styles.footer, { paddingBottom: bottomPadding }]}>{footer}</View> : (
        <View style={{ height: bottomPadding - 8 }} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: appColors.white,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: appColors.line,
    marginBottom: 10,
  },
  body: {
    flexShrink: 1,
  },
  bodyContent: {
    gap: 12,
    paddingBottom: 8,
  },
  footer: {
    paddingTop: 8,
    gap: 8,
  },
});
