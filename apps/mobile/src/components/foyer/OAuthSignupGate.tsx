import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Checkbox } from '@components/foyer/Choice';
import { DatePickerSheet, PickerField } from '@components/foyer/DatePickerSheet';
import { View } from '@components/RNCompat';
import { AppButton } from '@components/ui/Button';
import { PICKER_COPY, VOTING_MEMBER_COPY } from '@constants/foyerCopy';
import { birthDayLimits, formatDayShort, isValidSignUpBirthDate, parseIsoDate, toIsoDate, type DayValue } from '@foyer/dates';
import { appColors, appTypography } from '@theme/index';

/**
 * Shown when Google or Apple refuses a new account. The same token is sent again with an 18+ birth date
 * and voting_member_attested. Existing accounts never reach this step.
 */
export const OAuthSignupGate = ({
  pending,
  onSubmit,
}: {
  pending?: boolean;
  onSubmit: (value: { dateOfBirth: string; votingMemberAttested: true }) => void;
}) => {
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [votingMember, setVotingMember] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const day = parseIsoDate(dateOfBirth);
  const ready = isValidSignUpBirthDate(dateOfBirth) && votingMember;

  return (
    <View style={styles.box} testID="oauth-signup-gate">
      <Text style={styles.helper}>{VOTING_MEMBER_COPY.helper}</Text>
      <PickerField
        label={PICKER_COPY.birthTitle}
        value={day ? formatDayShort(day as DayValue) : ''}
        placeholder="Choose a date"
        onPress={() => setPickerOpen(true)}
        testID="oauth-gate-birth-date"
      />
      <DatePickerSheet
        visible={pickerOpen}
        mode="birthdate"
        title={PICKER_COPY.birthTitle}
        value={day}
        limits={birthDayLimits()}
        onCancel={() => setPickerOpen(false)}
        onDone={(value) => {
          setDateOfBirth(toIsoDate(value));
          setPickerOpen(false);
        }}
      />
      {!isValidSignUpBirthDate(dateOfBirth) ? (
        <Text style={styles.hint}>{PICKER_COPY.birthRequired}</Text>
      ) : null}
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={VOTING_MEMBER_COPY.checkbox}
        accessibilityState={{ checked: votingMember }}
        onPress={() => setVotingMember((current) => !current)}
        style={styles.row}
        testID="oauth-gate-voting-member"
      >
        <Checkbox checked={votingMember} />
        <Text style={styles.checkbox}>{VOTING_MEMBER_COPY.checkbox}</Text>
      </Pressable>
      <AppButton
        onPress={() => onSubmit({ dateOfBirth, votingMemberAttested: true })}
        disabled={!ready || pending}
        loading={pending}
      >
        Continue
      </AppButton>
    </View>
  );
};

const styles = StyleSheet.create({
  box: { gap: 12 },
  helper: { color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 14, lineHeight: 20 },
  hint: { color: appColors.mutedInk, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  checkbox: { flex: 1, color: appColors.ink, fontSize: 15, lineHeight: 20 },
});
