import * as Google from 'expo-auth-session/providers/google';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AppButton } from '@components/ui/Button';
import {
  getGoogleAuthRequestConfig,
  isGoogleAuthReadyForPlatform,
} from '@lib/googleAuth';
import { appColors } from '@theme/index';

type GoogleSignInButtonProps = {
  disabled?: boolean;
  label: string;
  notConfiguredHint: string;
  onIdToken: (idToken: string) => Promise<unknown>;
};

const ConfiguredGoogleSignInButton = ({
  disabled = false,
  label,
  onIdToken,
}: Omit<GoogleSignInButtonProps, 'notConfiguredHint'>) => {
  const [request, , promptAsync] = Google.useIdTokenAuthRequest(
    getGoogleAuthRequestConfig(),
  );
  const [isPrompting, setIsPrompting] = useState(false);

  return (
    <AppButton
      variant="social"
      disabled={disabled || !request || isPrompting}
      loading={isPrompting}
      onPress={async () => {
        setIsPrompting(true);
        try {
          const authResult = await promptAsync();
          if (authResult.type !== 'success') {
            return;
          }
          const idToken = authResult.params?.id_token;
          if (typeof idToken !== 'string' || !idToken) {
            throw new Error('Google sign-in did not return an identity token.');
          }
          await onIdToken(idToken);
        } catch {
          // Parent mutations record the failure for on-screen copy.
        } finally {
          setIsPrompting(false);
        }
      }}
    >
      {label}
    </AppButton>
  );
};

export const GoogleSignInButton = ({
  notConfiguredHint,
  ...props
}: GoogleSignInButtonProps) => {
  if (!isGoogleAuthReadyForPlatform()) {
    return <Text style={styles.hintText}>{notConfiguredHint}</Text>;
  }

  return <ConfiguredGoogleSignInButton {...props} />;
};

const styles = StyleSheet.create({
  hintText: {
    color: appColors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
  },
});
