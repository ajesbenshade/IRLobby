import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AppScrollView } from '@components/AppChrome';
import { AddFamilyMemberSheet } from '@components/foyer/AddFamilyMemberSheet';
import { Avatar, InlineError, PillButton, SectionLabel } from '@components/foyer/ui';
import { View } from '@components/RNCompat';
import { COMMON_COPY, FAMILY_COPY } from '@constants/foyerCopy';
import { ageBandForAge, hasSpouse, memberInitials, relationshipLabel } from '@foyer/family';
import { fetchFamilyMembers, removeHouseholdChild, type FamilyMember } from '@services/foyerService';
import { appColors, appTypography, radii } from '@theme/index';
import { getErrorMessage } from '@utils/error';

export const FAMILY_QUERY_KEY = ['foyer-household'] as const;

export const memberAgeBandLine = (member: FamilyMember): string | null => {
  if (member.relationship !== 'child') {
    return null;
  }
  const band = ageBandForAge(member.age);
  return band ? FAMILY_COPY.ageBand(band) : null;
};

/** My family: spouse and children under 18 for RSVPs. Only the signed-in user can see it. */
export const MyFamilyScreen = () => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const membersQuery = useQuery({ queryKey: FAMILY_QUERY_KEY, queryFn: fetchFamilyMembers });
  const members = membersQuery.data ?? [];

  const removeMutation = useMutation({
    mutationFn: (id: number) => removeHouseholdChild(id),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: FAMILY_QUERY_KEY });
    },
    onError: (removeError) => setError(getErrorMessage(removeError, COMMON_COPY.genericError)),
  });

  return (
    <AppScrollView contentContainerStyle={styles.container}>
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text maxFontSizeMultiplier={1.4} style={styles.back}>
            {FAMILY_COPY.back}
          </Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          {FAMILY_COPY.title}
        </Text>
        <View style={styles.backButton} />
      </View>
      <Text style={styles.intro}>{FAMILY_COPY.intro}</Text>
      <SectionLabel>{FAMILY_COPY.section}</SectionLabel>
      <View style={styles.list}>
        {members.map((member) => {
          const band = memberAgeBandLine(member);
          return (
            <View key={member.id} style={styles.row}>
              <Avatar initials={memberInitials(member.name)} size={40} />
              <View style={styles.copy}>
                <Text style={styles.name}>{member.name}</Text>
                {band ? <Text style={styles.meta}>{band}</Text> : null}
              </View>
              <View style={styles.chip}>
                <Text style={styles.chipText}>{relationshipLabel(member.relationship)}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${FAMILY_COPY.remove} ${member.name}`}
                disabled={removeMutation.isPending}
                onPress={() => removeMutation.mutate(member.id)}
                style={styles.remove}
              >
                <Text style={styles.removeText}>{FAMILY_COPY.remove}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      <InlineError message={error} />
      <PillButton label={FAMILY_COPY.add} variant="outline" icon="plus" onPress={() => setAdding(true)} />
      <Text style={styles.footer}>{FAMILY_COPY.footer}</Text>
      <AddFamilyMemberSheet
        visible={adding}
        hasSpouse={hasSpouse(members)}
        onCancel={() => setAdding(false)}
        onAdded={() => {
          setAdding(false);
          void queryClient.invalidateQueries({ queryKey: FAMILY_QUERY_KEY });
        }}
      />
    </AppScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14, paddingBottom: 48 },
  back: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButton: { minWidth: 72, minHeight: 48, justifyContent: 'center' },
  title: { flex: 1, fontFamily: appTypography.bodySemibold, fontSize: 17, lineHeight: 24, color: appColors.ink, textAlign: 'center' },
  intro: { fontFamily: appTypography.bodyRegular, fontSize: 15, color: appColors.ink, lineHeight: 22 },
  list: { backgroundColor: appColors.white, borderRadius: radii.list, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, minHeight: 64, borderBottomWidth: 1, borderBottomColor: appColors.line },
  copy: { flex: 1, flexShrink: 1 },
  name: { fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.ink },
  meta: { fontFamily: appTypography.bodyRegular, fontSize: 13, color: appColors.mutedInk },
  chip: { backgroundColor: appColors.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 12 },
  remove: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 14 },
  footer: { color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 11.5, lineHeight: 16 },
});
