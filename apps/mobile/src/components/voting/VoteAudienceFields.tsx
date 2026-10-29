import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Checkbox } from '@components/foyer/Choice';
import { FoyerSheet } from '@components/foyer/FoyerSheet';
import { Switch } from '@components/foyer/Switch';
import { View } from '@components/RNCompat';
import { appColors, appTypography } from '@theme/index';
import { VOTING_COPY, adminCircles, selectedAudienceLabel, type VoteCircle } from '@shared/voting';

type Props = {
  circles: VoteCircle[];
  selectedIds: Array<number | string>;
  onChangeSelected: (ids: Array<number | string>) => void;
  wholeChurch: boolean;
  onChangeWholeChurch: (value: boolean) => void;
  isChurchAdmin: boolean;
  circlesStatus: 'loading' | 'ready' | 'empty' | 'unavailable' | 'error';
};

/** Circles the person admins, plus Whole church for a church admin. Whole church starts off. */
export const VoteAudienceFields = ({
  circles,
  selectedIds,
  onChangeSelected,
  wholeChurch,
  onChangeWholeChurch,
  isChurchAdmin,
  circlesStatus,
}: Props) => {
  const [open, setOpen] = useState(false);
  const admins = adminCircles(circles);

  const toggle = (id: number | string) => {
    const exists = selectedIds.some((selected) => String(selected) === String(id));
    onChangeSelected(exists ? selectedIds.filter((selected) => String(selected) !== String(id)) : [...selectedIds, id]);
  };
  const showEmpty =
    circlesStatus === 'empty' || circlesStatus === 'unavailable' || (circlesStatus === 'ready' && admins.length === 0);

  return (
    <View style={styles.block}>
      <Text style={styles.section}>{VOTING_COPY.whoVotes}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${VOTING_COPY.whoVotes} ${selectedAudienceLabel(circles, selectedIds, wholeChurch)}`}
        onPress={() => setOpen(true)}
        style={styles.row}
        testID="vote-circle-picker"
      >
        <MaterialCommunityIcons name="account-outline" size={22} color={appColors.mutedInk} />
        <Text style={styles.visible}>{VOTING_COPY.whoVotes}</Text>
        <Text style={styles.choice} numberOfLines={1}>
          {selectedAudienceLabel(circles, selectedIds, wholeChurch)}
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={22} color={appColors.mutedInk} />
      </Pressable>
      {isChurchAdmin ? (
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>{VOTING_COPY.wholeChurch}</Text>
          <Switch
            value={wholeChurch}
            onValueChange={onChangeWholeChurch}
            accessibilityLabel={VOTING_COPY.wholeChurch}
            testID="vote-whole-church"
          />
        </View>
      ) : null}
      <Text style={styles.helper}>{wholeChurch ? VOTING_COPY.wholeChurchOn : VOTING_COPY.wholeChurchOff}</Text>
      <FoyerSheet visible={open} onDismiss={() => setOpen(false)}>
        <Text accessibilityRole="header" style={styles.sheetTitle}>
          {VOTING_COPY.whoVotes}
        </Text>
        {circlesStatus === 'loading' ? <Text style={styles.helper}>{VOTING_COPY.circlesLoading}</Text> : null}
        {showEmpty ? <Text style={styles.helper}>{VOTING_COPY.circlesEmpty}</Text> : null}
        {circlesStatus === 'error' ? <Text style={styles.helper}>{VOTING_COPY.circlesFailed}</Text> : null}
        {admins.map((circle) => {
          const selected = selectedIds.some((id) => String(id) === String(circle.id));
          return (
            <Pressable
              key={String(circle.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              onPress={() => toggle(circle.id)}
              style={styles.circleRow}
            >
              <Checkbox checked={selected} />
              <Text style={styles.circleName}>{circle.name}</Text>
            </Pressable>
          );
        })}
      </FoyerSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  block: { gap: 8 },
  section: { fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.ink, marginTop: 8 },
  row: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: appColors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  visible: { color: appColors.ink, fontFamily: appTypography.bodyRegular, fontSize: 16 },
  choice: { flex: 1, textAlign: 'right', color: appColors.ink, fontFamily: appTypography.bodySemibold, fontSize: 16 },
  toggleRow: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: appColors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleLabel: { flex: 1, fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.ink },
  helper: { color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 14, lineHeight: 20 },
  sheetTitle: { fontFamily: appTypography.heading, fontSize: 28, lineHeight: 34, color: appColors.ink, marginBottom: 8 },
  circleRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12 },
  circleName: { flex: 1, fontFamily: appTypography.bodyRegular, fontSize: 17, color: appColors.ink },
});
