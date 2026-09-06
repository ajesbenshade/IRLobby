import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import { View } from '@components/RNCompat';
import { AppButton } from '@components/ui/Button';
import { Chip } from '@components/ui/Chip';
import { paywall as paywallCopy } from '@constants/copy';
import {
  IAP_CATALOG,
  IAP_PRODUCT_IDS,
  PAYWALL_FRAMES,
  PLUS_VALUE_ROWS,
  type IapProductId,
  type PaywallFrame,
} from '@constants/iap';
import {
  IapNotConfiguredError,
  IapSandboxNotConfiguredError,
  purchasePackage,
  restorePurchases,
} from '@services/purchasesClient';
import { appColors, appTypography, radii, spacing } from '@theme/index';
import { getErrorMessage } from '@utils/error';

const billingUnavailableTitle = 'Purchases unavailable';

const explainBillingError = (error: unknown) => {
  if (error instanceof IapNotConfiguredError || error instanceof IapSandboxNotConfiguredError) {
    return error.message;
  }
  return getErrorMessage(
    error,
    'Apple IAP is stubbed. No live charges. Wire RevenueCat + sandbox later.',
  );
};

type PaywallContentProps = {
  frame: PaywallFrame;
  onDismiss: () => void;
};

export const PaywallContent = ({ frame, onDismiss }: PaywallContentProps) => {
  const [pendingProductId, setPendingProductId] = useState<IapProductId | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const copy = PAYWALL_FRAMES[frame];
  const products = useMemo(
    () => copy.products.map((productId) => IAP_CATALOG[productId]),
    [copy.products],
  );
  const isBusy = pendingProductId != null || isRestoring;

  const runPurchase = async (productId: IapProductId) => {
    setPendingProductId(productId);
    try {
      await purchasePackage(productId);
      Alert.alert('Purchase complete', 'Entitlement refresh will land when sandbox is wired.');
    } catch (error) {
      Alert.alert(billingUnavailableTitle, explainBillingError(error));
    } finally {
      setPendingProductId(null);
    }
  };

  const runRestore = async () => {
    setIsRestoring(true);
    try {
      await restorePurchases();
      Alert.alert('Restore complete', 'Existing Plus access will apply once RevenueCat is live.');
    } catch (error) {
      Alert.alert(billingUnavailableTitle, explainBillingError(error));
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.grabber} />

      {frame === 'plusValue' ? (
        <View style={styles.wordmark}>
          <Text style={styles.logo}>{paywallCopy.plusWordmark}</Text>
          <Text style={styles.fundLine}>{paywallCopy.fundTheServers}</Text>
        </View>
      ) : null}

      <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.subtitle}>{copy.subtitle}</Text>

      {frame === 'plusValue' ? (
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeaderRow]}>
            <Text style={[styles.tableCell, styles.tableFeature, styles.tableHeader]}> </Text>
            <Text style={[styles.tableCell, styles.tableHeader]}>Free</Text>
            <Text style={[styles.tableCell, styles.tableHeader, styles.tablePlusHeader]}>Plus</Text>
          </View>
          {PLUS_VALUE_ROWS.map((row) => (
            <View key={row.label} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.tableFeature]}>{row.label}</Text>
              <Text style={styles.tableCell}>{row.free}</Text>
              <Text style={[styles.tableCell, styles.tablePlusCell]}>{row.plus}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {frame === 'boostNudge' ? (
        <View style={styles.boostRow}>
          <Chip
            label={paywallCopy.boostChipLabel}
            selected
            tone="gold"
            onPress={() => {
              if (!isBusy) {
                void runPurchase(IAP_PRODUCT_IDS.boostPack);
              }
            }}
          />
        </View>
      ) : (
        <View style={frame === 'plusValue' ? styles.planRow : styles.productStack}>
          {products.map((product) => (
            <AppButton
              key={product.productId}
              loading={pendingProductId === product.productId}
              disabled={isBusy}
              style={frame === 'plusValue' ? styles.planButton : undefined}
              onPress={() => {
                void runPurchase(product.productId);
              }}
            >
              {`${product.periodLabel} · ${product.displayPrice}`}
            </AppButton>
          ))}
        </View>
      )}

      <Text style={styles.prototypeNote}>{paywallCopy.prototypeNote}</Text>

      <View style={styles.actions}>
        {frame !== 'boostNudge' ? (
          <AppButton variant="outline" loading={isRestoring} disabled={isBusy} onPress={() => void runRestore()}>
            Restore purchases
          </AppButton>
        ) : null}
        <AppButton variant="ghost" disabled={isBusy} onPress={onDismiss}>
          Not now
        </AppButton>
      </View>

      <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.closeHit}>
        <Text style={styles.closeLabel}>Close</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: appColors.lineStrong,
    marginBottom: 4,
  },
  wordmark: {
    gap: 4,
    marginBottom: 4,
  },
  logo: {
    fontFamily: appTypography.headingDisplay,
    color: appColors.ink,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  fundLine: {
    fontFamily: appTypography.bodyMedium,
    color: appColors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  eyebrow: {
    color: appColors.primaryGlow,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    color: appColors.ink,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: appColors.mutedInk,
    lineHeight: 20,
  },
  table: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
    borderRadius: radii.md,
    overflow: 'hidden',
    marginTop: 4,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: appColors.line,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  tableHeaderRow: {
    borderTopWidth: 0,
    backgroundColor: appColors.cardStrong,
  },
  tableCell: {
    flex: 1,
    color: appColors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
  },
  tableFeature: {
    flex: 1.2,
    color: appColors.ink,
    fontWeight: '600',
  },
  tableHeader: {
    fontWeight: '700',
    color: appColors.softInk,
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 0.4,
  },
  tablePlusHeader: {
    color: appColors.primaryGlow,
  },
  tablePlusCell: {
    color: appColors.ink,
    fontWeight: '600',
  },
  planRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  planButton: {
    flex: 1,
  },
  productStack: {
    gap: 8,
    marginTop: 4,
  },
  boostRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  prototypeNote: {
    color: appColors.softInk,
    fontSize: 12,
    lineHeight: 16,
  },
  actions: {
    gap: 8,
  },
  closeHit: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  closeLabel: {
    color: appColors.softInk,
    fontSize: 13,
    fontWeight: '600',
  },
});
