import * as Google from 'expo-auth-session/providers/google';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { SocialAuthButton } from '@components/SocialAuthButton';
import {
  completeGoogleAuthPrompt,
  getGoogleAuthRequestConfig,
  isGoogleAuthReadyForPlatform,
} from '@lib/googleAuth';
import { appColors } from '@theme/index';

type GoogleSignInButtonProps = {
  disabled?: boolean;
  label: string;
  notConfiguredHint: string;
  onIdToken: (idToken: string) => Promise<unknown>;
  onError?: (error: unknown) => void;
};

const ConfiguredGoogleSignInButton = ({
  disabled = false,
  label,
  onIdToken,
  onError,
}: Omit<GoogleSignInButtonProps, 'notConfiguredHint'>) => {
  const [request, , promptAsync] = Google.useIdTokenAuthRequest(
    getGoogleAuthRequestConfig(),
  );
  const [isPrompting, setIsPrompting] = useState(false);

  return (
    <SocialAuthButton
      provider="google"
      label={label}
      disabled={disabled || !request || isPrompting}
      loading={isPrompting}
      onPress={async () => {
        setIsPrompting(true);
        try {
          await completeGoogleAuthPrompt(promptAsync, onIdToken);
        } catch (error) {
          onError?.(error);
          if (!onError) {
            throw error;
          }
        } finally {
          setIsPrompting(false);
        }
      }}
    />
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
