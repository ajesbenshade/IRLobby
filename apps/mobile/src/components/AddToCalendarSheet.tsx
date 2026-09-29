import { Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import { View } from '@components/RNCompat';
import { appColors, appTypography, radii } from '@theme/index';

type AddToCalendarSheetProps = {
  onGoogle: () => void;
  onOutlook: () => void;
  onApple: () => void;
  onDismiss: () => void;
};

export const AddToCalendarSheet = ({ onGoogle, onOutlook, onApple, onDismiss }: AddToCalendarSheetProps) => (
  <View style={styles.sheet}>
    <View style={styles.handle} />
    <Text style={styles.title}>Add to calendar</Text>
    <Text style={styles.helper}>The Foyer does not need access to your calendar.</Text>
    <Pressable accessibilityRole="link" accessibilityLabel="Google Calendar" onPress={onGoogle} style={styles.link}>
      <Text style={styles.linkText}>Google Calendar</Text>
    </Pressable>
    <Pressable accessibilityRole="link" accessibilityLabel="Outlook" onPress={onOutlook} style={styles.link}>
      <Text style={styles.linkText}>Outlook</Text>
    </Pressable>
    <Pressable accessibilityRole="link" accessibilityLabel="Apple Calendar" onPress={onApple} style={styles.link}>
      <Text style={styles.linkText}>Apple Calendar</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Close calendar options" onPress={onDismiss} style={styles.done}>
      <Text style={styles.doneText}>Close</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: appColors.white,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    padding: 20,
    gap: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: appColors.line,
    marginBottom: 4,
  },
  title: {
    fontFamily: appTypography.heading,
    fontSize: 26,
    color: appColors.ink,
  },
  helper: {
    fontFamily: appTypography.bodyRegular,
    fontSize: 14,
    color: appColors.mutedInk,
    lineHeight: 20,
    marginTop: -4,
  },
  link: {
    minHeight: 52,
    borderRadius: radii.list,
    backgroundColor: appColors.primaryWash,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  linkText: {
    fontFamily: appTypography.bodySemibold,
    fontSize: 16,
    color: appColors.primary,
  },
  done: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    fontFamily: appTypography.bodySemibold,
    fontSize: 16,
    color: appColors.primary,
  },
});
