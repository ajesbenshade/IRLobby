import { StyleSheet } from 'react-native';

import { AccentPill, AuthShell } from '@components/AppChrome';
import { View } from '@components/RNCompat';
import { AppButton } from '@components/ui/Button';
import { account as accountCopy } from '@constants/copy';
import { useAuth } from '@hooks/useAuth';

export const AccountDeletedScreen = () => {
  const { acknowledgeAccountDeleted } = useAuth();

  return (
    <AuthShell
      eyebrow="IRLobby"
      title={accountCopy.deletedTitle}
      subtitle={accountCopy.deletedBody}
    >
      <View style={styles.content}>
        <AccentPill tone="neutral">Signed out</AccentPill>
        <AppButton onPress={acknowledgeAccountDeleted}>{accountCopy.backToWelcome}</AppButton>
      </View>
    </AuthShell>
  );
};

const styles = StyleSheet.create({
  content: {
    gap: 16,
  },
});
