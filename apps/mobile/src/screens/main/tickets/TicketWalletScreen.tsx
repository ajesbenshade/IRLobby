import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IrlobbyWordmark } from '@components/IrlobbyWordmark';
import { View } from '@components/RNCompat';
import { TicketQrMark } from '@components/TicketQrMark';
import { formatEventWhenLabel } from '@constants/tickets';
import type { MainStackParamList } from '@navigation/types';
import { appColors, appTypography, radii, spacing } from '@theme/index';

type WalletRoute = RouteProp<MainStackParamList, 'TicketWallet'>;
type WalletNavigation = NativeStackNavigationProp<MainStackParamList, 'TicketWallet'>;

export const TicketWalletScreen = () => {
  const navigation = useNavigation<WalletNavigation>();
  const { params } = useRoute<WalletRoute>();
  const [qrHint, setQrHint] = useState(false);

  const whenLabel = formatEventWhenLabel(params.time);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={appColors.primary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            Alert.alert('Ticket options', 'Prototype ticket — no charge and no live Wallet pass.')
          }
          style={styles.iconBtn}
        >
          <MaterialCommunityIcons name="dots-horizontal-circle-outline" size={26} color={appColors.primary} />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <View style={styles.checkHalo}>
          <MaterialCommunityIcons name="check-circle" size={56} color={appColors.primary} />
        </View>
        <MaterialCommunityIcons name="star-four-points" size={18} color={appColors.primary} style={styles.sparkLeft} />
        <MaterialCommunityIcons name="heart-outline" size={18} color={appColors.primary} style={styles.sparkRight} />
        <Text style={styles.headline}>You’re in!</Text>
        <Text style={styles.subhead}>See you on the rooftop ♡</Text>
      </View>

      <View style={[styles.stub, qrHint ? styles.stubHighlight : null]}>
        <View style={styles.stubLeft}>
          <IrlobbyWordmark size="sm" />
          <Text style={styles.stubTitle}>{params.title}</Text>
          <View style={styles.stubMeta}>
            <MaterialCommunityIcons name="calendar" size={14} color={appColors.primary} />
            <Text style={styles.stubMetaText}>{whenLabel}</Text>
          </View>
          <View style={styles.stubMeta}>
            <MaterialCommunityIcons name="map-marker" size={14} color={appColors.primary} />
            <Text style={styles.stubMetaText}>{params.location || 'Location TBD'}</Text>
          </View>
          <View style={styles.wave} />
        </View>
        <View style={styles.stubRight}>
          <TicketQrMark value={params.ticketId} size={108} />
          <View style={styles.ticketIdChip}>
            <Text style={styles.ticketIdText}>{params.ticketId}</Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            Alert.alert(
              'Add to Apple Wallet',
              'Wallet pass is stubbed in this prototype. No PassKit certificates and no charge.',
            )
          }
          style={styles.walletBtn}
        >
          <MaterialCommunityIcons name="wallet-outline" size={20} color={appColors.white} />
          <Text style={styles.walletLabel}>Add to Apple Wallet</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setQrHint(true)}
          style={styles.qrBtn}
        >
          <Text style={styles.qrLabel}>Show QR at the door</Text>
          <MaterialCommunityIcons name="motion" size={18} color={appColors.primary} />
        </Pressable>
        <Text style={styles.footer}>Ticket ID · Prototype, no charge</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFF7F4',
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  checkHalo: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkLeft: {
    position: 'absolute',
    left: 36,
    top: 18,
  },
  sparkRight: {
    position: 'absolute',
    right: 40,
    top: 28,
  },
  headline: {
    marginTop: 8,
    color: appColors.primary,
    fontFamily: appTypography.headingDisplay,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  subhead: {
    marginTop: 4,
    color: appColors.ink,
    fontSize: 16,
  },
  stub: {
    flexDirection: 'row',
    backgroundColor: appColors.white,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: appColors.black,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  stubHighlight: {
    borderWidth: 2,
    borderColor: appColors.primary,
  },
  stubLeft: {
    flex: 1,
    padding: spacing.md,
    gap: 8,
  },
  stubTitle: {
    color: appColors.ink,
    fontFamily: appTypography.heading,
    fontSize: 18,
    fontWeight: '800',
  },
  stubMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stubMetaText: {
    color: appColors.ink,
    fontSize: 13,
    flex: 1,
  },
  wave: {
    marginTop: 8,
    height: 3,
    borderRadius: 99,
    backgroundColor: appColors.primary,
    opacity: 0.55,
  },
  stubRight: {
    width: 132,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderLeftWidth: 1,
    borderLeftColor: appColors.line,
    borderStyle: 'dashed',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  ticketIdChip: {
    borderWidth: 1,
    borderColor: appColors.primary,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ticketIdText: {
    color: appColors.ink,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  actions: {
    marginTop: 'auto',
    gap: 12,
    paddingBottom: spacing.lg,
  },
  walletBtn: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: appColors.black,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  walletLabel: {
    color: appColors.white,
    fontFamily: appTypography.bodySemibold,
    fontSize: 16,
    fontWeight: '700',
  },
  qrBtn: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: appColors.primary,
    backgroundColor: appColors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  qrLabel: {
    color: appColors.primary,
    fontFamily: appTypography.bodySemibold,
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    textAlign: 'center',
    color: appColors.softInk,
    fontSize: 12,
  },
});
