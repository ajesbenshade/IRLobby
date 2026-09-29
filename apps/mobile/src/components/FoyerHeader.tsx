import { useNavigation } from '@react-navigation/native';
import { Image, Pressable, StyleSheet, Text } from 'react-native';

import { View } from '@components/RNCompat';
import { useAuth } from '@hooks/useAuth';
import { appColors, appTypography, brand, fontSize } from '@theme/index';

type FoyerHeaderProps = {
  tone?: 'default' | 'onPrimary';
};

export const FoyerHeader = ({ tone = 'default' }: FoyerHeaderProps) => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const onPrimary = tone === 'onPrimary';
  const initial = (user?.firstName || user?.email || 'F').charAt(0).toUpperCase();

  const openProfile = () => {
    const nav = navigation as {
      getState?: () => { routeNames?: string[] };
      navigate: (name: string, params?: object) => void;
    };
    const routeNames = nav.getState?.().routeNames ?? [];
    if (routeNames.includes('Profile')) {
      nav.navigate('Profile');
      return;
    }
    nav.navigate('Tabs', { screen: 'Profile' });
  };

  return (
    <View style={styles.row}>
      <View style={styles.wordBlock}>
        <Text style={[styles.wordmark, onPrimary ? styles.onPrimary : null]}>{brand.name}</Text>
        <Text style={[styles.church, onPrimary ? styles.churchOnPrimary : null]}>{brand.church}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Profile"
        onPress={openProfile}
        style={[styles.avatar, onPrimary ? styles.avatarOnPrimary : null]}
      >
        {user?.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
        ) : (
          <Text style={[styles.initial, onPrimary ? styles.initialOnPrimary : null]}>{initial}</Text>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  wordBlock: {
    flex: 1,
    gap: 2,
  },
  wordmark: {
    fontFamily: appTypography.heading,
    fontSize: fontSize.wordmark,
    lineHeight: 32,
    color: appColors.ink,
    fontWeight: '700',
  },
  onPrimary: {
    color: appColors.white,
  },
  church: {
    fontFamily: appTypography.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    color: appColors.mutedInk,
  },
  churchOnPrimary: {
    color: 'rgba(255,255,255,0.82)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.primarySoft,
    overflow: 'hidden',
  },
  avatarOnPrimary: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  avatarImage: {
    width: 40,
    height: 40,
  },
  initial: {
    fontFamily: appTypography.bodySemibold,
    fontSize: 16,
    color: appColors.primary,
    fontWeight: '700',
  },
  initialOnPrimary: {
    color: appColors.white,
  },
});
