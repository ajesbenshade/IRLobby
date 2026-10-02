import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ConfirmSheet } from '@components/foyer/ConfirmSheet';
import { GOING_COPY } from '@constants/foyerCopy';
import { CANCEL_QUERY_KEYS } from '@foyer/rsvp';
import { cancelRsvp, clearPass } from '@services/foyerService';
import { getErrorMessage } from '@utils/error';

type Props = {
  visible: boolean;
  activityId: number | string;
  title: string;
  onClose: () => void;
  /** Runs after the server confirms. Callers show the `RSVP cancelled` toast and reset the deck. */
  onCancelled: () => void;
};

/** The server's own 400 message (host, already started, no RSVP) is shown inside the sheet. */
export const cancelErrorMessage = (error: unknown): string => {
  const data = (error as { response?: { data?: { detail?: unknown; error?: unknown; message?: unknown } } })?.response?.data;
  for (const candidate of [data?.detail, data?.error, data?.message]) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return getErrorMessage(error, 'Unable to cancel your RSVP.');
};

/** Confirm sheet for Cancel RSVP. Refreshes the deck, Gatherings and detail on success. */
export const CancelRsvpSheet = ({ visible, activityId, title, onClose, onCancelled }: Props) => {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setPending(true);
    setError(null);
    try {
      await cancelRsvp(activityId);
      // The server clears the pass too; this is a best-effort second clear and never blocks.
      await clearPass(activityId).catch(() => false);
      await Promise.all(CANCEL_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey: [...queryKey] })));
      onCancelled();
    } catch (cancelError) {
      setError(cancelErrorMessage(cancelError));
    } finally {
      setPending(false);
    }
  };

  return (
    <ConfirmSheet
      visible={visible}
      title={GOING_COPY.cancelTitle}
      body={GOING_COPY.cancelBody(title)}
      confirmLabel={GOING_COPY.cancelRsvp}
      cancelLabel={GOING_COPY.keepRsvp}
      pending={pending}
      error={error}
      onConfirm={() => void confirm()}
      onCancel={() => {
        setError(null);
        onClose();
      }}
    />
  );
};
