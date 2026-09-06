import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import {
  AccentPill,
  AppScrollView,
  DetailRow,
  PageHeader,
  PanelCard,
  SectionIntro,
} from '@components/AppChrome';
import { View } from '@components/RNCompat';
import { AppButton } from '@components/ui/Button';
import {
  IAP_CATALOG,
  PAYWALL_FRAMES,
  PLUS_VALUE_ROWS,
  isPaywallFrame,
  type IapProductId,
} from '@constants/iap';
import type { MainStackParamList } from '@navigation/types';
import {
  IapNotConfiguredError,
  IapSandboxNotConfiguredError,
  purchasePackage,
  restorePurchases,
} from '@services/purchasesClient';
import { appColors, radii, spacing } from '@theme/index';
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

export const PaywallScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, 'Paywall'>>();
  const [pendingProductId, setPendingProductId] = useState<IapProductId | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const frame = isPaywallFrame(route.params?.frame) ? route.params.frame : 'plusValue';
  const copy = PAYWALL_FRAMES[frame];
  const products = useMemo(
    () => copy.products.map((productId) => IAP_CATALOG[productId]),
    [copy.products],
  );

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
    <AppScrollView contentContainerStyle={styles.container}>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle} />

      <PanelCard tone="accent">
        <AccentPill tone="secondary">Prototype</AccentPill>
        <Text style={styles.bannerText}>
          vNext Apple IAP stub. Buttons call RevenueCat only when a sandbox key exists. No live
          charges. Real-world tickets still use Stripe Connect.
        </Text>
      </PanelCard>

      {frame === 'plusValue' ? (
        <PanelCard>
          <SectionIntro
            eyebrow="Compare"
            title="What Plus changes"
            subtitle="Ticket checkout stays on Stripe either way."
          />
          {PLUS_VALUE_ROWS.map((row) => (
            <DetailRow
              key={row.label}
              title={row.label}
              subtitle={`Free: ${row.free} · Plus: ${row.plus}`}
            />
          ))}
        </PanelCard>
      ) : null}

      <PanelCard>
        <SectionIntro
          eyebrow="Products"
          title={frame === 'boostNudge' ? 'Boost pack' : 'Plus plans'}
          subtitle="Locked SKUs for Design and Backend. Prices are prototype copy."
        />
        <View style={styles.productStack}>
          {products.map((product) => (
            <View key={product.productId} style={styles.productCard}>
              <Text style={styles.productPeriod}>{product.periodLabel}</Text>
              <Text style={styles.productTitle}>{product.title}</Text>
              <Text style={styles.productPrice}>{product.displayPrice}</Text>
              <Text style={styles.productSubtitle}>{product.subtitle}</Text>
              <Text style={styles.skuLabel}>{product.productId}</Text>
              <AppButton
                loading={pendingProductId === product.productId}
                disabled={pendingProductId != null || isRestoring}
                onPress={() => {
                  void runPurchase(product.productId);
                }}
              >
                {product.productId === 'boost_pack'
                  ? `Get boost · ${product.displayPrice}`
                  : `Start Plus · ${product.displayPrice}`}
              </AppButton>
            </View>
          ))}
        </View>
      </PanelCard>

      <View style={styles.actions}>
        {frame !== 'boostNudge' ? (
          <AppButton
            variant="outline"
            loading={isRestoring}
            disabled={pendingProductId != null}
            onPress={() => {
              void runRestore();
            }}
          >
            Restore purchases
          </AppButton>
        ) : null}
        <AppButton
          variant="ghost"
          disabled={pendingProductId != null || isRestoring}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            }
          }}
        >
          Not now
        </AppButton>
      </View>
    </AppScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  bannerText: {
    color: appColors.ink,
    lineHeight: 20,
    marginTop: 8,
  },
  productStack: {
    gap: 12,
  },
  productCard: {
    gap: 6,
    padding: 16,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
    backgroundColor: appColors.cardStrong,
  },
  productPeriod: {
    color: appColors.primaryGlow,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  productTitle: {
    color: appColors.ink,
    fontSize: 18,
    fontWeight: '600',
  },
  productPrice: {
    color: appColors.ink,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  productSubtitle: {
    color: appColors.mutedInk,
    lineHeight: 20,
  },
  skuLabel: {
    color: appColors.softInk,
    fontSize: 12,
    marginBottom: 8,
  },
  actions: {
    gap: 8,
    marginBottom: 16,
  },
});
