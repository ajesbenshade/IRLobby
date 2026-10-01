import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { HelperText, Text } from 'react-native-paper';

import {
  AccentPill,
  AppScrollView,
  PageHeader,
  PanelCard,
  SectionIntro,
} from '@components/AppChrome';
import { ScrollView, View } from '@components/RNCompat';
import { AppButton } from '@components/ui/Button';
import { account as accountCopy } from '@constants/copy';
import { useAuth } from '@hooks/useAuth';
import { useSheetBottomPadding } from '@navigation/tabBarLayout';
import { deleteCurrentAccount } from '@services/accountService';
import { appColors, radii, spacing } from '@theme/index';
import { getErrorMessage } from '@utils/error';

export const AccountScreen = () => {
  const { signOut, markAccountDeleted } = useAuth();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const { height: windowHeight } = useWindowDimensions();
  const sheetBottomPadding = useSheetBottomPadding();

  const deleteAccountMutation = useMutation({
    mutationFn: deleteCurrentAccount,
    onSuccess: async () => {
      markAccountDeleted();
      await signOut();
    },
  });

  const isDeleting = deleteAccountMutation.isPending;
  const deleteError = deleteAccountMutation.error
    ? getErrorMessage(deleteAccountMutation.error, accountCopy.deleteError)
    : null;

  const closeConfirm = () => {
    if (isDeleting) {
      return;
    }
    setConfirmVisible(false);
    deleteAccountMutation.reset();
  };

  return (
    <AppScrollView contentContainerStyle={styles.container}>
      <PageHeader
        eyebrow={accountCopy.screenEyebrow}
        title={accountCopy.screenTitle}
        subtitle={accountCopy.screenSubtitle}
        rightContent={<AccentPill tone="neutral">Signed in</AccentPill>}
      />

      <PanelCard tone="dark" style={styles.dangerCard}>
        <SectionIntro
          eyebrow="Permanent deletion"
          title="Delete your account on The Foyer"
          subtitle="This permanently deletes your profile, matches, and chat. It is not a deactivate."
        />
        <View style={styles.dangerBox}>
          <AppButton
            onPress={() => {
              deleteAccountMutation.reset();
              setConfirmVisible(true);
            }}
            disabled={isDeleting}
            style={styles.destructiveButton}
          >
            {accountCopy.deleteCta}
          </AppButton>
        </View>
      </PanelCard>

      <Modal
        visible={confirmVisible}
        transparent
        animationType="slide"
        onRequestClose={closeConfirm}
      >
        <Pressable style={styles.backdrop} onPress={closeConfirm}>
          <Pressable
            style={[styles.sheet, { maxHeight: Math.round(windowHeight * 0.9), paddingBottom: sheetBottomPadding }]}
            onPress={(event) => event.stopPropagation()}
          >
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
            <Text variant="titleLarge" style={styles.sheetTitle}>
              {accountCopy.confirmTitle}
            </Text>
            <Text style={styles.sheetBody}>{accountCopy.confirmBody}</Text>
            {deleteError ? (
              <HelperText type="error" visible>
                {deleteError}
              </HelperText>
            ) : null}
            <View style={styles.sheetActions}>
              <AppButton
                onPress={() => deleteAccountMutation.mutate()}
                loading={isDeleting}
                disabled={isDeleting}
                style={styles.destructiveButton}
              >
                {accountCopy.confirmPrimary}
              </AppButton>
              <AppButton variant="outline" onPress={closeConfirm} disabled={isDeleting}>
                {accountCopy.confirmCancel}
              </AppButton>
            </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </AppScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  dangerCard: {
    gap: spacing.md,
  },
  dangerBox: {
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#6b1d25',
    backgroundColor: '#231014',
    padding: spacing.md,
  },
  destructiveButton: {
    backgroundColor: appColors.danger,
  },
  backdrop: {
    flex: 1,
    backgroundColor: appColors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: appColors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sheetScroll: {
    gap: spacing.sm,
  },
  sheetTitle: {
    color: appColors.ink,
    fontWeight: '800',
    lineHeight: 32,
    letterSpacing: -0.4,
  },
  sheetBody: {
    color: appColors.mutedInk,
    lineHeight: 22,
    fontSize: 15,
  },
  sheetActions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
