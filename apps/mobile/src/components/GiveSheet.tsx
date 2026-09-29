import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { Text } from 'react-native-paper';

import { View } from '@components/RNCompat';
import { AppButton } from '@components/ui/Button';
import { openGivingInBrowser } from '@foyer/giving';
import {
  FEE_NOTE,
  GIFT_CHIP_AMOUNTS,
  giftChipSelected,
  giveInBrowserLabel,
  preselectedGiftAmount,
} from '@foyer/logic';
import { appColors, appTypography, radii } from '@theme/index';

type GiveSheetProps = {
  intro: string;
  disclaimer: string;
  feeNote?: string | null;
  suggested?: string | number | null;
  pending?: boolean;
  onGive: (amount: string) => Promise<string>;
  onDismiss: () => void;
};

export const GiveSheet = ({
  intro,
  disclaimer,
  feeNote,
  suggested,
  pending,
  onGive,
  onDismiss,
}: GiveSheetProps) => {
  const initial = preselectedGiftAmount(suggested);
  const [choice, setChoice] = useState<number | 'other'>(giftChipSelected(initial));
  const [other, setOther] = useState(giftChipSelected(initial) === 'other' ? String(initial) : '');
  const [error, setError] = useState<string | null>(null);
  const amount =
    choice === 'other' ? Number(other) : choice;
  const valid = Number.isFinite(amount) && amount > 0;

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <View style={styles.check}>
        <Text style={styles.checkMark}>✓</Text>
      </View>
      <Text style={styles.title}>You're going.</Text>
      <Text style={styles.prompt}>Want to chip in?</Text>
      <Text style={styles.intro}>{intro}</Text>
      <Text style={styles.label}>Suggested amount</Text>
      <View style={styles.chips}>
        {GIFT_CHIP_AMOUNTS.map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: choice === value }}
            onPress={() => setChoice(value)}
            style={[styles.chip, choice === value ? styles.chipOn : null]}
          >
            <Text style={[styles.chipText, choice === value ? styles.chipTextOn : null]}>${value}</Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: choice === 'other' }}
          onPress={() => setChoice('other')}
          style={[styles.chip, choice === 'other' ? styles.chipOn : null]}
        >
          <Text style={[styles.chipText, choice === 'other' ? styles.chipTextOn : null]}>Other</Text>
        </Pressable>
      </View>
      {choice === 'other' ? (
        <TextInput
          accessibilityLabel="Other amount"
          value={other}
          onChangeText={setOther}
          keyboardType="decimal-pad"
          placeholder="Amount"
          placeholderTextColor={appColors.softInk}
          style={styles.other}
        />
      ) : null}
      <View style={styles.note}>
        <Text style={styles.noteText}>{disclaimer}</Text>
        <Text style={styles.fee}>{feeNote || FEE_NOTE}</Text>
      </View>
      <AppButton
        disabled={!valid || pending}
        loading={pending}
        onPress={() => {
          void (async () => {
            try {
              setError(null);
              const url = await onGive(amount.toFixed(2));
              if (url) {
                await openGivingInBrowser(url);
              }
            } catch {
              setError('Unable to open the gift page. Your RSVP is still saved.');
            }
          })();
        }}
      >
        {giveInBrowserLabel(valid ? amount : null)}
      </AppButton>
      {error ? <Text style={styles.fee}>{error}</Text> : null}
      <Text style={styles.safari}>Opens Safari to finish your gift.</Text>
      <Pressable accessibilityRole="button" onPress={onDismiss}>
        <Text style={styles.dismiss}>Not now</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: appColors.white,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    padding: 20,
    gap: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: appColors.line,
  },
  check: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: appColors.primaryWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: appColors.primary,
    fontSize: 18,
  },
  title: {
    fontFamily: appTypography.heading,
    fontSize: 26,
    color: appColors.ink,
  },
  prompt: {
    fontFamily: appTypography.heading,
    fontSize: 18,
    color: appColors.ink,
    marginTop: -6,
  },
  intro: {
    fontFamily: appTypography.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
    color: appColors.ink,
  },
  label: {
    fontFamily: appTypography.bodySemibold,
    fontSize: 13,
    color: appColors.ink,
    marginTop: 4,
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: appColors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.white,
  },
  chipOn: {
    backgroundColor: appColors.primary,
    borderColor: appColors.primary,
  },
  chipText: {
    fontFamily: appTypography.bodySemibold,
    color: appColors.ink,
  },
  chipTextOn: {
    color: appColors.white,
  },
  other: {
    minHeight: 48,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: appColors.line,
    paddingHorizontal: 14,
    fontFamily: appTypography.bodyRegular,
    color: appColors.ink,
  },
  note: {
    backgroundColor: appColors.background,
    borderRadius: radii.list,
    padding: 14,
    gap: 6,
  },
  noteText: {
    fontFamily: appTypography.bodySemibold,
    fontSize: 14,
    color: appColors.ink,
    lineHeight: 20,
  },
  fee: {
    fontFamily: appTypography.bodyRegular,
    fontSize: 13,
    color: appColors.mutedInk,
  },
  safari: {
    textAlign: 'center',
    color: appColors.mutedInk,
    fontFamily: appTypography.bodyRegular,
    fontSize: 13,
  },
  dismiss: {
    textAlign: 'center',
    color: appColors.primary,
    fontFamily: appTypography.bodySemibold,
    fontSize: 16,
    paddingVertical: 8,
  },
});
