import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AppScrollView } from '@components/AppChrome';
import { Avatar, InlineError, PillButton, SectionLabel } from '@components/foyer/ui';
import { View } from '@components/RNCompat';
import { COMMON_COPY, MESSAGING_COPY } from '@constants/foyerCopy';
import { fetchBlockedPeople } from '@services/foyerService';
import { unblockUser } from '@services/moderationService';
import { appColors, appTypography, radii } from '@theme/index';
import { getErrorMessage } from '@utils/error';

/** Profile > Messaging: blocked people with Unblock. */
export const MessagingScreen = () => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const blockedQuery = useQuery({ queryKey: ['foyer-blocked'], queryFn: fetchBlockedPeople });
  const blocked = blockedQuery.data ?? [];

  const unblock = useMutation({
    mutationFn: (userId: number) => unblockUser(userId),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['foyer-blocked'] });
    },
    onError: (unblockError) => setError(getErrorMessage(unblockError, COMMON_COPY.genericError)),
  });

  return (
    <AppScrollView contentContainerStyle={styles.container}>
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.back}>Profile</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          {MESSAGING_COPY.title}
        </Text>
        <View style={styles.backButton} />
      </View>
      <Text style={styles.helper}>{MESSAGING_COPY.blockedNever}</Text>
      <SectionLabel>{MESSAGING_COPY.blockedSection}</SectionLabel>
      <View style={styles.list}>
        {blocked.length === 0 ? <Text style={[styles.helper, styles.pad]}>{MESSAGING_COPY.noBlocked}</Text> : null}
        {blocked.map((person) => {
          const label = person.blocked_username || `Member ${person.blocked}`;
          return (
            <View key={person.id} style={styles.row}>
              <Avatar initials={(label.charAt(0) || '?').toUpperCase()} size={40} />
              <Text style={styles.name}>{label}</Text>
              <PillButton
                label={MESSAGING_COPY.unblock}
                variant="outline"
                disabled={unblock.isPending}
                style={styles.unblock}
                onPress={() => unblock.mutate(person.blocked)}
              />
            </View>
          );
        })}
      </View>
      <InlineError message={error} />
    </AppScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14, paddingBottom: 48 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButton: { minWidth: 72, minHeight: 48, justifyContent: 'center' },
  back: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 16 },
  title: { flex: 1, fontFamily: appTypography.bodySemibold, fontSize: 17, color: appColors.ink, textAlign: 'center' },
  helper: { color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 13, lineHeight: 19 },
  pad: { padding: 16 },
  list: { backgroundColor: appColors.white, borderRadius: radii.list, overflow: 'hidden' },
  row: { minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { flex: 1, flexShrink: 1, fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.ink },
  unblock: { minHeight: 48, paddingHorizontal: 16 },
});
