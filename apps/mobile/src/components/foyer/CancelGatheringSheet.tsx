import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';

import { ConfirmSheet } from '@components/foyer/ConfirmSheet';
import { View } from '@components/RNCompat';
import { CANCEL_COPY } from '@constants/foyerCopy';
import { CANCEL_REASON_WARN_AT, MAX_CANCEL_REASON, clampReason, describeCancelEventError } from '@foyer/cancel';
import { CANCEL_QUERY_KEYS } from '@foyer/rsvp';
import { cancelEvent } from '@services/foyerService';
import { appColors, appTypography, radii } from '@theme/index';

type Props = {
  visible: boolean;
  activityId: number | string;
  onClose: () => void;
  /** The server confirmed. Parent shows `Gathering cancelled`. */
  onCancelled: () => void;
  /** 400 because the event already started: parent shows this as an error toast; the sheet has closed and data refreshed. */
  onStale: (message: string) => void;
};

/**
 * Host "Cancel this gathering?" sheet (frames 34-42). Optional reason up to 280 characters.
 * Confirm is the destructive #8a0a1f pill; while sending it uses the pressed colour and a spinner,
 * and Keep gathering is disabled. A generic failure keeps the sheet open with the reason intact.
 */
export const CancelGatheringSheet = ({ visible, activityId, onClose, onCancelled, onStale }: Props) => {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setReason('');
      setError(null);
      setPending(false);
    }
  }, [visible]);

  const refresh = () =>
    Promise.all(CANCEL_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey: [...queryKey] })));

  const confirm = async () => {
    if (pending) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await cancelEvent(activityId, reason);
      await refresh();
      onCancelled();
    } catch (failure) {
      const described = describeCancelEventError(failure);
      if (described.closeAndRefresh) {
        await refresh();
        onStale(described.message);
      } else {
        setError(described.message);
      }
    } finally {
      setPending(false);
    }
  };

  const count = reason.length;
  return (
    <ConfirmSheet
      visible={visible}
      title={CANCEL_COPY.sheetTitle}
      body={CANCEL_COPY.sheetBody}
      confirmLabel={CANCEL_COPY.confirm}
      cancelLabel={CANCEL_COPY.keep}
      confirmVariant="destructive"
      pending={pending}
      error={error}
      onConfirm={() => void confirm()}
      onCancel={onClose}
    >
      <View style={styles.field}>
        <Text style={styles.label}>{CANCEL_COPY.reasonLabel}</Text>
        <TextInput
          accessibilityLabel={CANCEL_COPY.reasonLabel}
          value={reason}
          onChangeText={(value) => setReason(clampReason(value))}
          placeholder={CANCEL_COPY.reasonPlaceholder}
          placeholderTextColor={appColors.softInk}
          maxLength={MAX_CANCEL_REASON}
          multiline
          editable={!pending}
          style={styles.input}
        />
        <Text
          accessibilityLabel={CANCEL_COPY.reasonCounter(count, MAX_CANCEL_REASON)}
          style={[styles.counter, count >= CANCEL_REASON_WARN_AT ? styles.counterWarn : null]}
        >
          {CANCEL_COPY.reasonCounter(count, MAX_CANCEL_REASON)}
        </Text>
      </View>
    </ConfirmSheet>
  );
};

const styles = StyleSheet.create({
  field: { gap: 6, marginTop: 12 },
  label: { fontFamily: appTypography.bodySemibold, fontSize: 13, color: appColors.ink },
  input: {
    minHeight: 96,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
    paddingHorizontal: 14,
    paddingTop: 12,
    color: appColors.ink,
    fontFamily: appTypography.bodyRegular,
    textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end', fontFamily: appTypography.bodyRegular, fontSize: 12.5, color: appColors.mutedInk },
  counterWarn: { color: '#8a0a1f', fontFamily: appTypography.bodySemibold },
});
