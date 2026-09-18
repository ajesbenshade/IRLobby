import * as Google from 'expo-auth-session/providers/google';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { SocialAuthButton } from '@components/SocialAuthButton';
import {
  completeGoogleAuthPrompt,
  getGoogleAuthRequestConfig,
  getGoogleNativeRedirectUriOptions,
  isGoogleAuthReadyForPlatform,
} from '@lib/googleAuth';
import { appColors } from '@theme/index';

type GoogleSignInButtonProps = {
  disabled?: boolean;
  label: string;
  notConfiguredHint: string;
  onIdToken: (idToken: string) => Promise<unknown>;
  onError?: (error: unknown) => void;
  /** Increment to re-run the Google prompt (login toast “Try again”). */
  retryNonce?: number;
};

const ConfiguredGoogleSignInButton = ({
  disabled = false,
  label,
  onIdToken,
  onError,
  retryNonce = 0,
}: Omit<GoogleSignInButtonProps, 'notConfiguredHint'>) => {
  const requestConfig = useMemo(() => getGoogleAuthRequestConfig(), []);
  const redirectUriOptions = useMemo(
    () => getGoogleNativeRedirectUriOptions(),
    [],
  );
  const [request, , promptAsync] = Google.useIdTokenAuthRequest(
    requestConfig,
    redirectUriOptions,
  );
  const [isPrompting, setIsPrompting] = useState(false);
  const inFlight = useRef(false);
  const lastRetryNonce = useRef(0);

  const startSignIn = useCallback(async () => {
    if (disabled || !request || inFlight.current) {
      return;
    }

    inFlight.current = true;
    setIsPrompting(true);
    try {
      await completeGoogleAuthPrompt(promptAsync, onIdToken, { request });
    } catch (error) {
      onError?.(error);
      throw error;
    } finally {
      inFlight.current = false;
      setIsPrompting(false);
    }
  }, [disabled, onError, onIdToken, promptAsync, request]);

  useEffect(() => {
    if (!retryNonce || retryNonce === lastRetryNonce.current) {
      return;
    }
    lastRetryNonce.current = retryNonce;
    void startSignIn().catch(() => undefined);
  }, [retryNonce, startSignIn]);

  return (
    <SocialAuthButton
      provider="google"
      label={label}
      disabled={disabled || !request || isPrompting}
      loading={isPrompting}
      onPress={() => {
        void startSignIn().catch(() => undefined);
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
