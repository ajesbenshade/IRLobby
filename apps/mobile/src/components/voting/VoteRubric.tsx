import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { View } from '@components/RNCompat';
import { appColors, appTypography } from '@theme/index';
import { VOTING_COPY, VOTE_RUBRIC } from '@shared/voting';

/** Before you post. Guidance only — posting does not depend on opening it. */
export const VoteRubric = ({ startCollapsed }: { startCollapsed: boolean }) => {
  const [open, setOpen] = useState(!startCollapsed);

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={styles.header}
      >
        <Text style={styles.title}>{VOTING_COPY.rubricTitle}</Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={appColors.mutedInk} />
      </Pressable>
      {open
        ? VOTE_RUBRIC.map((item, index) => (
            <Text key={item.title} style={styles.item}>
              {index + 1}. <Text style={styles.itemTitle}>{item.title}.</Text> {item.body}
            </Text>
          ))
        : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: appColors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.ink },
  item: { color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 14, lineHeight: 20, marginBottom: 10 },
  itemTitle: { color: appColors.ink, fontFamily: appTypography.bodySemibold },
});
