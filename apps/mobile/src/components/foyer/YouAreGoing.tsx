import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AddFamilyMemberSheet } from '@components/foyer/AddFamilyMemberSheet';
import { InlineError, PillButton } from '@components/foyer/ui';
import { View } from '@components/RNCompat';
import { SheetScaffold } from '@components/SheetScaffold';
import { GOING_COPY } from '@constants/foyerCopy';
import type { WhosComingResponse } from '@foyer/logic';
import {
  buildRsvpPeople,
  hasSelectionChanged,
  isEmptySelection,
  type RsvpSelection,
} from '@foyer/rsvp';
import { appColors, appTypography, radii } from '@theme/index';

type YouAreGoingProps = {
  title: string;
  whenLabel?: string | null;
  placeLabel?: string | null;
  response: WhosComingResponse;
  /** What the server has saved right now. */
  saved: RsvpSelection;
  ageRange?: { age_min?: number | null; age_max?: number | null } | null;
  saving?: boolean;
  error?: string | null;
  onSave: (selection: RsvpSelection) => void;
  onAddToCalendar: () => void;
  onCancelRsvp: () => void;
  onFamilyAdded?: () => void;
  onClose: () => void;
};

/**
 * "You're going": confirmation plus the family checklist. Photos and Chat live on the
 * gathering detail, not here. `Save changes` appears only once the selection differs from
 * what is saved; with nobody checked it becomes the Cancel RSVP flow.
 */
export const YouAreGoing = ({
  title,
  whenLabel,
  placeLabel,
  response,
  saved,
  ageRange = null,
  saving,
  error,
  onSave,
  onAddToCalendar,
  onCancelRsvp,
  onFamilyAdded,
  onClose,
}: YouAreGoingProps) => {
  const people = useMemo(() => buildRsvpPeople(response, ageRange), [response, ageRange]);
  const [selection, setSelection] = useState<RsvpSelection>(saved);
  const [adding, setAdding] = useState(false);
  const changed = hasSelectionChanged(saved, selection);
  const empty = isEmptySelection(selection);

  const toggle = (id: number | null) => {
    setSelection((current) =>
      id == null
        ? { ...current, includeSelf: !current.includeSelf }
        : {
            ...current,
            memberIds: current.memberIds.includes(id)
              ? current.memberIds.filter((item) => item !== id)
              : [...current.memberIds, id],
          },
    );
  };

  return (
    <SheetScaffold
      footer={
        <View style={styles.footer}>
          <InlineError message={error} />
          {changed && !empty ? (
            <PillButton label={GOING_COPY.saveChanges} loading={saving} onPress={() => onSave(selection)} />
          ) : null}
          {changed && empty ? (
            <PillButton label={GOING_COPY.cancelRsvp} loading={saving} onPress={onCancelRsvp} />
          ) : null}
          {!changed ? <PillButton label="Done" variant="outline" onPress={onClose} /> : null}
          <PillButton label={GOING_COPY.addToCalendar} variant="text" icon="calendar-plus" onPress={onAddToCalendar} />
          {!(changed && empty) ? <PillButton label={GOING_COPY.cancelRsvp} variant="text" onPress={onCancelRsvp} /> : null}
        </View>
      }
    >
      <View style={styles.header}>
        <View style={styles.check}>
          <MaterialCommunityIcons name="check" size={26} color="#f6f1ee" />
        </View>
        <Text accessibilityRole="header" style={styles.heading}>
          {GOING_COPY.title}
        </Text>
      </View>
      <Text style={styles.event}>{title}</Text>
      {whenLabel ? <Text style={styles.meta}>{whenLabel}</Text> : null}
      {placeLabel ? <Text style={styles.meta}>{placeLabel}</Text> : null}

      <Text style={styles.section}>{GOING_COPY.whosComing}</Text>
      {people.map((person) => {
        const checked = person.id == null ? selection.includeSelf : selection.memberIds.includes(person.id);
        return (
          <Pressable
            key={person.key}
            accessibilityRole="checkbox"
            accessibilityLabel={person.name}
            accessibilityState={{ checked, disabled: !person.eligible }}
            disabled={!person.eligible}
            onPress={() => toggle(person.id)}
            style={[styles.row, checked ? styles.rowOn : null, !person.eligible ? styles.rowOff : null]}
          >
            <View style={[styles.box, checked ? styles.boxOn : null]}>
              {checked ? <MaterialCommunityIcons name="check" size={16} color="#f6f1ee" /> : null}
            </View>
            <View style={styles.copy}>
              <Text style={[styles.name, !person.eligible ? styles.nameOff : null]}>{person.name}</Text>
              <Text style={[styles.sub, !person.eligible ? styles.subOff : null]}>
                {person.eligible ? person.subtitle : person.reason}
              </Text>
            </View>
          </Pressable>
        );
      })}
      <PillButton label={GOING_COPY.addFamilyMember} variant="outline" icon="plus" onPress={() => setAdding(true)} />
      <AddFamilyMemberSheet
        visible={adding}
        onCancel={() => setAdding(false)}
        onAdded={() => {
          setAdding(false);
          onFamilyAdded?.();
        }}
      />
    </SheetScaffold>
  );
};

const styles = StyleSheet.create({
  footer: { gap: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: { width: 44, height: 44, borderRadius: 22, backgroundColor: appColors.primary, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, fontFamily: appTypography.heading, fontSize: 28, lineHeight: 36, color: appColors.ink },
  event: { fontFamily: appTypography.bodySemibold, fontSize: 18, color: appColors.ink },
  meta: { fontFamily: appTypography.bodyRegular, fontSize: 15, color: appColors.mutedInk, marginTop: -6 },
  section: { fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.ink, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 54,
    borderRadius: radii.list,
    backgroundColor: appColors.background,
    padding: 12,
  },
  rowOn: { backgroundColor: appColors.primaryWash },
  rowOff: { backgroundColor: '#efe9e5' },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: appColors.line, backgroundColor: appColors.white, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: appColors.primary, borderColor: appColors.primary },
  copy: { flex: 1, flexShrink: 1 },
  name: { fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.ink },
  nameOff: { color: appColors.mutedInk },
  sub: { fontFamily: appTypography.bodyRegular, fontSize: 13, color: appColors.mutedInk },
  subOff: { color: '#7a7572' },
});
