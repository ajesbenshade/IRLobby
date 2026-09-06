import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { View } from '@components/RNCompat';
import { isPaywallFrame } from '@constants/iap';
import type { MainStackParamList } from '@navigation/types';
import { appColors, radii, spacing } from '@theme/index';

import { PaywallContent } from './PaywallContent';

export const PaywallScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, 'Paywall'>>();
  const frame = isPaywallFrame(route.params?.frame) ? route.params.frame : 'plusValue';

  const dismiss = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Tabs');
  };

  return (
    <View style={styles.screen}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss paywall"
        style={styles.backdrop}
        onPress={dismiss}
      />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <PaywallContent frame={frame} onDismiss={dismiss} />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: appColors.overlay,
  },
  sheet: {
    marginHorizontal: 12,
    marginBottom: spacing.md,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 8,
    borderRadius: radii.xl,
    backgroundColor: appColors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
  },
});
