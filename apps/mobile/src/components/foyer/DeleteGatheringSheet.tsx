import { StyleSheet, Text } from 'react-native';

import { FoyerSheet } from '@components/foyer/FoyerSheet';
import { ErrorNotice, PillButton, SheetButtons } from '@components/foyer/ui';
import { DELETE_GATHERING_COPY } from '@constants/foyerCopy';
import { appColors, appTypography } from '@theme/index';

/**
 * Body for `Delete this gathering?`. Hosts under the weekly limit (`event_limit_exempt` not true) also read that
 * deleting doesn't free up this week's slot (frame delete-gathering-sheet-limited). Missing field = not exempt.
 */
export const deleteGatheringBody = (eventLimitExempt?: boolean | null) =>
  eventLimitExempt ? DELETE_GATHERING_COPY.body : `${DELETE_GATHERING_COPY.body} ${DELETE_GATHERING_COPY.limitedLine}`;

/**
 * Delete gathering confirmation (frame 250; 253 for non-exempt hosts). Opened from the host's `Delete gathering`
 * action on GatheringDetailScreen. Cancelling a gathering keeps its photos and uses CancelGatheringSheet instead.
 */
export const DeleteGatheringSheet = ({
  visible,
  eventLimitExempt,
  pending,
  error,
  onDelete,
  onKeep,
}: {
  visible: boolean;
  eventLimitExempt?: boolean | null;
  pending?: boolean;
  error?: string | null;
  onDelete: () => void;
  onKeep: () => void;
}) => (
  <FoyerSheet
    visible={visible}
    onDismiss={onKeep}
    footer={
      <SheetButtons>
        <ErrorNotice message={error} testID="delete-gathering-error" />
        <PillButton
          label={DELETE_GATHERING_COPY.confirm}
          variant="destructiveOutline"
          loading={pending}
          onPress={onDelete}
          testID="delete-gathering-confirm"
        />
        <PillButton label={DELETE_GATHERING_COPY.keep} disabled={pending} onPress={onKeep} testID="delete-gathering-keep" />
      </SheetButtons>
    }
  >
    <Text accessibilityRole="header" style={styles.title}>
      {DELETE_GATHERING_COPY.title}
    </Text>
    <Text style={styles.body} testID="delete-gathering-body">
      {deleteGatheringBody(eventLimitExempt)}
    </Text>
  </FoyerSheet>
);

const styles = StyleSheet.create({
  title: { fontFamily: appTypography.heading, fontSize: 24, lineHeight: 32, color: appColors.ink },
  body: { fontFamily: appTypography.bodyRegular, fontSize: 15, lineHeight: 22, color: appColors.ink },
});
