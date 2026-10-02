import { Text } from 'react-native';
import { StyleSheet } from 'react-native';

import { FoyerSheet } from '@components/foyer/FoyerSheet';
import { InlineError, PillButton, SheetButtons } from '@components/foyer/ui';
import { appColors, appTypography } from '@theme/index';

type ConfirmSheetProps = {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  error?: string | null;
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
  onConfirm,
  onCancel,
}: ConfirmSheetProps) => (
  <FoyerSheet
    visible={visible}
    onDismiss={onCancel}
    footer={
      <SheetButtons>
        <InlineError message={error} />
        <PillButton label={confirmLabel} loading={pending} onPress={onConfirm} />
        <PillButton label={cancelLabel} variant="outline" disabled={pending} onPress={onCancel} />
      </SheetButtons>
    }
  >
    <Text accessibilityRole="header" style={styles.title}>
      {title}
    </Text>
    <Text style={styles.body}>{body}</Text>
  </FoyerSheet>
);

const styles = StyleSheet.create({
  title: { fontFamily: appTypography.heading, fontSize: 24, lineHeight: 32, color: appColors.ink },
  body: { fontFamily: appTypography.bodyRegular, fontSize: 15, lineHeight: 22, color: appColors.ink },
});
