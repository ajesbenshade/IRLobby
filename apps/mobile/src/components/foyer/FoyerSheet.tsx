import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';

import { View } from '@components/RNCompat';
import { SheetScaffold } from '@components/SheetScaffold';

type FoyerSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Fires once the sheet has finished closing (iOS Modal `onDismiss`); used to hand off to the next sheet in sequence. */
  onClosed?: () => void;
};

/** Bottom sheet over a dimmed scrim. Tapping outside dismisses; the body scrolls at large text sizes. */
export const FoyerSheet = ({ visible, onDismiss, children, footer, onClosed }: FoyerSheetProps) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss} onDismiss={onClosed}>
    <View style={styles.scrim}>
      <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={onDismiss} />
      <SheetScaffold footer={footer}>{children}</SheetScaffold>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(20, 14, 16, 0.42)', justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject },
});
