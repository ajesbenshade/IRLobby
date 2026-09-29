import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text } from 'react-native';

import { View } from '@components/RNCompat';
import { AppButton } from '@components/ui/Button';
import { Field } from '@components/ui/Field';
import {
  fetchDependents,
  giveToActivity,
  rsvpActivity,
  type HouseholdDependent,
} from '@services/activityService';
import { appColors, appTypography, spacing } from '@theme/index';
import { getErrorMessage } from '@utils/error';

import type { Activity } from '../types/activity';

type FoyerGoingSheetProps = {
  activity: Activity | null;
  onClose: () => void;
  onJoined: () => void;
};

const giftCopy = (activity: Activity) => {
  const notice = (activity as { gift_notice?: string }).gift_notice;
  if (notice) {
    return notice;
  }
  if ((activity as { host_kind?: string }).host_kind === 'church') {
    return 'A gift on this event goes to Franconia Mennonite Church. Stripe’s card fee still applies. The Foyer does not take a cut.';
  }
  return 'A gift to this host is a contribution to that person, not a tax-deductible church gift. Stripe’s card fee still applies. The Foyer does not take a cut.';
};

export const FoyerGoingSheet = ({ activity, onClose, onJoined }: FoyerGoingSheetProps) => {
  const [includeSelf, setIncludeSelf] = useState(true);
  const [selected, setSelected] = useState<number[]>([]);
  const [step, setStep] = useState<'who' | 'give' | 'next'>('who');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const dependentsQuery = useQuery({
    queryKey: ['household-dependents'],
    queryFn: fetchDependents,
    enabled: activity != null,
  });

  const rsvpMutation = useMutation({
    mutationFn: () =>
      rsvpActivity(activity!.id, { include_self: includeSelf, dependent_ids: selected }),
    onSuccess: (result) => {
      setError(null);
      const suggested = result.suggested_donation && result.suggested_donation !== '0.00'
        ? result.suggested_donation
        : '';
      setAmount(suggested);
      if (result.donation_enabled) {
        setStep('give');
      } else {
        setStep('next');
      }
    },
    onError: (err) => setError(getErrorMessage(err, 'Could not save who is coming.')),
  });

  const giveMutation = useMutation({
    mutationFn: () => giveToActivity(activity!.id, amount),
    onSuccess: async (result) => {
      if (result.url) {
        await Linking.openURL(result.url);
      }
      setStep('next');
    },
    onError: (err) => setError(getErrorMessage(err, 'Could not start the gift.')),
  });

  const close = () => {
    setStep('who');
    setIncludeSelf(true);
    setSelected([]);
    setError(null);
    onClose();
  };

  const toggleChild = (child: HouseholdDependent) => {
    setSelected((current) =>
      current.includes(child.id) ? current.filter((id) => id !== child.id) : [...current, child.id],
    );
  };

  return (
    <Modal visible={activity != null} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.kicker}>Franconia Mennonite Church</Text>
          <Text style={styles.title}>
            {step === 'who' ? 'Who is coming?' : step === 'give' ? 'Optional gift' : 'You’re in'}
          </Text>
          {activity ? <Text style={styles.event}>{activity.title}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {step === 'who' ? (
            <>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: includeSelf }} onPress={() => setIncludeSelf((value) => !value)} style={styles.row}>
                <Text style={styles.rowLabel}>{includeSelf ? '✓ Me' : 'Me'}</Text>
              </Pressable>
              {(dependentsQuery.data ?? []).map((child) => {
                const checked = selected.includes(child.id);
                return (
                  <Pressable key={child.id} accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => toggleChild(child)} style={styles.row}>
                    <Text style={styles.rowLabel}>
                      {checked ? '✓ ' : ''}
                      {child.first_name} {child.last_name}
                    </Text>
                  </Pressable>
                );
              })}
              <AppButton onPress={() => rsvpMutation.mutate()} loading={rsvpMutation.isPending}>
                I’m going
              </AppButton>
            </>
          ) : null}

          {step === 'give' && activity ? (
            <>
              <Text style={styles.notice}>{giftCopy(activity)}</Text>
              <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
              <AppButton onPress={() => giveMutation.mutate()} loading={giveMutation.isPending} disabled={!amount.trim()}>
                Give
              </AppButton>
              <AppButton variant="ghost" onPress={() => setStep('next')}>
                Skip
              </AppButton>
            </>
          ) : null}

          {step === 'next' ? (
            <>
              <Text style={styles.notice}>Photos and chat are open now that someone from your household is going.</Text>
              <AppButton
                onPress={() => {
                  onJoined();
                  close();
                }}
              >
                Open chat
              </AppButton>
            </>
          ) : null}

          <AppButton variant="outline" onPress={close}>
            Close
          </AppButton>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(34, 34, 34, 0.4)',
  },
  sheet: {
    backgroundColor: appColors.surface,
    padding: spacing.lg,
    gap: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  kicker: {
    color: appColors.primary,
    fontSize: 12,
  },
  title: {
    fontFamily: appTypography.heading,
    fontSize: 28,
    color: appColors.ink,
  },
  event: {
    color: appColors.mutedInk,
  },
  notice: {
    color: appColors.ink,
    lineHeight: 20,
  },
  error: {
    color: appColors.danger,
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: appColors.line,
  },
  rowLabel: {
    color: appColors.ink,
    fontSize: 16,
  },
});
