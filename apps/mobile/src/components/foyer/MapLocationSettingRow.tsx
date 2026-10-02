import { ActivityIndicator, StyleSheet, Switch, Text } from 'react-native';

import { View } from '@components/RNCompat';
import { MAP_COPY } from '@constants/foyerCopy';
import { useUseMyLocationSetting } from '@foyer/mapLocation';
import { appColors, appTypography, radii } from '@theme/index';

/**
 * Profile > PRIVACY > `Use my location for maps`. On-device only (AsyncStorage), default OFF. Turning it on does NOT ask the
 * OS: the first map that opens does, and a denial there falls back to Franconia without touching this switch.
 */
export const MapLocationSettingRow = () => {
  const setting = useUseMyLocationSetting();
  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.title}>{MAP_COPY.settingTitle}</Text>
        {setting.saving ? (
          <ActivityIndicator accessibilityLabel="Saving" color={appColors.primary} />
        ) : (
          <Switch
            accessibilityLabel={MAP_COPY.settingTitle}
            value={setting.value}
            onValueChange={(next) => void setting.update(next)}
            trackColor={{ true: appColors.primary, false: appColors.line }}
          />
        )}
      </View>
      {setting.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {MAP_COPY.settingError}
        </Text>
      ) : null}
      <Text style={styles.caption}>{MAP_COPY.settingCaption}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 14,
    backgroundColor: appColors.white,
    borderRadius: radii.list,
  },
  title: { flex: 1, fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.ink },
  caption: { marginTop: 6, fontFamily: appTypography.bodyRegular, fontSize: 12.5, lineHeight: 17, color: appColors.mutedInk },
  error: { marginTop: 6, fontFamily: appTypography.bodyMedium, fontSize: 13, color: '#8a0a1f' },
});
