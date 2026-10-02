import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { View } from '@components/RNCompat';
import { COMMON_COPY, PHOTO_COPY } from '@constants/foyerCopy';
import { PILL_BURGUNDY, PILL_BURGUNDY_PRESSED, PILL_INK, PILL_WHITE } from '@foyer/buttonTokens';
import { appTypography } from '@theme/index';

/** Photos page bottom bar (Design frames 148-153): pills 48pt, 12pt above and below, plus the home-indicator inset. */
export const PHOTO_PILL_HEIGHT = 48;
export const PHOTO_BAR_PADDING = 12;
export const PHOTO_BAR_HEIGHT = PHOTO_PILL_HEIGHT + PHOTO_BAR_PADDING * 2;

/** Scroll content bottom padding so the last row clears the bar: bar height + bottom safe area + 16. */
export const photoScrollPadding = (bottomInset: number) => PHOTO_BAR_HEIGHT + bottomInset + 16;

/** Where a toast sits: 12pt above the bar. */
export const photoToastBottom = (bottomInset: number) => PHOTO_BAR_HEIGHT + bottomInset + PHOTO_BAR_PADDING;

const DISABLED_BORDER = '#c9c4c1';
const DISABLED_LABEL = '#96918e';
const PRESSED_FILL = '#f6f1ee';

type PillProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  filled?: boolean;
  testID?: string;
};

/**
 * One outlined stadium pill: white fill, 1pt ink outline, ink Inter 600 15pt label. All colours are literal and applied inline
 * (no Pressable style callback), so a fill can never be dropped. `filled` is the burgundy `Download (3)` with white text.
 */
export const BarPill = ({ label, onPress, disabled = false, loading = false, filled = false, testID }: PillProps) => {
  const [pressed, setPressed] = useState(false);
  const inactive = disabled || loading;
  const isPressed = pressed && !inactive;
  const backgroundColor = filled
    ? inactive && !loading
      ? '#e1dbd7'
      : isPressed
        ? PILL_BURGUNDY_PRESSED
        : PILL_BURGUNDY
    : isPressed
      ? PRESSED_FILL
      : PILL_WHITE;
  const borderColor = filled ? backgroundColor : inactive && !loading ? DISABLED_BORDER : PILL_INK;
  const color = filled ? (inactive && !loading ? '#7a7572' : PILL_WHITE) : inactive && !loading ? DISABLED_LABEL : PILL_INK;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      testID={testID}
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.pill, { backgroundColor, borderColor }]}
    >
      {loading ? <ActivityIndicator size="small" color={PILL_INK} /> : null}
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={1.2}
        style={[styles.label, { color }, loading ? styles.labelSmall : null]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

type BarProps = {
  selecting: boolean;
  /** The viewer may download (host, going, or church admin). Others only get Back. */
  entitled: boolean;
  photoCount: number;
  selectedCount: number;
  downloading: boolean;
  bottomInset: number;
  onBack: () => void;
  onDownloadAll: () => void;
  onSelect: () => void;
  onCancel: () => void;
  onDownloadSelected: () => void;
  onSelectAll: () => void;
};

export const PhotoBottomBar = ({
  selecting,
  entitled,
  photoCount,
  selectedCount,
  downloading,
  bottomInset,
  onBack,
  onDownloadAll,
  onSelect,
  onCancel,
  onDownloadSelected,
  onSelectAll,
}: BarProps) => {
  const empty = photoCount === 0;
  return (
    <View style={[styles.bar, { paddingBottom: bottomInset + PHOTO_BAR_PADDING }]} testID="photo-bottom-bar">
      {selecting ? (
        <>
          <BarPill label={COMMON_COPY.cancel} onPress={onCancel} disabled={downloading} testID="photo-cancel" />
          <BarPill
            label={PHOTO_COPY.downloadSelected(selectedCount)}
            filled
            disabled={selectedCount === 0 || downloading}
            onPress={onDownloadSelected}
            testID="photo-download-selected"
          />
          <BarPill label={PHOTO_COPY.selectAll} onPress={onSelectAll} disabled={downloading || empty} testID="photo-select-all" />
        </>
      ) : (
        <>
          <BarPill label={COMMON_COPY.back} onPress={onBack} disabled={downloading} testID="photo-back" />
          {entitled ? (
            <>
              <BarPill
                label={downloading ? PHOTO_COPY.downloading : PHOTO_COPY.downloadAll}
                loading={downloading}
                disabled={empty}
                onPress={onDownloadAll}
                testID="photo-download-all"
              />
              <BarPill label={PHOTO_COPY.select} disabled={empty || downloading} onPress={onSelect} testID="photo-select" />
            </>
          ) : null}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 8,
    paddingTop: PHOTO_BAR_PADDING,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e1dbd7',
  },
  pill: {
    flex: 1,
    height: PHOTO_PILL_HEIGHT,
    borderRadius: PHOTO_PILL_HEIGHT / 2,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
  },
  label: { fontFamily: appTypography.bodySemibold, fontSize: 15, lineHeight: 20 },
  /** `Downloading…` plus a spinner has to fit a 114pt pill. */
  labelSmall: { fontSize: 12, lineHeight: 16 },
});
