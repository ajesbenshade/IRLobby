import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Avatar, PillButton } from '@components/foyer/ui';
import { View } from '@components/RNCompat';
import { ATTENDEE_COPY, CANCEL_COPY } from '@constants/foyerCopy';
import { ageBandLabel, sanitizeHouseholds, splitVisiblePeople } from '@foyer/attendees';
import type { HostAttendeesResponse } from '@services/foyerService';
import { appColors, appTypography, radii } from '@theme/index';

export const HOST_PREVIEW_LIMIT = 8;

/** Host-only "Who's coming": households, relationship lines and age-band chips. Never contact data. */
export const HostAttendeesCard = ({
  data,
  hostName,
  cancelled = false,
}: {
  data: HostAttendeesResponse;
  hostName?: string;
  /** Cancelled gathering: the card reads "Who was invited", "N RSVPed" and "Show N more" (no "going"). */
  cancelled?: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);
  const groups = sanitizeHouseholds(data);
  const view = splitVisiblePeople(groups, HOST_PREVIEW_LIMIT, expanded);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {cancelled ? CANCEL_COPY.invitedHeading : ATTENDEE_COPY.whosComing}
        </Text>
        <View style={styles.pill}>
          <MaterialCommunityIcons name="lock-outline" size={14} color={appColors.primary} />
          <Text style={styles.pillText}>{ATTENDEE_COPY.hostOnlyPill}</Text>
        </View>
      </View>
      <Text style={styles.count}>
        {cancelled ? CANCEL_COPY.rsvpedCount(data.going_count) : ATTENDEE_COPY.goingCount(data.going_count)}
      </Text>
      {view.groups.map((group, index) => (
        <View key={`${group.name}-${index}`} style={styles.group}>
          <Text style={styles.groupName}>{group.name}</Text>
          {group.people.map((person, personIndex) => {
            const isHost = person.relationship === 'self';
            return (
              <View key={`${person.name}-${personIndex}`} style={styles.row}>
                <Avatar initials={person.name.charAt(0).toUpperCase()} size={36} />
                <View style={styles.copy}>
                  <Text style={styles.name}>{person.name}</Text>
                  {isHost && hostName === person.name ? <Text style={styles.sub}>{ATTENDEE_COPY.youHost}</Text> : null}
                </View>
                <View style={styles.band}>
                  <Text style={styles.bandText}>{ageBandLabel(person.age_band)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}
      {view.hidden > 0 ? (
        <PillButton label={cancelled ? ATTENDEE_COPY.showMorePast(view.hidden) : ATTENDEE_COPY.showMore(view.hidden)} variant="text" onPress={() => setExpanded(true)} />
      ) : null}
      <Text style={styles.caption}>{ATTENDEE_COPY.caption}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: appColors.white, borderRadius: radii.list, padding: 16, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  title: { fontFamily: appTypography.heading, fontSize: 20, color: appColors.ink },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: appColors.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 12 },
  count: { fontFamily: appTypography.bodySemibold, fontSize: 14, color: appColors.mutedInk },
  group: { gap: 6 },
  groupName: { fontFamily: appTypography.bodySemibold, fontSize: 13, color: appColors.mutedInk, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  copy: { flex: 1, flexShrink: 1 },
  name: { fontFamily: appTypography.bodySemibold, fontSize: 15, color: appColors.ink },
  sub: { fontFamily: appTypography.bodyRegular, fontSize: 13, color: appColors.mutedInk },
  band: { backgroundColor: appColors.background, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  bandText: { fontFamily: appTypography.bodySemibold, fontSize: 12, color: appColors.ink },
  caption: { fontFamily: appTypography.bodyRegular, fontSize: 12, color: appColors.mutedInk, lineHeight: 17 },
});
