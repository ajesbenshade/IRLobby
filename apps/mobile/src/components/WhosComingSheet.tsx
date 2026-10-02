import { useMemo, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import { AddFamilyMemberSheet } from '@components/foyer/AddFamilyMemberSheet';
import { PillButton } from '@components/foyer/ui';
import { View } from '@components/RNCompat';
import { SheetScaffold } from '@components/SheetScaffold';
import { APPROVAL_COPY, COMMON_COPY, GOING_COPY } from '@constants/foyerCopy';
import { applyClientEligibility, buildRsvpPeople, eligibleMemberIds, type AgeRange } from '@foyer/rsvp';
import { buildRsvpPayload, defaultRsvpSelection, peopleCount, type WhosComingResponse } from '@foyer/logic';
import { appColors, appTypography, fontSize, radii } from '@theme/index';

type WhosComingSheetProps = {
  response: WhosComingResponse;
  subtitle?: string;
  pending?: boolean;
  /** Inline error from the last Confirm attempt, shown inside the sheet. */
  error?: string | null;
  /** The event's age range, used to word `Not eligible: ages 13–17`. */
  ageRange?: AgeRange | null;
  /**
   * `request` = Require approval: title `Request to join`, the guest line about what the host sees,
   * `Send request` and a Cancel link. Nothing here takes a spot until the host approves.
   */
  mode?: 'rsvp' | 'request';
  onCancelRequest?: () => void;
  /** Called after a family member is added so the parent can refetch the list. */
  onFamilyAdded?: () => void;
  onConfirm: (payload: { include_self: boolean; dependent_ids: number[]; member_ids?: number[] }) => void;
};

export const WhosComingSheet = ({
  response,
  subtitle,
  pending,
  error,
  ageRange = null,
  mode = 'rsvp',
  onCancelRequest,
  onFamilyAdded,
  onConfirm,
}: WhosComingSheetProps) => {
  const isRequest = mode === 'request';
  // The server's eligible flag is not trusted on its own: a family member outside the age range is also blocked here.
  const initial = useMemo(() => defaultRsvpSelection(applyClientEligibility(response, ageRange)), [response, ageRange]);
  const people = useMemo(() => buildRsvpPeople(response, ageRange), [response, ageRange]);
  const [includeSelf, setIncludeSelf] = useState(initial.includeSelf);
  const [dependentIds, setDependentIds] = useState<number[]>(initial.dependentIds);
  const [adding, setAdding] = useState(false);
  const count = peopleCount(includeSelf, dependentIds);

  const toggle = (id: number | null) => {
    if (id == null) {
      setIncludeSelf((value) => !value);
      return;
    }
    setDependentIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  return (
    <SheetScaffold
      footer={
        <>
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <PillButton
            label={isRequest ? APPROVAL_COPY.sendRequest : GOING_COPY.confirmRsvp}
            disabled={pending || count < 1 || (!includeSelf && eligibleMemberIds(response, ageRange, dependentIds).length === 0)}
            loading={pending}
            onPress={() => onConfirm(buildRsvpPayload(includeSelf, eligibleMemberIds(response, ageRange, dependentIds)))}
            testID="whos-coming-confirm"
          />
          {isRequest ? (
            <>
              <PillButton label={COMMON_COPY.cancel} variant="outline" disabled={pending} onPress={() => onCancelRequest?.()} />
              <Text style={styles.note}>{APPROVAL_COPY.sheetFooter}</Text>
            </>
          ) : null}
        </>
      }
    >
      <Text style={styles.title}>{isRequest ? APPROVAL_COPY.sheetTitle : GOING_COPY.whosComing}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {isRequest ? <Text style={styles.subtitle}>{GOING_COPY.whosComing}</Text> : null}

      {people.map((person) => {
        const selected = person.id == null ? includeSelf : dependentIds.includes(person.id);
        return (
          <Pressable
            key={person.key}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected, disabled: !person.eligible }}
            accessibilityLabel={person.name}
            disabled={!person.eligible}
            onPress={() => toggle(person.id)}
            style={[styles.row, selected ? styles.rowOn : null, !person.eligible ? styles.rowOff : null]}
          >
            <View style={[styles.box, selected ? styles.boxOn : null]} />
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{person.initials}</Text>
            </View>
            <View style={styles.copy}>
              <Text style={[styles.name, !person.eligible ? styles.nameOff : null]}>{person.name}</Text>
              <Text style={[styles.meta, !person.eligible ? styles.metaOff : null]}>
                {person.eligible ? person.subtitle : person.reason}
              </Text>
            </View>
          </Pressable>
        );
      })}

      <PillButton
        label={GOING_COPY.addFamilyMember}
        variant="outline"
        icon="plus"
        disabled={pending}
        onPress={() => setAdding(true)}
      />

      {isRequest ? <Text style={styles.note}>{APPROVAL_COPY.sheetGuestLine}</Text> : null}
      <Text style={styles.note}>{GOING_COPY.underThirteenNote}</Text>

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
  title: {
    fontFamily: appTypography.heading,
    fontSize: 26,
    lineHeight: 34,
    color: appColors.ink,
  },
  subtitle: {
    fontFamily: appTypography.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
    color: appColors.mutedInk,
    marginTop: -6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radii.list,
    backgroundColor: appColors.background,
    padding: 12,
  },
  rowOn: {
    backgroundColor: appColors.primaryWash,
  },
  rowOff: {
    backgroundColor: '#efe9e5',
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
  },
  boxOn: {
    backgroundColor: appColors.primary,
    borderColor: appColors.primary,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: appColors.primaryWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: appColors.primary,
    fontFamily: appTypography.bodySemibold,
    fontSize: 12,
  },
  copy: {
    flex: 1,
  },
  name: {
    fontFamily: appTypography.bodySemibold,
    fontSize: 16,
    color: appColors.ink,
  },
  nameOff: {
    color: appColors.mutedInk,
  },
  error: {
    color: appColors.danger,
    fontFamily: appTypography.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  metaOff: {
    color: '#7a7572',
  },
  meta: {
    fontFamily: appTypography.bodyRegular,
    fontSize: 13,
    color: appColors.mutedInk,
  },
  note: {
    fontFamily: appTypography.bodyRegular,
    fontSize: fontSize.sm,
    color: appColors.mutedInk,
    lineHeight: 18,
  },
});
