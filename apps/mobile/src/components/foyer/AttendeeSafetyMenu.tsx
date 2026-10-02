import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ActionSheet, BlockSheet, ReportSheet } from '@components/foyer/SafetySheets';
import { MEMBER_COPY } from '@constants/foyerCopy';
import { blockUser } from '@services/moderationService';
import { canReport, submitReport } from '@services/reportAdapter';
import { appColors } from '@theme/index';

/**
 * `…` on an adult attendee row: Report and Block. Teens, under-13 family members and anyone without a user id
 * get no menu at all (callers simply do not render this).
 */
export const AttendeeSafetyMenu = ({ userId, name }: { userId: number | string | null | undefined; name: string }) => {
  const [sheet, setSheet] = useState<'menu' | 'report' | 'block' | null>(null);
  if (userId == null || !canReport({ type: 'attendee', userId })) {
    return null;
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${MEMBER_COPY.reportOrBlock}: ${name}`}
        onPress={() => setSheet('menu')}
        hitSlop={6}
        style={styles.button}
        testID="attendee-more"
      >
        <MaterialCommunityIcons name="dots-horizontal" size={22} color={appColors.mutedInk} />
      </Pressable>
      <ActionSheet
        visible={sheet === 'menu'}
        onClose={() => setSheet(null)}
        rows={[
          { label: MEMBER_COPY.report, onPress: () => setSheet('report'), testID: 'attendee-report' },
          { label: MEMBER_COPY.block, onPress: () => setSheet('block'), testID: 'attendee-block' },
        ]}
      />
      <ReportSheet
        visible={sheet === 'report'}
        name={name}
        onClose={() => setSheet(null)}
        onSubmit={(payload) => submitReport({ type: 'attendee', userId }, payload)}
        onSent={() => setSheet(null)}
      />
      <BlockSheet visible={sheet === 'block'} name={name} onClose={() => setSheet(null)} onConfirm={() => blockUser(userId)} onDone={() => setSheet(null)} />
    </>
  );
};

const styles = StyleSheet.create({
  button: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
