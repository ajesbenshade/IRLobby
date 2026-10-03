import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { DatePickerSheet, PickerField } from '@components/foyer/DatePickerSheet';
import { FoyerSheet } from '@components/foyer/FoyerSheet';
import { InlineError, PillButton, SheetButtons } from '@components/foyer/ui';
import { View } from '@components/RNCompat';
import { COMMON_COPY, FAMILY_COPY, GOING_COPY } from '@constants/foyerCopy';
import { familyBirthDayLimits, formatBirthdayLong, toIsoDate, type DayValue } from '@foyer/dates';
import { canAddFamilyMember, familyEditChanged, isAdultBirthdayError, isAdultMember, memberBirthDay, memberBirthLine, sexOf } from '@foyer/family';
import { useSheetHandoff } from '@hooks/useSheetHandoff';
import { addFamilyMember, updateFamilyMember, type FamilyMember, type FamilySex } from '@services/foyerService';
import { appColors, appTypography, radii } from '@theme/index';

type Props = {
  visible: boolean;
  /** Present = Edit family member (needs PATCH); absent = Add family member. */
  member?: FamilyMember | null;
  /** Edit only: `Remove from family` link under Save. */
  onRemove?: (member: FamilyMember) => void;
  onCancel: () => void;
  onAdded: () => void;
  /** Fires when the whole sheet has finished closing (not when it only steps aside for the birthday picker). */
  onClosed?: () => void;
};

/** Two-segment control (Male | Female). A radio group: 48pt+ targets, selected = burgundy label on white. */
export const SexSegments = ({ value, onChange, disabled }: { value: FamilySex | null; onChange: (value: FamilySex) => void; disabled?: boolean }) => (
  <View style={styles.segments} accessibilityRole="radiogroup">
    {(['male', 'female'] as const).map((choice) => {
      const selected = value === choice;
      return (
        <Pressable
          key={choice}
          accessibilityRole="radio"
          accessibilityLabel={FAMILY_COPY.sexes[choice]}
          accessibilityState={{ selected, disabled: Boolean(disabled) }}
          disabled={disabled}
          onPress={() => onChange(choice)}
          style={[styles.segment, selected ? styles.segmentOn : null]}
        >
          <Text style={[styles.segmentText, selected ? styles.segmentTextOn : null]}>{FAMILY_COPY.sexes[choice]}</Text>
        </Pressable>
      );
    })}
  </View>
);

/**
 * Add / Edit family member: Name, Sex (Male | Female), and a Birthday row that opens the same two-step day-grid picker as
 * the account birth date (last 18 years, no future dates). No relationship is chosen or sent.
 */
export const AddFamilyMemberSheet = ({ visible, member = null, onRemove, onCancel, onAdded, onClosed }: Props) => {
  const editing = member != null;
  // Adults (a spouse row) cannot be saved as a child: no birthday editing, and only the name and sex are PATCHed.
  const adult = member != null && isAdultMember(member);
  const [name, setName] = useState('');
  const [sex, setSex] = useState<FamilySex | null>(null);
  const [birthday, setBirthday] = useState<DayValue | null>(null);
  // Sequential handoff form -> picker -> form. iOS cannot present the picker Modal while this sheet's Modal is presented, so the
  // form steps aside (visible=false, typed values kept in state) and the picker opens once the form has finished closing.
  const [formHidden, setFormHidden] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const steppingAside = useRef(false);
  const handoff = useSheetHandoff();
  const [pending, setPending] = useState(false);
  const [birthdayError, setBirthdayError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Prefill when the sheet opens (Edit) or start blank (Add).
  useEffect(() => {
    // A step queued for the previous open (picker open / form restore) must never fire into this one.
    handoff.cancel();
    if (visible) {
      setName(member?.name ?? '');
      setSex(sexOf(member?.sex));
      setBirthday(member ? memberBirthDay(member) : null);
      setBirthdayError(null);
      setError(null);
      setPending(false);
    } else {
      steppingAside.current = false;
      setFormHidden(false);
      setPickerOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, member?.id]);

  const complete = adult ? Boolean(name.trim()) : canAddFamilyMember({ name, sex, birthday });
  const changed = member ? familyEditChanged(member, { name, sex, birthday }) : true;
  const canSubmit = complete && changed;

  const submit = async () => {
    if (!canSubmit || (!adult && (!sex || !birthday))) {
      return;
    }
    const trimmed = name.trim();
    setPending(true);
    setError(null);
    setBirthdayError(null);
    try {
      if (member && adult) {
        await updateFamilyMember(member.id, { name: trimmed, ...(sex ? { sex } : {}) });
      } else if (member && sex && birthday) {
        await updateFamilyMember(member.id, { name: trimmed, sex, date_of_birth: toIsoDate(birthday) });
      } else if (sex && birthday) {
        await addFamilyMember({ name: trimmed, sex, date_of_birth: toIsoDate(birthday) });
      }
      onAdded();
    } catch (failure) {
      if (!member && isAdultBirthdayError(failure)) {
        setBirthdayError(FAMILY_COPY.adultError);
      } else {
        setError(member ? FAMILY_COPY.saveFailed : FAMILY_COPY.addFailed(trimmed));
      }
    } finally {
      setPending(false);
    }
  };

  const openPicker = () => {
    if (pending) {
      return;
    }
    // Hide the form first; open the picker only after the form has finished closing.
    steppingAside.current = true;
    handoff.after(() => setPickerOpen(true));
    setFormHidden(true);
  };

  const closePicker = (apply?: () => void) => {
    apply?.();
    // Close the picker first; bring the form back only after the picker has finished closing.
    handoff.after(() => {
      steppingAside.current = false;
      setFormHidden(false);
    });
    setPickerOpen(false);
  };

  return (
    <>
      <FoyerSheet
        visible={visible && !formHidden}
        onClosed={() => {
          if (steppingAside.current) {
            handoff.flush();
          } else {
            onClosed?.();
          }
        }}
        onDismiss={() => {
          if (!pending) {
            onCancel();
          }
        }}
        footer={
          <SheetButtons>
            <PillButton
              label={editing ? FAMILY_COPY.save : FAMILY_COPY.addCta}
              loadingLabel={editing ? FAMILY_COPY.saving : FAMILY_COPY.adding}
              disabled={!canSubmit}
              loading={pending}
              onPress={() => void submit()}
              testID="family-submit"
            />
            <InlineError message={error} />
            {editing ? (
              <PillButton
                label={FAMILY_COPY.removeFromFamily}
                variant="text"
                disabled={pending}
                onPress={() => member && onRemove?.(member)}
              />
            ) : (
              <PillButton label={COMMON_COPY.cancel} variant="text" disabled={pending} onPress={onCancel} />
            )}
          </SheetButtons>
        }
      >
        <View style={pending ? styles.dim : null} pointerEvents={pending ? 'none' : 'auto'}>
          <Text accessibilityRole="header" style={styles.title}>
            {editing ? FAMILY_COPY.editTitle : FAMILY_COPY.sheetTitle}
          </Text>
          {editing ? null : <Text style={styles.subtitle}>{FAMILY_COPY.sheetSubtitle}</Text>}
          <View style={styles.group}>
            <Text style={styles.label}>{FAMILY_COPY.name}</Text>
            <TextInput
              accessibilityLabel={FAMILY_COPY.name}
              value={name}
              onChangeText={setName}
              placeholder={FAMILY_COPY.namePlaceholder}
              placeholderTextColor={appColors.softInk}
              editable={!pending}
              autoCapitalize="words"
              style={styles.input}
            />
          </View>
          <View style={styles.group}>
            <Text style={styles.label}>{FAMILY_COPY.sex}</Text>
            <SexSegments value={sex} onChange={setSex} disabled={pending} />
          </View>
          {adult ? (
            <Text style={styles.helper} testID="family-adult-note">
              {memberBirthLine(member as FamilyMember)}
            </Text>
          ) : (
            <View style={styles.group}>
              <PickerField
                label={FAMILY_COPY.birthday}
                value={birthday ? formatBirthdayLong(birthday) : ''}
                placeholder={FAMILY_COPY.birthdayPlaceholder}
                error={birthdayError}
                errorStrong={Boolean(birthdayError)}
                onPress={openPicker}
                testID="family-birthday-row"
              />
              {birthdayError ? null : <Text style={styles.helper}>{FAMILY_COPY.birthdayHelper}</Text>}
            </View>
          )}
          {editing ? null : (
            <Text style={styles.note} testID="family-under13-note">
              {GOING_COPY.underThirteenNote}
            </Text>
          )}
        </View>
      </FoyerSheet>
      <DatePickerSheet
        visible={visible && pickerOpen}
        onClosed={handoff.flush}
        mode="birthdate"
        title={FAMILY_COPY.birthday}
        value={birthday}
        limits={familyBirthDayLimits()}
        minAge={0}
        defaultYearsBack={10}
        wheelHelper={FAMILY_COPY.birthdayWheelHelper}
        caption={FAMILY_COPY.birthdayHelper}
        onCancel={() => closePicker()}
        onDone={(value) =>
          closePicker(() => {
            setBirthday(value);
            setBirthdayError(null);
          })
        }
      />
    </>
  );
};


const styles = StyleSheet.create({
  title: { fontFamily: appTypography.heading, fontSize: 24, lineHeight: 32, color: appColors.ink },
  subtitle: { fontFamily: appTypography.bodyRegular, fontSize: 14, lineHeight: 20, color: appColors.mutedInk, marginTop: 4 },
  note: { fontFamily: appTypography.bodyRegular, fontSize: 13, lineHeight: 18, color: appColors.mutedInk, marginTop: 14 },
  dim: { opacity: 0.5 },
  group: { gap: 6, marginTop: 14 },
  label: { fontFamily: appTypography.bodySemibold, fontSize: 13, color: appColors.ink },
  input: {
    minHeight: 54,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
    paddingHorizontal: 14,
    color: appColors.ink,
    fontFamily: appTypography.bodyRegular,
    fontSize: 16,
  },
  segments: {
    flexDirection: 'row',
    backgroundColor: '#efe9e5',
    borderRadius: 999,
    padding: 3,
    minHeight: 54,
  },
  segment: { flex: 1, minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: '#ffffff' },
  segmentText: { fontFamily: appTypography.bodySemibold, fontSize: 15, color: appColors.mutedInk },
  segmentTextOn: { color: '#a2033f' },
  helper: { fontFamily: appTypography.bodyRegular, fontSize: 12, lineHeight: 17, color: appColors.mutedInk },
});
