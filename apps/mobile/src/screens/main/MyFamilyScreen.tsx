import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AppScrollView } from '@components/AppChrome';
import { AddFamilyMemberSheet } from '@components/foyer/AddFamilyMemberSheet';
import { AddDaySheet, FamilyMemberActionSheet, RemoveFamilyMemberSheet } from '@components/foyer/FamilyMemberSheets';
import { Avatar, EmptyState, PillButton, SectionLabel } from '@components/foyer/ui';
import { View } from '@components/RNCompat';
import { FAMILY_COPY } from '@constants/foyerCopy';
import { isMonthYearOnly, memberBirthLine, memberInitials } from '@foyer/family';
import { useSheetHandoff } from '@hooks/useSheetHandoff';
import { fetchFamilyMembers, type FamilyMember } from '@services/foyerService';
import { appColors, appTypography, radii } from '@theme/index';

export const FAMILY_QUERY_KEY = ['foyer-household'] as const;

/** My family: children under 18 for RSVPs. Only the signed-in user can see it. */
export const MyFamilyScreen = () => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<FamilyMember | null>(null);
  const [editing, setEditing] = useState<FamilyMember | null>(null);
  const [removing, setRemoving] = useState<FamilyMember | null>(null);
  const [addingDay, setAddingDay] = useState<FamilyMember | null>(null);
  const membersQuery = useQuery({ queryKey: FAMILY_QUERY_KEY, queryFn: fetchFamilyMembers });
  const members = membersQuery.data ?? [];

  // One sheet at a time: a row sheet closes completely before Edit / Remove opens (iOS freezes if both change in one render).
  const handoff = useSheetHandoff();

  const refresh = () => void queryClient.invalidateQueries({ queryKey: FAMILY_QUERY_KEY });

  return (
    <AppScrollView headerless contentContainerStyle={styles.container}>
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
      {members.length === 0 && !membersQuery.isLoading ? (
        <>
          <EmptyState title={FAMILY_COPY.emptyTitle} body={FAMILY_COPY.emptyBody} />
          <PillButton label={FAMILY_COPY.add} icon="plus" onPress={() => setAdding(true)} testID="family-add" />
        </>
      ) : (
        <>
          <SectionLabel>{FAMILY_COPY.section}</SectionLabel>
          <View style={styles.list}>
            {members.map((member) => {
              const monthOnly = isMonthYearOnly(member);
              return (
                <View key={member.id} style={styles.row}>
                  <Avatar initials={memberInitials(member.name ?? '')} size={40} />
                  <View style={styles.copy}>
                    <Text style={styles.name}>{member.name ?? ''}</Text>
                    <Text style={styles.meta}>{memberBirthLine(member)}</Text>
                  </View>
                  {monthOnly ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${FAMILY_COPY.addDay} ${member.name}`}
                      onPress={() => setAddingDay(member)}
                      style={styles.addDay}
                    >
                      <Text style={styles.addDayText}>{FAMILY_COPY.addDay}</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={member.name}
                    onPress={() => setSelected(member)}
                    style={styles.chevron}
                    testID={`family-row-${member.id}`}
                  >
                    <MaterialCommunityIcons name="chevron-right" size={24} color={appColors.softInk} />
                  </Pressable>
                </View>
              );
            })}
          </View>
          <PillButton label={FAMILY_COPY.add} variant="outline" icon="plus" onPress={() => setAdding(true)} testID="family-add" />
        </>
      )}
      <Text style={styles.footer}>{FAMILY_COPY.footer}</Text>
      <AddFamilyMemberSheet
        visible={adding}
        onCancel={() => setAdding(false)}
        onAdded={() => {
          setAdding(false);
          refresh();
        }}
      />
      <FamilyMemberActionSheet
        member={selected}
        onCancel={() => setSelected(null)}
        onClosed={handoff.flush}
        onEdit={(member) => {
          handoff.after(() => setEditing(member));
          setSelected(null);
        }}
        onRemove={(member) => {
          handoff.after(() => setRemoving(member));
          setSelected(null);
        }}
      />
      <AddFamilyMemberSheet
        visible={editing != null}
        member={editing}
        onClosed={handoff.flush}
        onRemove={(member) => {
          handoff.after(() => setRemoving(member));
          setEditing(null);
        }}
        onCancel={() => setEditing(null)}
        onAdded={() => {
          setEditing(null);
          refresh();
        }}
      />
      <RemoveFamilyMemberSheet
        member={removing}
        onKeep={() => setRemoving(null)}
        onRemoved={() => {
          setRemoving(null);
          refresh();
        }}
      />
      <AddDaySheet
        member={addingDay}
        onCancel={() => setAddingDay(null)}
        onSaved={() => {
          setAddingDay(null);
          refresh();
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
  chevron: { minHeight: 48, minWidth: 40, alignItems: 'center', justifyContent: 'center' },
  addDay: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  addDayText: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 14, textDecorationLine: 'underline' },
  footer: { color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 11.5, lineHeight: 16 },
});
