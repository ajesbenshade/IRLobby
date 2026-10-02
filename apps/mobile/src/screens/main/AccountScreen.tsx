import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { FoyerSheet } from '@components/foyer/FoyerSheet';
import { PillButton, SheetButtons } from '@components/foyer/ui';
import { View } from '@components/RNCompat';
import { DELETE_ACCOUNT_COPY } from '@constants/foyerCopy';
import { isDeleteWordTyped, upcomingHostedCount } from '@foyer/deleteAccount';
import { useAuth } from '@hooks/useAuth';
import { deleteCurrentAccount } from '@services/accountService';
import { fetchHostedActivities } from '@services/activityService';
import { appColors, appTypography, radii } from '@theme/index';

/**
 * Delete account (frames 90-91). Server: DELETE /api/users/profile/delete/ (204). Keep my account is the filled
 * primary in the sticky footer; Delete my account is a dark-red outlined pill that unlocks after typing DELETE.
 */
export const AccountScreen = () => {
  const { signOut } = useAuth();
  const navigation = useNavigation();
  const [typed, setTyped] = useState('');
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(false);
  const hosted = useQuery({ queryKey: ['foyer-hosted'], queryFn: fetchHostedActivities, retry: false });
  const hostedCount = upcomingHostedCount(hosted.data as never);

  const deleteMutation = useMutation({
    mutationFn: deleteCurrentAccount,
    onSuccess: () => setDone(true),
    onError: () => setFailed(true),
  });
  const working = deleteMutation.isPending;
  const unlocked = isDeleteWordTyped(typed) && !working;

  const askConfirm = () =>
    Alert.alert(DELETE_ACCOUNT_COPY.alertTitle, DELETE_ACCOUNT_COPY.alertBody, [
      { text: DELETE_ACCOUNT_COPY.alertCancel, style: 'cancel' },
      { text: DELETE_ACCOUNT_COPY.alertDelete, style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={styles.title}>{DELETE_ACCOUNT_COPY.deleteRowTitle}</Text>
        <Text style={styles.body}>{DELETE_ACCOUNT_COPY.screenBody}</Text>
        {DELETE_ACCOUNT_COPY.bullets.map((bullet) => (
          <View key={bullet} style={styles.bulletRow}>
            <Text style={styles.body}>•</Text>
            <Text style={[styles.body, styles.bulletText]}>{bullet}</Text>
          </View>
        ))}
        <Text style={styles.body}>{DELETE_ACCOUNT_COPY.retention}</Text>
        {hostedCount > 0 ? (
          <View style={styles.hostingNote} testID="hosting-note">
            <Text style={styles.hostingText}>{DELETE_ACCOUNT_COPY.hostingNote(hostedCount)}</Text>
          </View>
        ) : null}
        <Text style={styles.label}>{DELETE_ACCOUNT_COPY.typeLabel}</Text>
        <TextInput
          accessibilityLabel={DELETE_ACCOUNT_COPY.typeLabel}
          value={typed}
          onChangeText={setTyped}
          editable={!working}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={DELETE_ACCOUNT_COPY.typeWord}
          placeholderTextColor={appColors.softInk}
          style={styles.input}
          testID="delete-input"
        />
        <PillButton
          label={working ? DELETE_ACCOUNT_COPY.working : DELETE_ACCOUNT_COPY.deleteButton}
          variant="destructiveOutline"
          disabled={!unlocked}
          loading={working}
          onPress={askConfirm}
          testID="delete-button"
        />
      </ScrollView>
      <View style={styles.footer}>
        <PillButton label={DELETE_ACCOUNT_COPY.keepButton} disabled={working} onPress={() => navigation.goBack()} testID="keep-button" />
      </View>

      <FoyerSheet
        visible={failed && !working}
        onDismiss={() => setFailed(false)}
        footer={
          <SheetButtons>
            <PillButton
              label={DELETE_ACCOUNT_COPY.tryAgain}
              onPress={() => {
                setFailed(false);
                deleteMutation.mutate();
              }}
            />
            <PillButton label={DELETE_ACCOUNT_COPY.alertCancel} variant="outline" onPress={() => setFailed(false)} />
          </SheetButtons>
        }
      >
        <Text accessibilityRole="header" style={styles.sheetTitle}>{DELETE_ACCOUNT_COPY.failedTitle}</Text>
        <Text style={styles.body}>{DELETE_ACCOUNT_COPY.failedBody}</Text>
      </FoyerSheet>

      <FoyerSheet
        visible={done}
        onDismiss={() => void signOut()}
        footer={
          <SheetButtons>
            <PillButton label={DELETE_ACCOUNT_COPY.close} onPress={() => void signOut()} testID="done-close" />
          </SheetButtons>
        }
      >
        <Text accessibilityRole="header" style={styles.sheetTitle}>{DELETE_ACCOUNT_COPY.doneTitle}</Text>
        <Text style={styles.body}>{DELETE_ACCOUNT_COPY.doneBody}</Text>
      </FoyerSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: appColors.background },
  content: { padding: 20, gap: 12 },
  title: { fontFamily: appTypography.heading, fontSize: 28, color: appColors.ink },
  body: { fontFamily: appTypography.bodyRegular, fontSize: 15, lineHeight: 22, color: appColors.ink },
  bulletRow: { flexDirection: 'row', gap: 8 },
  bulletText: { flex: 1 },
  hostingNote: { backgroundColor: appColors.primarySoft, borderRadius: radii.list, padding: 14 },
  hostingText: { fontFamily: appTypography.bodySemibold, fontSize: 14, color: appColors.ink },
  label: { fontFamily: appTypography.bodySemibold, fontSize: 14, color: appColors.ink, marginTop: 8 },
  input: { minHeight: 52, borderRadius: radii.list, borderWidth: 1, borderColor: '#cec8c4', backgroundColor: appColors.white, paddingHorizontal: 14, fontSize: 16, color: appColors.ink },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e1dbd7', backgroundColor: appColors.background },
  sheetTitle: { fontFamily: appTypography.heading, fontSize: 22, color: appColors.ink },
});
