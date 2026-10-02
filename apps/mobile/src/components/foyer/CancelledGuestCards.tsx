import { Image, Pressable, StyleSheet, Text } from 'react-native';

import { View } from '@components/RNCompat';
import { CANCEL_COPY, PHOTO_COPY } from '@constants/foyerCopy';
import { appColors, appTypography, radii } from '@theme/index';

const MAX_THUMBS = 4;

/** `Photos · 24` with a burgundy `See all` link and a row of thumbnails (gathering-cancelled-guest.png). */
export const CancelledPhotosCard = ({
  urls,
  count,
  onSeeAll,
}: {
  urls: string[];
  count: number;
  onSeeAll: () => void;
}) => (
  <View style={styles.card} testID="cancelled-photos-card">
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>
        {PHOTO_COPY.galleryTitle(count)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={CANCEL_COPY.seeAll}
        onPress={onSeeAll}
        style={styles.link}
        testID="cancelled-see-all"
      >
        <Text style={styles.linkText}>{CANCEL_COPY.seeAll}</Text>
      </Pressable>
    </View>
    {urls.length > 0 ? (
      <View style={styles.thumbs}>
        {urls.slice(0, MAX_THUMBS).map((url) => (
          <Image key={url} source={{ uri: url }} style={styles.thumb} />
        ))}
      </View>
    ) : null}
  </View>
);

/** `Chat` with a burgundy `Open chat` link and the cancellation system message in a grey box. */
export const CancelledChatCard = ({
  title,
  message,
  onOpen,
}: {
  title: string;
  message: string;
  onOpen: () => void;
}) => (
  <View style={styles.card} testID="cancelled-chat-card">
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={CANCEL_COPY.openChat}
        onPress={onOpen}
        style={styles.link}
        testID="cancelled-open-chat"
      >
        <Text style={styles.linkText}>{CANCEL_COPY.openChat}</Text>
      </Pressable>
    </View>
    <View style={styles.message}>
      <Text style={styles.messageText}>{message}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: { backgroundColor: appColors.white, borderRadius: radii.list, padding: 14, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  title: { fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.ink },
  link: { minHeight: 48, minWidth: 48, alignItems: 'flex-end', justifyContent: 'center' },
  linkText: { fontFamily: appTypography.bodySemibold, fontSize: 15, color: appColors.primary },
  thumbs: { flexDirection: 'row', gap: 8 },
  thumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: appColors.background },
  message: { backgroundColor: '#f1ecea', borderRadius: 12, padding: 12 },
  messageText: { fontFamily: appTypography.bodyRegular, fontSize: 14, lineHeight: 20, color: appColors.ink },
});
