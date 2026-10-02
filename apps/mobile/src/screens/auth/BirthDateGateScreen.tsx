import { useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { View } from '@components/RNCompat';
import { DatePickerSheet, PickerField } from '@components/foyer/DatePickerSheet';
import { InlineError, PillButton } from '@components/foyer/ui';
import { BIRTH_GATE_COPY, PICKER_COPY } from '@constants/foyerCopy';
import { birthDayLimits, formatDayShort, isValidSignUpBirthDate, parseIsoDate, toIsoDate, type DayValue } from '@foyer/dates';
import { isUnder13Rejection } from '@foyer/profileForm';
import { useAuth } from '@hooks/useAuth';
import { appColors, appTypography } from '@theme/index';
import { getErrorMessage } from '@utils/error';

/**
 * Foyer only. Full-screen, no skip: shown after an Apple / Google sign-in when the account has no birth date.
 * Same picker as sign-up (13+, 1900..today). The only ways out are saving a valid date or signing out.
 */
export const BirthDateGateScreen = () => {
  const { saveBirthDate, signOut } = useAuth();
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = isValidSignUpBirthDate(dateOfBirth);
  const day = parseIsoDate(dateOfBirth);

  const submit = async () => {
    if (!valid || pending) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await saveBirthDate(dateOfBirth);
      // AuthProvider clears the step; the navigator moves on by itself.
    } catch (saveError) {
      const message = getErrorMessage(saveError, BIRTH_GATE_COPY.saveFailed);
      setError(isUnder13Rejection(message) ? PICKER_COPY.under13 : message);
    } finally {
      setPending(false);
    }
  };

  const leave = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']} testID="birth-date-gate">
      <StatusBar barStyle="dark-content" />
      <View style={styles.body}>
        <Text accessibilityRole="header" style={styles.title}>
          {BIRTH_GATE_COPY.title}
        </Text>
        <Text style={styles.copy}>{BIRTH_GATE_COPY.body}</Text>
        <PickerField
          label={PICKER_COPY.birthTitle}
          value={day ? formatDayShort(day as DayValue) : ''}
          placeholder="Choose a date"
          onPress={() => setPickerOpen(true)}
          testID="gate-birth-date"
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
            setError(null);
          }}
        />
        {!valid ? (
          <Text style={styles.hint} testID="gate-birth-required">
            {PICKER_COPY.birthRequired}
          </Text>
        ) : null}
        <InlineError message={error} />
      </View>
      <View style={styles.footer}>
        <PillButton
          label={BIRTH_GATE_COPY.continue}
          disabled={!valid}
          loading={pending}
          onPress={() => void submit()}
          testID="gate-continue"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={BIRTH_GATE_COPY.signOut}
          disabled={signingOut || pending}
          onPress={() => void leave()}
          style={styles.signOut}
          testID="gate-sign-out"
        >
          <Text style={styles.signOutText}>{BIRTH_GATE_COPY.signOut}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: appColors.background, paddingHorizontal: 24 },
  body: { flex: 1, justifyContent: 'center', gap: 14 },
  title: { fontFamily: appTypography.heading, fontSize: 28, lineHeight: 36, color: appColors.ink },
  copy: { fontFamily: appTypography.bodyRegular, fontSize: 15, lineHeight: 22, color: appColors.mutedInk },
  hint: { fontFamily: appTypography.bodyRegular, fontSize: 14, lineHeight: 20, color: appColors.mutedInk },
  footer: { gap: 6, paddingBottom: 12 },
  signOut: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  signOutText: { fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.primary },
});
