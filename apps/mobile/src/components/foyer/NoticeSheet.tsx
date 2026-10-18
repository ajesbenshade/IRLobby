import { StyleSheet, Text } from 'react-native';

import { FoyerSheet } from '@components/foyer/FoyerSheet';
import { PillButton, SheetButtons } from '@components/foyer/ui';
import { appColors, appTypography } from '@theme/index';

/** Title, body and one burgundy `OK` (weekly limit, photo limits, church not listed). */
export const NoticeSheet = ({
  visible,
  title,
  body,
  okLabel = 'OK',
  onClose,
  testID,
}: {
  visible: boolean;
  title: string;
  body: string;
  okLabel?: string;
  onClose: () => void;
  testID?: string;
}) => (
  <FoyerSheet
    visible={visible}
    onDismiss={onClose}
    footer={
      <SheetButtons>
        <PillButton label={okLabel} onPress={onClose} testID={testID ? `${testID}-ok` : undefined} />
      </SheetButtons>
    }
  >
    <Text accessibilityRole="header" style={styles.title} testID={testID ? `${testID}-title` : undefined}>
      {title}
    </Text>
    <Text style={styles.body} testID={testID ? `${testID}-body` : undefined}>
      {body}
    </Text>
  </FoyerSheet>
);

const styles = StyleSheet.create({
  title: { fontFamily: appTypography.heading, fontSize: 24, lineHeight: 32, color: appColors.ink },
  body: { fontFamily: appTypography.bodyRegular, fontSize: 15, lineHeight: 22, color: appColors.ink },
});
