import { useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { DatePickerSheet } from '@components/foyer/DatePickerSheet';
import { FoyerSheet } from '@components/foyer/FoyerSheet';
import { InlineError, PillButton, SheetButtons } from '@components/foyer/ui';
import { COMMON_COPY, FAMILY_COPY } from '@constants/foyerCopy';
import { dayLimitsWithinMonth, type DayValue } from '@foyer/dates';
import { memberBirthLine } from '@foyer/family';
import { removeHouseholdChild, updateFamilyMember, type FamilyMember } from '@services/foyerService';
import { appColors, appTypography } from '@theme/index';

/** Row chevron sheet: name, `Born …`, `Edit details`, `Remove from family`, Cancel. */
export const FamilyMemberActionSheet = ({
  member,
  onEdit,
  onRemove,
  onCancel,
  onClosed,
}: {
  member: FamilyMember | null;
  onEdit: (member: FamilyMember) => void;
  onRemove: (member: FamilyMember) => void;
  onCancel: () => void;
  /** The sheet has finished closing: the parent opens the next sheet (Edit / Remove) now, never in the same render. */
  onClosed?: () => void;
}) => (
  <FoyerSheet
    visible={member != null}
    onClosed={onClosed}
    onDismiss={onCancel}
    footer={
      member ? (
        <SheetButtons>
          <PillButton label={FAMILY_COPY.editDetails} variant="outline" onPress={() => onEdit(member)} />
          <PillButton label={FAMILY_COPY.removeFromFamily} variant="outline" onPress={() => onRemove(member)} />
          <PillButton label={COMMON_COPY.cancel} variant="text" onPress={onCancel} />
        </SheetButtons>
      ) : undefined
    }
  >
    {member ? (
      <>
        <Text accessibilityRole="header" style={styles.title}>
          {member.name}
        </Text>
        <Text style={styles.meta}>{memberBirthLine(member)}</Text>
      </>
    ) : null}
  </FoyerSheet>
);

/** `Remove Noah?` confirm (frame 102): Remove (filled burgundy) and Keep (outline). */
export const RemoveFamilyMemberSheet = ({
  member,
  onRemoved,
  onKeep,
  onClosed,
}: {
  member: FamilyMember | null;
  onRemoved: () => void;
  onKeep: () => void;
  onClosed?: () => void;
}) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (!member) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await removeHouseholdChild(member.id);
      onRemoved();
    } catch {
      setError(FAMILY_COPY.removeFailed);
    } finally {
      setPending(false);
    }
  };

  return (
    <FoyerSheet
      visible={member != null}
      onClosed={onClosed}
      onDismiss={() => {
        if (!pending) {
          setError(null);
          onKeep();
        }
      }}
      footer={
        <SheetButtons>
          <PillButton label={FAMILY_COPY.remove} loading={pending} onPress={() => void remove()} testID="family-remove-confirm" />
          <InlineError message={error} />
          <PillButton
            label={FAMILY_COPY.keep}
            variant="outline"
            disabled={pending}
            onPress={() => {
              setError(null);
              onKeep();
            }}
          />
        </SheetButtons>
      }
    >
      {member ? (
        <>
          <Text accessibilityRole="header" style={styles.title}>
            {FAMILY_COPY.removeTitle(member.name)}
          </Text>
          <Text style={styles.body}>{FAMILY_COPY.removeBody(member.sex)}</Text>
        </>
      ) : null}
    </FoyerSheet>
  );
};

/** `Add day` on a legacy month/year row: the day grid with the month and year fixed. PATCH `{birth_day}`. */
export const AddDaySheet = ({
  member,
  onSaved,
  onCancel,
  onClosed,
}: {
  member: FamilyMember | null;
  onSaved: () => void;
  onCancel: () => void;
  onClosed?: () => void;
}) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Keep the last member while the picker slides away, so the Modal closes with its content instead of unmounting mid-animation
  // (an unmounted Modal never reports onDismiss, which the sequential handoff relies on).
  const lastMember = useRef<FamilyMember | null>(null);
  if (member) {
    lastMember.current = member;
  }
  const shown = member ?? lastMember.current;
  const month = shown?.birth_month != null && shown.birth_year != null ? { year: shown.birth_year, month: shown.birth_month } : null;

  if (!shown || !month) {
    return null;
  }

  const save = async (day: DayValue) => {
    setPending(true);
    setError(null);
    try {
      await updateFamilyMember(shown.id, { birth_day: day.day });
      onSaved();
    } catch {
      setError(FAMILY_COPY.addDayFailed);
    } finally {
      setPending(false);
    }
  };

  return (
    <DatePickerSheet
      visible={member != null}
      onClosed={onClosed}
      mode="birthdate"
      fixedMonth
      title={FAMILY_COPY.addDayTitle(shown.name)}
      value={null}
      limits={dayLimitsWithinMonth(month)}
      minAge={0}
      caption={FAMILY_COPY.birthdayHelper}
      saving={pending}
      error={error}
      onCancel={() => {
        setError(null);
        onCancel();
      }}
      onDone={(day) => void save(day)}
    />
  );
};

const styles = StyleSheet.create({
  title: { fontFamily: appTypography.heading, fontSize: 24, lineHeight: 32, color: appColors.ink },
  meta: { fontFamily: appTypography.bodyRegular, fontSize: 15, color: appColors.mutedInk },
  body: { fontFamily: appTypography.bodyRegular, fontSize: 15, lineHeight: 22, color: appColors.ink },
});
