import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, StyleSheet, Text } from 'react-native';

import { FoyerSheet } from '@components/foyer/FoyerSheet';
import { InlineError, PillButton, SheetButtons } from '@components/foyer/ui';
import { View } from '@components/RNCompat';
import { COMMON_COPY, PHOTO_COPY } from '@constants/foyerCopy';
import { appColors, appTypography, radii } from '@theme/index';

type Props = {
  visible: boolean;
  subtitle: string;
  uris: string[];
  pending?: boolean;
  error?: string | null;
  onUpload: () => void;
  onCancel: () => void;
};

/** Shown after picking photos. The notice is always visible; there is no checkbox and no opt-out. */
export const PhotoUploadSheet = ({ visible, subtitle, uris, pending, error, onUpload, onCancel }: Props) => (
  <FoyerSheet
    visible={visible}
    onDismiss={onCancel}
    footer={
      <SheetButtons>
        <InlineError message={error} />
        <PillButton label={PHOTO_COPY.uploadCta} loading={pending} disabled={uris.length === 0} onPress={onUpload} />
        <PillButton label={COMMON_COPY.cancel} variant="outline" disabled={pending} onPress={onCancel} />
      </SheetButtons>
    }
  >
    <Text accessibilityRole="header" style={styles.title}>
      {PHOTO_COPY.uploadTitle}
    </Text>
    <Text style={styles.sub}>{subtitle}</Text>
    <View style={styles.thumbs}>
      {uris.slice(0, 8).map((uri) => (
        <Image key={uri} source={{ uri }} style={styles.thumb} />
      ))}
    </View>
    <Text style={styles.count}>{PHOTO_COPY.uploadCountLabel(uris.length)}</Text>
    <View style={styles.notice}>
      <MaterialCommunityIcons name="information-outline" size={20} color={appColors.primary} />
      <Text style={styles.noticeText}>{PHOTO_COPY.uploadNotice}</Text>
    </View>
  </FoyerSheet>
);

const styles = StyleSheet.create({
  title: { fontFamily: appTypography.heading, fontSize: 24, lineHeight: 32, color: appColors.ink },
  sub: { fontFamily: appTypography.bodyRegular, fontSize: 15, color: appColors.mutedInk },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: appColors.background },
  count: { fontFamily: appTypography.bodySemibold, fontSize: 14, color: appColors.ink },
  notice: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: appColors.primarySoft, borderRadius: radii.list, padding: 12 },
  noticeText: { flex: 1, fontFamily: appTypography.bodyRegular, fontSize: 14, lineHeight: 20, color: appColors.ink },
});
