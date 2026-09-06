import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { View } from '@components/RNCompat';
import {
  formatEventTimeLabel,
  formatUsd,
  makeTicketId,
  orderSubtotal,
  orderTotal,
  parseTicketPrice,
  PLATFORM_FEE_PERCENT,
  platformFeeAmount,
  PROTOTYPE_FOOTER_BUYER,
} from '@constants/tickets';
import type { MainStackParamList } from '@navigation/types';
import { openTicketCheckout } from '@services/paymentService';
import { appColors, appTypography, radii, spacing } from '@theme/index';
import { getErrorMessage } from '@utils/error';

type BuyTicketRoute = RouteProp<MainStackParamList, 'BuyTicket'>;
type BuyTicketNavigation = NativeStackNavigationProp<MainStackParamList, 'BuyTicket'>;

export const BuyTicketScreen = () => {
  const navigation = useNavigation<BuyTicketNavigation>();
  const { params } = useRoute<BuyTicketRoute>();
  const [quantity, setQuantity] = useState(1);
  const [prototypeNote, setPrototypeNote] = useState<string | null>(null);

  const price = parseTicketPrice(params.ticketPrice);
  const weekday = params.time
    ? new Date(params.time).toLocaleDateString(undefined, { weekday: 'short' })
    : 'Sat';
  const timeLabel = formatEventTimeLabel(params.time);
  const ticketLine = orderSubtotal(price, quantity);
  const feeLine = platformFeeAmount(price, quantity);
  const totalLine = orderTotal(price, quantity);

  const checkoutMutation = useMutation({
    mutationFn: () => openTicketCheckout(params.activityId),
  });

  const soldOut = Boolean(params.isSoldOut);
  const busy = checkoutMutation.isPending;

  const goToWallet = (method: 'card' | 'apple') => {
    navigation.replace('TicketWallet', {
      activityId: params.activityId,
      title: params.title,
      location: params.location,
      time: params.time,
      ticketId: makeTicketId(`${params.activityId}-${quantity}-${method}`),
      quantity,
      ticketPrice: price,
      imageUri: params.imageUri,
    });
  };

  const handlePay = async (method: 'card' | 'apple') => {
    if (soldOut || busy) {
      return;
    }

    try {
      await checkoutMutation.mutateAsync();
      goToWallet(method);
    } catch (error) {
      setPrototypeNote(
        getErrorMessage(error, 'Checkout is a prototype — no charge. Showing your ticket.'),
      );
      goToWallet(method);
    }
  };

  const quantityLabel = useMemo(() => String(quantity), [quantity]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={appColors.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Buy ticket</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.sheet}>
        <View style={styles.eventCard}>
          {params.imageUri ? (
            <Image source={{ uri: params.imageUri }} style={styles.cover} />
          ) : (
            <View style={styles.coverFallback}>
              <MaterialCommunityIcons name="white-balance-sunny" size={36} color={appColors.white} />
            </View>
          )}
          <Text style={styles.eventTitle}>{params.title}</Text>
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="map-marker" size={16} color={appColors.primary} />
            <Text style={styles.metaText}>{params.location || 'Location TBD'}</Text>
          </View>
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="calendar" size={16} color={appColors.primary} />
            <Text style={styles.metaText}>
              {weekday} · {timeLabel}
            </Text>
          </View>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.rowLabel}>Price</Text>
          <Text style={styles.priceValue}>{formatUsd(price || 0)}</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.rowLabel}>Quantity</Text>
          <View style={styles.stepper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decrease quantity"
              onPress={() => setQuantity((current) => Math.max(1, current - 1))}
              style={styles.stepperBtn}
            >
              <Text style={styles.stepperGlyph}>−</Text>
            </Pressable>
            <Text style={styles.stepperValue}>{quantityLabel}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Increase quantity"
              onPress={() => setQuantity((current) => Math.min(params.ticketsAvailable ?? 8, current + 1))}
              style={styles.stepperBtn}
            >
              <Text style={styles.stepperGlyph}>+</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.summaryTitle}>Order summary</Text>
        <View style={styles.priceRow}>
          <Text style={styles.rowLabel}>Ticket</Text>
          <Text style={styles.rowValue}>{formatUsd(ticketLine)}</Text>
        </View>
        <View style={styles.priceRow}>
          <View style={styles.feeLabelRow}>
            <Text style={styles.rowLabel}>Platform fee ({PLATFORM_FEE_PERCENT}%)</Text>
            <MaterialCommunityIcons name="information-outline" size={14} color={appColors.softInk} />
          </View>
          <Text style={styles.rowValue}>{formatUsd(feeLine)}</Text>
        </View>
        <Text style={styles.feeHint}>Includes Stripe payment processing</Text>
        <View style={styles.divider} />
        <View style={styles.priceRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatUsd(totalLine)}</Text>
        </View>

        <View style={styles.secureRow}>
          <MaterialCommunityIcons name="shield-check-outline" size={16} color={appColors.softInk} />
          <Text style={styles.secureText}>Secure checkout powered by Stripe</Text>
        </View>

        {prototypeNote ? <Text style={styles.prototypeNote}>{prototypeNote}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={soldOut || busy}
          onPress={() => void handlePay('card')}
          style={[styles.payCard, (soldOut || busy) && styles.disabled]}
        >
          <MaterialCommunityIcons name="credit-card-outline" size={20} color={appColors.white} />
          <Text style={styles.payCardLabel}>{soldOut ? 'Sold out' : 'Pay with card'}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={soldOut || busy}
          onPress={() => void handlePay('apple')}
          style={[styles.applePay, (soldOut || busy) && styles.disabled]}
        >
          <View style={styles.applePayInner}>
            <MaterialCommunityIcons name="apple" size={22} color={appColors.black} />
            <Text style={styles.applePayLabel}>Pay</Text>
          </View>
        </Pressable>

        <Text style={styles.footer}>{PROTOTYPE_FOOTER_BUYER}</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: appColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: appColors.ink,
    fontFamily: appTypography.heading,
    fontSize: 18,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 40,
  },
  sheet: {
    flex: 1,
    backgroundColor: appColors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: 12,
  },
  eventCard: {
    gap: 8,
  },
  cover: {
    width: '100%',
    height: 148,
    borderRadius: radii.lg,
    backgroundColor: appColors.cardStrong,
  },
  coverFallback: {
    width: '100%',
    height: 148,
    borderRadius: radii.lg,
    backgroundColor: appColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTitle: {
    color: appColors.ink,
    fontFamily: appTypography.heading,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    color: appColors.ink,
    fontSize: 15,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLabel: {
    color: appColors.ink,
    fontSize: 15,
  },
  rowValue: {
    color: appColors.ink,
    fontSize: 15,
  },
  priceValue: {
    color: appColors.primary,
    fontFamily: appTypography.heading,
    fontSize: 18,
    fontWeight: '700',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: appColors.primary,
    borderRadius: 14,
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperGlyph: {
    color: appColors.primary,
    fontSize: 22,
    fontWeight: '600',
  },
  stepperValue: {
    minWidth: 24,
    textAlign: 'center',
    color: appColors.ink,
    fontWeight: '700',
  },
  summaryTitle: {
    marginTop: 8,
    color: appColors.ink,
    fontFamily: appTypography.heading,
    fontSize: 18,
    fontWeight: '700',
  },
  feeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  feeHint: {
    color: appColors.softInk,
    fontSize: 12,
    marginTop: -6,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: appColors.line,
  },
  totalLabel: {
    color: appColors.ink,
    fontFamily: appTypography.heading,
    fontSize: 18,
    fontWeight: '800',
  },
  totalValue: {
    color: appColors.primary,
    fontFamily: appTypography.heading,
    fontSize: 24,
    fontWeight: '800',
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  secureText: {
    color: appColors.softInk,
    fontSize: 13,
  },
  prototypeNote: {
    color: appColors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
  },
  payCard: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: appColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  payCardLabel: {
    color: appColors.white,
    fontFamily: appTypography.bodySemibold,
    fontSize: 17,
    fontWeight: '700',
  },
  applePay: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: appColors.black,
    backgroundColor: appColors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applePayInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  applePayLabel: {
    color: appColors.black,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  footer: {
    textAlign: 'center',
    color: appColors.softInk,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  disabled: {
    opacity: 0.45,
  },
});
