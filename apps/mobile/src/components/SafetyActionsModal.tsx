import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Button, HelperText, RadioButton, Text } from 'react-native-paper';

import { TextInput } from '@components/PaperCompat';
import { ScrollView, View } from '@components/RNCompat';
import { useSheetBottomPadding } from '@navigation/tabBarLayout';
import {
  REPORT_REASON_OPTIONS,
  blockUser,
  reportUser,
  type ReportReason,
} from '@services/moderationService';
import { appColors } from '@theme/index';
import { getErrorMessage } from '@utils/error';

type SafetyActionsModalProps = {
  visible: boolean;
  userId: number | string | null;
  userLabel?: string;
  onClose: () => void;
  onBlocked?: () => void;
  onReported?: () => void;
};

export const SafetyActionsModal = ({
  visible,
  userId,
  userLabel,
  onClose,
  onBlocked,
  onReported,
}: SafetyActionsModalProps) => {
  const { height: windowHeight } = useWindowDimensions();
  const sheetBottomPadding = useSheetBottomPadding();
  const [mode, setMode] = useState<'menu' | 'report'>('menu');
  const [reason, setReason] = useState<ReportReason>('inappropriate');
  const [description, setDescription] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const displayName = useMemo(() => userLabel?.trim() || 'this person', [userLabel]);

  const blockMutation = useMutation({
    mutationFn: async () => {
      if (userId == null) {
        throw new Error('Missing user to block.');
      }
      await blockUser(userId);
    },
    onSuccess: () => {
      setStatusMessage(`${displayName} has been blocked.`);
      onBlocked?.();
      setTimeout(() => {
        handleClose();
      }, 700);
    },
  });

  const reportMutation = useMutation({
    mutationFn: async () => {
      if (userId == null) {
        throw new Error('Missing user to report.');
      }
      await reportUser({
        reportedUserId: userId,
        reason,
        description,
      });
    },
    onSuccess: () => {
      setStatusMessage('Report submitted. Thanks for helping keep plans safe.');
      onReported?.();
      setTimeout(() => {
        handleClose();
      }, 900);
    },
  });

  const isBusy = blockMutation.isPending || reportMutation.isPending;
  const error = blockMutation.error ?? reportMutation.error;

  const handleClose = () => {
    if (isBusy) {
      return;
    }
    setMode('menu');
    setReason('inappropriate');
    setDescription('');
    setStatusMessage(null);
    blockMutation.reset();
    reportMutation.reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable
          style={[styles.sheet, { maxHeight: Math.round(windowHeight * 0.9), paddingBottom: sheetBottomPadding }]}
          onPress={(event) => event.stopPropagation()}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.sheetScroll}
          >
          <Text variant="titleMedium" style={styles.title}>
            Safety
          </Text>
          <Text style={styles.subtitle}>
            Report or block {displayName}. Blocking hides their plans and chats from you.
          </Text>

          {statusMessage ? (
            <HelperText type="info" visible>
              {statusMessage}
            </HelperText>
          ) : null}

          {error ? (
            <HelperText type="error" visible>
              {getErrorMessage(error, 'Unable to complete that safety action.')}
            </HelperText>
          ) : null}

          {mode === 'menu' ? (
            <View style={styles.actions}>
              <Button
                mode="contained"
                buttonColor={appColors.primary}
                disabled={userId == null || isBusy}
                loading={reportMutation.isPending}
                onPress={() => setMode('report')}
              >
                Report
              </Button>
              <Button
                mode="outlined"
                disabled={userId == null || isBusy}
                loading={blockMutation.isPending}
                onPress={() => blockMutation.mutate()}
              >
                Block
              </Button>
              <Button mode="text" disabled={isBusy} onPress={handleClose}>
                Cancel
              </Button>
            </View>
          ) : (
            <View style={styles.actions}>
              <Text style={styles.sectionLabel}>Why are you reporting?</Text>
              <RadioButton.Group
                onValueChange={(value) => setReason(value as ReportReason)}
                value={reason}
              >
                {REPORT_REASON_OPTIONS.map((option) => (
                  <RadioButton.Item
                    key={option.value}
                    label={option.label}
                    value={option.value}
                    disabled={isBusy}
                  />
                ))}
              </RadioButton.Group>
              <TextInput
                mode="outlined"
                label="Optional details"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                disabled={isBusy}
                style={styles.detailsInput}
              />
              <Button
                mode="contained"
                buttonColor={appColors.primary}
                loading={reportMutation.isPending}
                disabled={isBusy}
                onPress={() => reportMutation.mutate()}
              >
                Submit report
              </Button>
              <Button mode="text" disabled={isBusy} onPress={() => setMode('menu')}>
                Back
              </Button>
            </View>
          )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 16, 24, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: appColors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sheetScroll: {
    gap: 12,
  },
  title: {
    color: appColors.ink,
    fontWeight: '800',
  },
  subtitle: {
    color: appColors.mutedInk,
    lineHeight: 20,
  },
  actions: {
    gap: 8,
  },
  sectionLabel: {
    color: appColors.ink,
    fontWeight: '700',
  },
  detailsInput: {
    backgroundColor: appColors.card,
  },
});
