import * as AppleAuthentication from 'expo-apple-authentication';
import { ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { View } from '@components/RNCompat';
import { appColors } from '@theme/index';

type AppleSignInButtonProps = {
  onPress: () => void;
  mode?: 'signIn' | 'continue' | 'signUp';
  disabled?: boolean;
  loading?: boolean;
  height?: number;
  cornerRadius?: number;
  style?: StyleProp<ViewStyle>;
};

const BUTTON_TYPE = {
  signIn: AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN,
  continue: AppleAuthentication.AppleAuthenticationButtonType.CONTINUE,
  signUp: AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP,
} as const;

// Uses Apple's native ASAuthorizationAppleIDButton so the logo, label, and
// proportions come from the system, as required by App Review guideline 4.
export const AppleSignInButton = ({
  onPress,
  mode = 'continue',
  disabled = false,
  loading = false,
  height = 52,
  cornerRadius = height / 2,
  style,
}: AppleSignInButtonProps) => {
  const isDisabled = disabled || loading;

  return (
    <View
      testID="apple-sign-in-button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      pointerEvents={isDisabled ? 'none' : 'auto'}
      style={[styles.wrap, { height }, isDisabled && !loading ? styles.disabled : null, style]}
    >
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={BUTTON_TYPE[mode]}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={cornerRadius}
        onPress={onPress}
        style={styles.button}
      />
      {loading ? (
        <View style={[styles.overlay, { borderRadius: cornerRadius }]}>
          <ActivityIndicator color={appColors.white} />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  button: {
    width: '100%',
    height: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.black,
  },
});
