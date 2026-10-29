import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { FoyerSheet } from '@components/foyer/FoyerSheet';
import { InlineError, PillButton } from '@components/foyer/ui';
import { View } from '@components/RNCompat';
import {
  DIRECTORY_COPY,
  birthdayLong,
  directoryDisplayName,
  isBirthdayToday,
  wishButtonLabel,
  wishFriendsLine,
  wishPresets,
  type DirectoryChild,
  type DirectoryMember,
} from '@shared/directory';
import { fetchMemberProfile } from '@services/foyerService';
import { sendChildBirthdayWish } from '@services/directoryService';
import { appColors, appTypography } from '@theme/index';

type Props = {
  child: DirectoryChild | null;
  parent: DirectoryMember | null;
  onClose: () => void;
  onOpenParent: (parent: DirectoryMember) => void;
};

/** Child detail. Not a member profile: no report, block, or message to the child. */
export const DirectoryChildSheet = ({ child, parent, onClose, onOpenParent }: Props) => {
  const [wishing, setWishing] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const parentQuery = useQuery({
    queryKey: ['foyer-member-profile', parent ? String(parent.id) : 'none'],
    queryFn: () => fetchMemberProfile(parent!.id),
    enabled: parent != null && child != null,
  });
  const friends = parentQuery.data?.friendship === 'friends';
  const parentHidden = parentQuery.isSuccess && parentQuery.data == null;
  const today = child ? isBirthdayToday(child.birthMonth, child.birthDay) : false;
  const long = child ? birthdayLong(child.birthMonth, child.birthDay) : '';

  const close = () => {
    setWishing(false);
    setError(null);
    setSent(false);
    setPending(null);
    onClose();
  };

  const send = async (message: string) => {
    if (!child || !parent) return;
    setPending(message);
    setError(null);
    try {
      await sendChildBirthdayWish({
        parentUserId: parent.id,
        childId: child.id,
        childFirstName: child.firstName,
        message,
      });
      setSent(true);
      setWishing(false);
    } catch {
      setError(DIRECTORY_COPY.wishFailed);
    } finally {
      setPending(null);
    }
  };

  return (
    <FoyerSheet visible={child != null && parent != null} onDismiss={close}>
      {child && parent ? (
        <View style={styles.body}>
          <Text accessibilityRole="header" style={styles.title}>
            {child.firstName}
          </Text>
          <View style={styles.birthdayRow}>
            <Text style={styles.birthday}>{DIRECTORY_COPY.birthday(long)}</Text>
            {today ? (
              <View style={styles.today}>
                <Text style={styles.todayText}>{DIRECTORY_COPY.today}</Text>
              </View>
            ) : null}
          </View>
          <Pressable accessibilityRole="button" onPress={() => onOpenParent(parent)}>
            <Text style={styles.parent}>{DIRECTORY_COPY.childOf(directoryDisplayName(parent))}</Text>
          </Pressable>
          {parentQuery.isLoading || parentHidden ? null : friends ? (
            wishing ? (
              <View style={styles.presets}>
                {wishPresets(child.firstName).map((preset) => (
                  <PillButton
                    key={preset}
                    label={preset}
                    variant="outline"
                    loading={pending === preset}
                    disabled={pending != null}
                    onPress={() => void send(preset)}
                  />
                ))}
              </View>
            ) : (
              <PillButton label={wishButtonLabel(child.firstName)} onPress={() => setWishing(true)} />
            )
          ) : (
            <View style={styles.prompt}>
              <Text style={styles.promptText}>{wishFriendsLine(parent.firstName)}</Text>
              <PillButton label={DIRECTORY_COPY.addFriend} variant="outline" onPress={() => onOpenParent(parent)} />
            </View>
          )}
          {sent ? <Text style={styles.sent}>{DIRECTORY_COPY.wishSent}</Text> : null}
          <InlineError message={error} />
        </View>
      ) : null}
    </FoyerSheet>
  );
};

const styles = StyleSheet.create({
  body: { gap: 14 },
  title: { fontFamily: appTypography.heading, fontSize: 28, lineHeight: 34, color: appColors.ink },
  birthdayRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  birthday: { fontFamily: appTypography.bodyRegular, fontSize: 16, color: appColors.ink },
  today: { backgroundColor: appColors.primarySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  todayText: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 12 },
  parent: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 16 },
  presets: { gap: 8 },
  prompt: { gap: 10 },
  promptText: { fontFamily: appTypography.bodyRegular, fontSize: 15, lineHeight: 21, color: appColors.ink },
  sent: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 15 },
});
