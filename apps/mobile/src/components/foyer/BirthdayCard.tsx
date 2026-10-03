import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { API_ROUTES } from '@shared/schema';

import { Switch } from '@components/foyer/Switch';
import { View } from '@components/RNCompat';
import { BIRTHDAY_COPY } from '@constants/foyerCopy';
import { birthdayMonthDay, isUnder18 } from '@foyer/birthdays';
import { TOGGLE_DISABLED_LABEL_OPACITY } from '@foyer/buttonTokens';
import { useAuth } from '@hooks/useAuth';
import { api } from '@services/apiClient';
import { appColors, appTypography, radii } from '@theme/index';

type Props = {
  /** Saved account birthdate (ISO). Only month and day are ever rendered, never the year. */
  dateOfBirth: string | null | undefined;
  /** Saved `show_birthday`. */
  value: boolean;
  onOpenBirthdate: () => void;
};

/**
 * Profile > BIRTHDAY (frame 239): `Birthday` / `March 4` row (opens the account birthdate picker) and `Show my birthday`.
 * The switch saves on its own (spinner while saving, snaps back with an inline error). Under 18 or no birthdate on file:
 * switch drawn disabled and off, label at 50%.
 */
export const BirthdayCard = ({ dateOfBirth, value, onOpenBirthdate }: Props) => {
  const { refreshProfile } = useAuth();
  const monthDay = birthdayMonthDay(dateOfBirth);
  const minor = Boolean(dateOfBirth) && isUnder18(dateOfBirth);
  const locked = !dateOfBirth || minor;

  const mutation = useMutation({
    mutationFn: async (next: boolean) => {
      await api.patch(API_ROUTES.USER_PROFILE, { show_birthday: next });
      await refreshProfile();
    },
  });

  return (
    <View>
      <View style={styles.card} testID="birthday-card">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${BIRTHDAY_COPY.rowTitle}, ${monthDay ?? 'not set'}`}
          onPress={onOpenBirthdate}
          style={[styles.row, styles.divider]}
        >
          <Text style={styles.title}>{BIRTHDAY_COPY.rowTitle}</Text>
          <Text style={styles.value}>{monthDay ?? ''}</Text>
          <MaterialCommunityIcons name="chevron-right" size={22} color={appColors.mutedInk} />
        </Pressable>
        <View style={styles.row}>
          <Text style={[styles.title, locked ? styles.dim : null]}>{BIRTHDAY_COPY.showTitle}</Text>
          {mutation.isPending ? (
            <View style={styles.spinnerSlot}>
              <ActivityIndicator accessibilityLabel="Saving" color={appColors.primary} size="small" />
            </View>
          ) : (
            <Switch
              accessibilityLabel={BIRTHDAY_COPY.showTitle}
              value={locked ? false : value}
              disabled={locked}
              onValueChange={(next) => mutation.mutate(next)}
            />
          )}
        </View>
      </View>
      {mutation.isError ? (
        <View style={styles.errorBox} testID="birthday-error">
          <Text accessibilityRole="alert" style={styles.errorText}>
            {BIRTHDAY_COPY.error}
          </Text>
        </View>
      ) : null}
      <Text style={styles.caption}>{minor ? BIRTHDAY_COPY.underEighteen : BIRTHDAY_COPY.caption}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: appColors.white, borderRadius: radii.list, overflow: 'hidden' },
  row: { minHeight: 56, paddingHorizontal: 16, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: appColors.line },
  title: { flex: 1, fontFamily: appTypography.bodyMedium, fontSize: 15.5, color: appColors.ink },
  dim: { opacity: TOGGLE_DISABLED_LABEL_OPACITY },
  value: { fontFamily: appTypography.bodyRegular, fontSize: 15.5, color: appColors.mutedInk },
  spinnerSlot: { width: 51, height: 31, alignItems: 'center', justifyContent: 'center' },
  caption: { marginTop: 8, paddingLeft: 20, fontFamily: appTypography.bodyRegular, fontSize: 12.5, lineHeight: 17, color: appColors.mutedInk },
  errorBox: { marginTop: 8, borderRadius: 10, backgroundColor: appColors.warnBg, paddingHorizontal: 12, paddingVertical: 8 },
  errorText: { fontFamily: appTypography.bodyMedium, fontSize: 13, color: '#8a0a1f' },
});
