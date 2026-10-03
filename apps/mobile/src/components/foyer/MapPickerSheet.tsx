import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';

import MapViewBase from '@components/MapViewCompat';
import { PillButton } from '@components/foyer/ui';
import { View } from '@components/RNCompat';
import { COMMON_COPY, MAP_COPY } from '@constants/foyerCopy';
import { DEFAULT_DELTA, FRANCONIA_CENTER, useMapCenter, type HomeChurchGeo, type MapCenter } from '@foyer/mapLocation';
import { shortRegion } from '@foyer/regions';
import { useSafeInsets } from '@hooks/useSafeInsets';
import { appColors, appTypography, radii } from '@theme/index';

// react-native-maps on device; the web stub accepts the same props and ignores them.
const MapView = MapViewBase as unknown as ComponentType<Record<string, unknown>>;

export type ChosenPlace = MapCenter & { label: string };

type Props = {
  visible: boolean;
  onCancel: () => void;
  onChoose: (place: ChosenPlace) => void;
  /** `user.church` from the account payload; used to center the map when device location is off. */
  homeChurch?: HomeChurchGeo | null;
};

/** Within about a metre: the map settling on the region we asked for, not the user moving it. */
const SAME_SPOT = 0.00001;

/** A drag is a gesture-flagged region change, or (when the platform does not say) one that moved away from `center`. */
export const isUserDrag = (region: MapCenter, center: MapCenter, details?: { isGesture?: boolean }): boolean => {
  if (details?.isGesture === true) {
    return true;
  }
  if (details?.isGesture === false) {
    return false;
  }
  return Math.abs(region.latitude - center.latitude) > SAME_SPOT || Math.abs(region.longitude - center.longitude) > SAME_SPOT;
};

const labelFor = async (center: MapCenter, isDefault: boolean, defaultLabel: string = MAP_COPY.franconiaLabel): Promise<string> => {
  try {
    // Reverse geocoding needs no location permission and never prompts.
    const Location = await import('expo-location');
    const [match] = await Location.reverseGeocodeAsync(center);
    const city = match?.city || match?.subregion || match?.region || '';
    const region = match?.region && match.region !== city ? shortRegion(match.region) : '';
    const label = [city, region].filter(Boolean).join(', ');
    if (label) {
      return label;
    }
  } catch {
    // fall through to the default label
  }
  return isDefault ? defaultLabel : MAP_COPY.selectedLocation;
};

/**
 * Full-screen place picker (Design frames 142-143). Opens on the user only if `Use my location for maps` is on and the OS
 * allowed it; otherwise on Franconia, PA with a caption chip and no OS prompt. The header sits below the status bar.
 */
const MapPickerBody = ({ visible, onCancel, onChoose, homeChurch }: Props) => {
  const insets = useSafeInsets();
  const { center, source, loading } = useMapCenter(visible, homeChurch);
  const defaultLabel = source === 'church' && homeChurch?.name ? homeChurch.name : MAP_COPY.franconiaLabel;
  const [selected, setSelected] = useState<MapCenter>(FRANCONIA_CENTER);
  const [label, setLabel] = useState<string>(defaultLabel);
  const mapRef = useRef<{ animateToRegion?: (region: object, duration?: number) => void } | null>(null);
  const isDefault = source !== 'user';
  const isChurch = source === 'church';

  // Move the pin when the center resolves (user fix, or Franconia).
  useEffect(() => {
    if (!visible) {
      return;
    }
    setSelected(center);
    setLabel(isDefault ? defaultLabel : MAP_COPY.selectedLocation);
    mapRef.current?.animateToRegion?.({ ...center, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA }, 300);
    let cancelled = false;
    if (isDefault) {
      // Franconia, PA and the church name are fixed strings: a geocoder could answer "Souderton" or "Pennsylvania" here.
      return undefined;
    }
    void labelFor(center, isDefault, defaultLabel).then((next) => {
      if (!cancelled) {
        setLabel(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [visible, center.latitude, center.longitude, isDefault, defaultLabel]);

  // Only a real drag moves the pin and re-labels it. The initial region and the animateToRegion on open also fire
  // onRegionChangeComplete; those must not geocode and overwrite the fixed "Franconia, PA" / church label.
  const onRegionChange = (region: MapCenter, details?: { isGesture?: boolean }) => {
    if (!isUserDrag(region, center, details)) {
      return;
    }
    const next = { latitude: region.latitude, longitude: region.longitude };
    setSelected(next);
    void labelFor(next, false).then(setLabel);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]} testID="map-picker-header">
          <Pressable accessibilityRole="button" accessibilityLabel={COMMON_COPY.cancel} onPress={onCancel} style={styles.cancel}>
            <Text style={styles.cancelText}>{COMMON_COPY.cancel}</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>
            {MAP_COPY.title}
          </Text>
          <View style={styles.cancel} />
        </View>
        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={{ ...center, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA }}
            showsUserLocation={!isDefault}
            onRegionChangeComplete={onRegionChange}
          />
          <View pointerEvents="none" style={styles.pinWrap}>
            {!isDefault ? <Text style={styles.youAreHere}>{MAP_COPY.youAreHere}</Text> : null}
            <MaterialCommunityIcons name="map-marker" size={44} color="#a2033f" />
          </View>
          {isDefault && !loading ? (
            <View style={styles.chip} testID="map-default-caption">
              <Text style={styles.chipText}>{isChurch ? MAP_COPY.churchCaption : MAP_COPY.defaultCaption}</Text>
            </View>
          ) : null}
          {!isDefault ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={MAP_COPY.recenter}
              onPress={() => mapRef.current?.animateToRegion?.({ ...center, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA }, 300)}
              style={styles.recenter}
            >
              <MaterialCommunityIcons name="crosshairs-gps" size={24} color={appColors.primary} />
            </Pressable>
          ) : null}
        </View>
        <View style={[styles.card, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.cardLabel}>{MAP_COPY.selectedLocation}</Text>
          <Text style={styles.cardPlace}>{label}</Text>
          <Text style={styles.cardHelp}>{MAP_COPY.drag}</Text>
          <PillButton label={MAP_COPY.useThisLocation} onPress={() => onChoose({ ...selected, label })} testID="map-use-location" />
        </View>
      </View>
    </Modal>
  );
};

/** Mounted only while open, so a closed picker never resolves a location or reads the safe area. */
export const MapPickerSheet = (props: Props) => (props.visible ? <MapPickerBody {...props} /> : null);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: appColors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 6,
    backgroundColor: appColors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: appColors.line,
  },
  cancel: { minWidth: 72, minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  cancelText: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 16 },
  title: { flex: 1, textAlign: 'center', fontFamily: appTypography.bodySemibold, fontSize: 17, color: appColors.ink },
  mapWrap: { flex: 1 },
  pinWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingBottom: 44 },
  youAreHere: {
    fontFamily: appTypography.bodySemibold,
    fontSize: 12,
    color: '#2f7cf6',
    backgroundColor: appColors.white,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 4,
  },
  chip: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: radii.list,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { fontFamily: appTypography.bodyMedium, fontSize: 13, lineHeight: 18, color: appColors.ink },
  recenter: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: appColors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { padding: 16, gap: 4, backgroundColor: appColors.white },
  cardLabel: { fontFamily: appTypography.bodySemibold, fontSize: 12, color: appColors.mutedInk },
  cardPlace: { fontFamily: appTypography.heading, fontSize: 20, color: appColors.ink },
  cardHelp: { fontFamily: appTypography.bodyRegular, fontSize: 13, color: appColors.mutedInk, marginBottom: 10 },
});
