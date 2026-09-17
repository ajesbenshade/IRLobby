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

export type SocialProvider = 'apple' | 'google' | 'x' | 'email';

type SocialAuthButtonProps = {
  provider: SocialProvider;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  keepLabelWhileLoading?: boolean;
  appearance?: 'default' | 'onLight';
  style?: StyleProp<ViewStyle>;
};

const GoogleMark = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" accessibilityElementsHidden>
    <Path
      fill="#EA4335"
      d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.3 14.7 2.4 12 2.4 6.9 2.4 2.8 6.5 2.8 11.6S6.9 20.8 12 20.8c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"
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
        {provider === 'apple' ? (
          <MaterialCommunityIcons name="apple" size={20} color={iconColor} />
        ) : null}
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
        {provider === 'email' && !loading ? (
          <MaterialCommunityIcons name="arrow-right" size={18} color={appColors.white} />
        ) : null}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
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
