import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNetInfo } from '@react-native-community/netinfo';
import { StyleSheet, View } from 'react-native';
import { Surface, Text, useTheme } from 'react-native-paper';

export const OfflineBanner = () => {
  const theme = useTheme();
  const netInfo = useNetInfo();

  const isOffline =
    netInfo.isConnected === false ||
    (netInfo.isInternetReachable != null && netInfo.isInternetReachable === false);

  if (!isOffline) {
    return null;
  }

  return (
    <Surface
      elevation={0}
      accessibilityRole="alert"
      style={[
        styles.banner,
        {
          backgroundColor: theme.colors.surfaceVariant,
          borderColor: theme.colors.outlineVariant,
        },
      ]}
    >
      <View style={styles.row}>
        <MaterialCommunityIcons
          name="wifi-off"
          size={18}
          color={theme.colors.onSurfaceVariant}
        />
        <Text style={styles.text}>You’re offline. Showing cached data when available.</Text>
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  banner: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    flex: 1,
    opacity: 0.85,
  },
});
