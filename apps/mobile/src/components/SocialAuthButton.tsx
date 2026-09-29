import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { View } from '@components/RNCompat';
import { appColors, appTypography, radii } from '@theme/index';

// Sign in with Apple must use AppleSignInButton (the native system button).
export type SocialProvider = 'google' | 'x' | 'email';

type SocialAuthButtonProps = {
  provider: SocialProvider;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  keepLabelWhileLoading?: boolean;
  appearance?: 'default' | 'onLight';
  showTrailingIcon?: boolean;
  style?: StyleProp<ViewStyle>;
};

const GoogleMark = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" accessibilityElementsHidden>
    <Path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <Path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <Path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <Path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </Svg>
);

const XMark = ({ color }: { color: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" accessibilityElementsHidden>
    <Path
      fill={color}
      d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
    />
  </Svg>
);

export const SocialAuthButton = ({
  provider,
  label,
  onPress,
  disabled = false,
  loading = false,
  keepLabelWhileLoading = false,
  appearance = 'default',
  showTrailingIcon = true,
  style,
}: SocialAuthButtonProps) => {
  const isDisabled = disabled || loading;
  const tone =
    appearance === 'onLight' || provider === 'google'
      ? 'light'
      : provider === 'email'
        ? 'coral'
        : 'dark';
  const spinnerColor = tone === 'light' ? appColors.primary : appColors.white;
  const iconColor = tone === 'light' ? appColors.ink : appColors.white;
  const showLabel = !loading || keepLabelWhileLoading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        tone === 'dark' ? styles.dark : null,
        tone === 'light' ? styles.light : null,
        tone === 'coral' ? styles.coral : null,
        isDisabled && !loading ? styles.disabled : null,
        pressed && !isDisabled ? styles.pressed : null,
        style,
      ]}
    >
      <View style={styles.row}>
        {provider === 'google' ? <GoogleMark /> : null}
        {provider === 'x' ? <XMark color={iconColor} /> : null}
        {showLabel ? (
          <Text
            style={[
              styles.label,
              tone === 'light' ? styles.labelDark : styles.labelLight,
            ]}
          >
            {label}
          </Text>
        ) : null}
        {loading ? <ActivityIndicator color={spinnerColor} /> : null}
        {provider === 'email' && showTrailingIcon && !loading ? (
          <MaterialCommunityIcons name="arrow-right" size={18} color={appColors.white} />
        ) : null}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radii.pill,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dark: {
    backgroundColor: appColors.black,
  },
  light: {
    backgroundColor: appColors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.lineStrong,
  },
  coral: {
    backgroundColor: appColors.primary,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  label: {
    fontFamily: appTypography.bodySemibold,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  labelLight: {
    color: appColors.white,
  },
  labelDark: {
    color: appColors.ink,
  },
});
