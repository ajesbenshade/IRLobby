import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { DatePickerSheet, PickerField } from '@components/foyer/DatePickerSheet';
import { FoyerSheet } from '@components/foyer/FoyerSheet';
import { InlineError, PillButton, SheetButtons } from '@components/foyer/ui';
import { View } from '@components/RNCompat';
import { COMMON_COPY, FAMILY_COPY } from '@constants/foyerCopy';
import { familyBirthMonthLimits, formatMonthYear, type MonthValue } from '@foyer/dates';
import { FAMILY_RELATIONSHIP_CHOICES, canAddFamilyMember } from '@foyer/family';
import { addFamilyMember, type FamilyRelationship } from '@services/foyerService';
import { appColors, appTypography, radii } from '@theme/index';
import { getErrorMessage } from '@utils/error';

type Props = {
  visible: boolean;
  /** Spouse is one per household; hide the choice once one exists. */
  hasSpouse?: boolean;
  onCancel: () => void;
  onAdded: () => void;
};

const Chip = ({ label, selected, onPress, disabled }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean }) => (
  <Pressable
    accessibilityRole="radio"
    accessibilityState={{ selected, disabled }}
    accessibilityLabel={label}
    disabled={disabled}
    onPress={onPress}
    style={[styles.chip, selected ? styles.chipOn : null, disabled ? styles.chipOff : null]}
  >
    <Text style={[styles.chipText, selected ? styles.chipTextOn : null]}>{label}</Text>
  </Pressable>
);

/** Add family member: name, relationship, sex, and birth month + year (children only, no day). */
export const AddFamilyMemberSheet = ({ visible, hasSpouse = false, onCancel, onAdded }: Props) => {
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState<FamilyRelationship | null>(null);
  const [sex, setSex] = useState<'male' | 'female' | null>(null);
  const [birth, setBirth] = useState<MonthValue | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setRelationship(null);
    setSex(null);
    setBirth(null);
    setError(null);
  };

  const valid = canAddFamilyMember({
    name,
    relationship,
    sex,
    birthMonth: birth?.month ?? null,
    birthYear: birth?.year ?? null,
  });

  const close = () => {
    reset();
    onCancel();
  };

  const submit = async () => {
    if (!valid || !relationship) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await addFamilyMember({
        name: name.trim(),
        relationship,
        sex,
        birth_month: relationship === 'child' ? birth?.month : undefined,
        birth_year: relationship === 'child' ? birth?.year : undefined,
      });
      reset();
      onAdded();
    } catch (addError) {
      setError(getErrorMessage(addError, COMMON_COPY.genericError));
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <FoyerSheet
        visible={visible}
        onDismiss={close}
        footer={
          <SheetButtons>
            <InlineError message={error} />
            <PillButton label={FAMILY_COPY.addCta} disabled={!valid} loading={pending} onPress={() => void submit()} />
            <PillButton label={COMMON_COPY.cancel} variant="text" disabled={pending} onPress={close} />
          </SheetButtons>
        }
      >
        <Text accessibilityRole="header" style={styles.title}>
          {FAMILY_COPY.sheetTitle}
        </Text>
        <View style={styles.group}>
          <Text style={styles.label}>{FAMILY_COPY.name}</Text>
          <TextInput
            accessibilityLabel={FAMILY_COPY.name}
            value={name}
            onChangeText={setName}
            placeholder={FAMILY_COPY.name}
            placeholderTextColor={appColors.softInk}
            style={styles.input}
          />
        </View>
        <View style={styles.group}>
          <Text style={styles.label}>{FAMILY_COPY.relationship}</Text>
          <View style={styles.chips}>
            {FAMILY_RELATIONSHIP_CHOICES.map((choice) => (
              <Chip
                key={choice}
                label={FAMILY_COPY.relationships[choice]}
                selected={relationship === choice}
                disabled={choice === 'spouse' && hasSpouse}
                onPress={() => setRelationship(choice)}
              />
            ))}
          </View>
        </View>
        <View style={styles.group}>
          <Text style={styles.label}>{FAMILY_COPY.sex}</Text>
          <View style={styles.chips}>
            <Chip label={FAMILY_COPY.sexes.male} selected={sex === 'male'} onPress={() => setSex('male')} />
            <Chip label={FAMILY_COPY.sexes.female} selected={sex === 'female'} onPress={() => setSex('female')} />
          </View>
        </View>
        {relationship === 'child' ? (
          <View style={styles.group}>
            <PickerField
              label={FAMILY_COPY.birth}
              value={birth ? formatMonthYear(birth) : ''}
              placeholder="Choose month and year"
              onPress={() => setPickerOpen(true)}
            />
            <Text style={styles.helper}>{FAMILY_COPY.birthHelper}</Text>
          </View>
        ) : null}
      </FoyerSheet>
      <DatePickerSheet
        visible={pickerOpen}
        mode="monthYear"
        title={FAMILY_COPY.birth}
        value={birth}
        limits={familyBirthMonthLimits()}
        onCancel={() => setPickerOpen(false)}
        onDone={(value) => {
          setBirth(value);
          setPickerOpen(false);
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  title: { fontFamily: appTypography.heading, fontSize: 24, lineHeight: 32, color: appColors.ink },
  group: { gap: 6 },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 18,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34,34,34,0.2)',
    backgroundColor: appColors.background,
  },
  chipOn: { backgroundColor: appColors.primary, borderColor: appColors.primary },
  chipOff: { opacity: 0.45 },
  chipText: { fontFamily: appTypography.bodySemibold, fontSize: 15, color: appColors.ink },
  chipTextOn: { color: '#f6f1ee' },
  helper: { fontFamily: appTypography.bodyRegular, fontSize: 12, color: appColors.mutedInk },
});
