import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import { View } from '@components/RNCompat';
import { SheetScaffold } from '@components/SheetScaffold';
import { appColors, appTypography, radii } from '@theme/index';

type AddToCalendarSheetProps = {
  summary: string;
  onGoogle: () => void;
  onOutlook: () => void;
  onApple: () => void;
  onDismiss: () => void;
};

const openAndClose = (open: () => void, close: () => void) => {
  open();
  close();
};

export const AddToCalendarSheet = ({ summary, onGoogle, onOutlook, onApple, onDismiss }: AddToCalendarSheetProps) => (
  <SheetScaffold>
    <Text style={styles.title}>Add to calendar</Text>
    <Text style={styles.summary}>{summary}</Text>
    <CalendarRow icon="calendar-month-outline" label="Google Calendar" onPress={() => openAndClose(onGoogle, onDismiss)} />
    <CalendarRow icon="email-outline" label="Outlook" onPress={() => openAndClose(onOutlook, onDismiss)} />
    <CalendarRow
      icon="calendar-import-outline"
      label="Apple Calendar"
      note="Downloads an .ics file"
      onPress={() => openAndClose(onApple, onDismiss)}
    />
    <Text style={styles.helper}>Opens in your calendar app. The Foyer doesn't need access to your calendar.</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={onDismiss} style={styles.cancel}>
      <Text style={styles.cancelText}>Cancel</Text>
    </Pressable>
  </SheetScaffold>
);

const CalendarRow = ({
  icon,
  label,
  note,
  onPress,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  note?: string;
  onPress: () => void;
}) => (
  <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress} style={styles.row}>
    <View style={styles.iconTile}>
      <MaterialCommunityIcons name={icon} size={22} color={appColors.primary} />
    </View>
    <View style={styles.rowCopy}>
      <Text style={styles.rowLabel}>{label}</Text>
      {note ? <Text style={styles.rowNote}>{note}</Text> : null}
    </View>
    <MaterialCommunityIcons name="chevron-right" size={22} color={appColors.softInk} />
  </Pressable>
);

const styles = StyleSheet.create({
  title: {
    fontFamily: appTypography.heading,
    fontSize: 26,
    lineHeight: 34,
    color: appColors.ink,
  },
  summary: {
    fontFamily: appTypography.bodyRegular,
    fontSize: 15,
    color: appColors.mutedInk,
    marginTop: -4,
    marginBottom: 4,
  },
  row: {
    minHeight: 64,
    borderRadius: radii.list,
    backgroundColor: '#fbf7f5',
    borderWidth: 1,
    borderColor: appColors.line,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: appColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: { flex: 1, gap: 2 },
  rowLabel: {
    fontFamily: appTypography.bodySemibold,
    fontSize: 16,
    lineHeight: 22,
    color: appColors.ink,
  },
  rowNote: {
    fontFamily: appTypography.bodyRegular,
    fontSize: 13,
    color: appColors.mutedInk,
  },
  helper: {
    fontFamily: appTypography.bodyRegular,
    fontSize: 14,
    color: appColors.mutedInk,
    lineHeight: 20,
    marginTop: 4,
  },
  cancel: {
    minHeight: 54,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: appColors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  cancelText: {
    fontFamily: appTypography.bodySemibold,
    fontSize: 16,
    color: appColors.ink,
  },
});
