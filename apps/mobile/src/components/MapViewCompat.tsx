import type { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';

import { Text, View } from '@components/RNCompat';
import { appColors } from '@theme/index';

type MapViewCompatProps = PropsWithChildren<{
  style?: object;
  initialRegion?: unknown;
}>;

type MarkerProps = PropsWithChildren<{
  coordinate?: unknown;
  title?: string;
  description?: string;
  onPress?: () => void;
}>;

const MapViewCompat = ({ children, style }: MapViewCompatProps) => (
  <View style={[styles.mapFallback, style]}>
    <Text style={styles.title}>Map preview unavailable on web</Text>
    <Text style={styles.subtitle}>Use the native app build to validate live pins and map gestures.</Text>
    <View style={styles.markerList}>{children}</View>
  </View>
);

export const Marker = ({ title, description, onPress }: MarkerProps) => (
  <View style={styles.markerCard} onTouchEnd={onPress}>
    <Text style={styles.markerTitle}>{title ?? 'Location pin'}</Text>
    {description ? <Text style={styles.markerDescription}>{description}</Text> : null}
  </View>
);

export default MapViewCompat;

const styles = StyleSheet.create({
  mapFallback: {
    minHeight: 260,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: appColors.line,
    backgroundColor: appColors.cardStrong,
    padding: 16,
    justifyContent: 'center',
  },
  title: {
    color: appColors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: appColors.mutedInk,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  markerList: {
    marginTop: 16,
    gap: 10,
  },
  markerCard: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: appColors.card,
    borderWidth: 1,
    borderColor: appColors.line,
  },
  markerTitle: {
    color: appColors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  markerDescription: {
    color: appColors.mutedInk,
    fontSize: 12,
    marginTop: 4,
  },
});