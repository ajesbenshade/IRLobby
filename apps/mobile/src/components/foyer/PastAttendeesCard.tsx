import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AttendeeSafetyMenu } from '@components/foyer/AttendeeSafetyMenu';
import { Avatar, PillButton } from '@components/foyer/ui';
import { View } from '@components/RNCompat';
import { ATTENDEE_COPY, MEMBER_COPY } from '@constants/foyerCopy';
import type { PastAttendee } from '@foyer/attendees';
import { appColors, appTypography, radii } from '@theme/index';

export const PAST_PREVIEW_LIMIT = 8;

/** "Who was there · N". Under-18 attendees show as Family member with no chevron and no link. */
export const PastAttendeesCard = ({
  attendees,
  onOpen,
}: {
  attendees: PastAttendee[];
  onOpen: (userId: number) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? attendees : attendees.slice(0, PAST_PREVIEW_LIMIT);
  const hidden = attendees.length - shown.length;

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>
        {ATTENDEE_COPY.pastTitle(attendees.length)}
      </Text>
      {shown.map((attendee, index) => {
        const content = (
          <>
            <Avatar initials={attendee.isMinor ? '' : attendee.name.charAt(0).toUpperCase()} size={36} />
            <Text style={styles.name}>{attendee.name}</Text>
            {attendee.openable ? <MaterialCommunityIcons name="chevron-right" size={22} color={appColors.mutedInk} /> : null}
          </>
        );
        return attendee.openable && attendee.userId != null ? (
          <View key={`${attendee.userId}-${index}`} style={styles.openRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={attendee.name}
              onPress={() => onOpen(attendee.userId as number)}
              style={[styles.row, styles.openMain]}
            >
              {content}
            </Pressable>
            <AttendeeSafetyMenu userId={attendee.userId} name={attendee.name} />
          </View>
        ) : (
          <View key={`minor-${index}`} style={styles.row}>
            {content}
          </View>
        );
      })}
      {hidden > 0 ? <PillButton label={ATTENDEE_COPY.showMorePast(hidden)} variant="text" onPress={() => setExpanded(true)} /> : null}
      {attendees.some((attendee) => attendee.isMinor) ? <Text style={styles.note}>{MEMBER_COPY.minorNoMenu}</Text> : null}
      <Text style={styles.note}>{ATTENDEE_COPY.pastNote}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  openRow: { flexDirection: 'row', alignItems: 'center' },
  openMain: { flex: 1 },
  card: { backgroundColor: appColors.white, borderRadius: radii.list, padding: 16, gap: 8 },
  title: { fontFamily: appTypography.heading, fontSize: 20, color: appColors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 },
  name: { flex: 1, fontFamily: appTypography.bodySemibold, fontSize: 15, color: appColors.ink },
  note: { fontFamily: appTypography.bodyRegular, fontSize: 12, color: appColors.mutedInk },
});
