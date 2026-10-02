import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import { FoyerSheet } from '@components/foyer/FoyerSheet';
import { InlineError, PillButton, SheetButtons, type PillVariant } from '@components/foyer/ui';
import { appColors, appTypography } from '@theme/index';

type ConfirmSheetProps = {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  error?: string | null;
  /** `destructive` = filled #8a0a1f (cancel gathering). Default is the brand burgundy. */
  confirmVariant?: Extract<PillVariant, 'primary' | 'destructive'>;
  /** Extra content under the body (e.g. the reason field). */
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Title, body, a burgundy confirm pill and an outlined keep/cancel pill. */
export const ConfirmSheet = ({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  pending,
  error,
  confirmVariant = 'primary',
  children,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) => (
  <FoyerSheet
    visible={visible}
    onDismiss={onCancel}
    footer={
      <SheetButtons>
        <InlineError message={error} />
        <PillButton label={confirmLabel} variant={confirmVariant} loading={pending} onPress={onConfirm} testID="confirm-sheet-confirm" />
        <PillButton label={cancelLabel} variant="outline" disabled={pending} onPress={onCancel} testID="confirm-sheet-cancel" />
      </SheetButtons>
    }
  >
    <Text accessibilityRole="header" style={styles.title}>
      {title}
    </Text>
    <Text style={styles.body}>{body}</Text>
    {children}
  </FoyerSheet>
);

const styles = StyleSheet.create({
  title: { fontFamily: appTypography.heading, fontSize: 24, lineHeight: 32, color: appColors.ink },
  body: { fontFamily: appTypography.bodyRegular, fontSize: 15, lineHeight: 22, color: appColors.ink },
});
