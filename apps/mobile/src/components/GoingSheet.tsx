import { Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import { View } from '@components/RNCompat';
import { appColors, appTypography, radii } from '@theme/index';

type GoingSheetProps = {
  title: string;
  onPhotos: () => void;
  onChat: () => void;
  onAddToCalendar: () => void;
  onDismiss: () => void;
};

export const GoingSheet = ({ title, onPhotos, onChat, onAddToCalendar, onDismiss }: GoingSheetProps) => (
  <View style={styles.sheet}>
    <View style={styles.handle} />
    <Text style={styles.title}>You're going</Text>
    <Text style={styles.subtitle}>{title}</Text>
    <Pressable accessibilityRole="link" accessibilityLabel="Photos" onPress={onPhotos} style={styles.link}>
      <Text style={styles.linkText}>Photos</Text>
    </Pressable>
    <Pressable accessibilityRole="link" accessibilityLabel="Chat" onPress={onChat} style={styles.link}>
      <Text style={styles.linkText}>Chat</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Add to calendar" onPress={onAddToCalendar} style={styles.link}>
      <Text style={styles.linkText}>Add to calendar</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Done" onPress={onDismiss} style={styles.done}>
      <Text style={styles.doneText}>Done</Text>
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
  subtitle: {
    fontFamily: appTypography.bodyRegular,
    fontSize: 15,
    color: appColors.mutedInk,
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
