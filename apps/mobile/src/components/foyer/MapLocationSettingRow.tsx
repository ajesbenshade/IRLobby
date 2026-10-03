import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { Switch } from '@components/foyer/Switch';
import { View } from '@components/RNCompat';
import { MAP_COPY } from '@constants/foyerCopy';
import { useUseMyLocationSetting } from '@foyer/mapLocation';
import { appColors, appTypography, radii } from '@theme/index';

/** Frame 144 (profile-location-setting.png): one 56pt white card, label and switch share the 28pt centre line. */
export const LOCATION_ROW_HEIGHT = 56;
export const LOCATION_ROW_INSET = 16;
export const LOCATION_CAPTION_GAP = 8;
export const LOCATION_CAPTION_INSET = 20;
export const LOCATION_SPINNER_SIZE = 22;

/**
 * Profile > PRIVACY > `Use my location for maps`. On-device only (AsyncStorage), default OFF. Turning it on does NOT ask the
 * OS: the first map that opens does, and a denial there falls back to Franconia without touching this switch.
 * The caption sits OUTSIDE and below the card (gray 12.5pt, 8pt gap, 20pt left inset); an error box goes between them.
 */
export const MapLocationSettingRow = () => {
  const setting = useUseMyLocationSetting();
  return (
    <View>
      <View style={styles.card} testID="location-row-card">
        <Text style={styles.title}>{MAP_COPY.settingTitle}</Text>
        {setting.saving ? (
          <View style={styles.accessory} testID="location-row-spinner-slot">
            <ActivityIndicator accessibilityLabel="Saving" color={appColors.primary} size="small" style={styles.spinner} />
          </View>
        ) : (
          <Switch
            accessibilityLabel={MAP_COPY.settingTitle}
            value={setting.value}
            onValueChange={(next) => void setting.update(next)}
          />
        )}
      </View>
      {setting.error ? (
        <View style={styles.errorBox} testID="location-row-error">
          <Text accessibilityRole="alert" style={styles.errorText}>
            {MAP_COPY.settingError}
          </Text>
        </View>
      ) : null}
      <Text style={styles.caption}>{MAP_COPY.settingCaption}</Text>
    </View>
  );
};

export const locationRowStyles = {
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    height: LOCATION_ROW_HEIGHT,
    minHeight: LOCATION_ROW_HEIGHT,
    paddingVertical: 4,
    paddingLeft: LOCATION_ROW_INSET,
    paddingRight: LOCATION_ROW_INSET,
    backgroundColor: appColors.white,
    borderRadius: radii.list,
  },
} as const;

const styles = StyleSheet.create({
  card: { ...locationRowStyles.card },
  title: { flex: 1, fontFamily: appTypography.bodyMedium, fontSize: 15.5, color: appColors.ink },
  accessory: { width: 51, height: 31, alignItems: 'center', justifyContent: 'center' },
  spinner: { width: LOCATION_SPINNER_SIZE, height: LOCATION_SPINNER_SIZE },
  caption: {
    marginTop: LOCATION_CAPTION_GAP,
    paddingLeft: LOCATION_CAPTION_INSET,
    fontFamily: appTypography.bodyRegular,
    fontSize: 12.5,
    lineHeight: 17,
    color: appColors.mutedInk,
  },
  errorBox: { marginTop: 8, borderRadius: 10, backgroundColor: appColors.warnBg, paddingHorizontal: 12, paddingVertical: 8 },
  errorText: { fontFamily: appTypography.bodyMedium, fontSize: 13, color: '#8a0a1f' },
});
