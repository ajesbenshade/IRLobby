import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState, type ComponentType } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IrlobbyWordmark } from '@components/IrlobbyWordmark';
import { View } from '@components/RNCompat';
import { makeTicketId } from '@constants/tickets';
import type { MainStackParamList } from '@navigation/types';
import { appColors, appTypography, radii, spacing } from '@theme/index';

type DoorScanRoute = RouteProp<MainStackParamList, 'DoorScan'>;
type DoorScanNavigation = NativeStackNavigationProp<MainStackParamList, 'DoorScan'>;

type CameraModule = {
  CameraView: ComponentType<{
    style?: object;
    facing?: 'front' | 'back';
    enableTorch?: boolean;
    barcodeScannerSettings?: { barcodeTypes: string[] };
    onBarcodeScanned?: (event: { data?: string }) => void;
  }>;
  useCameraPermissions: () => [
    { granted?: boolean } | null,
    () => Promise<{ granted?: boolean }>,
  ];
};

const loadCameraModule = (): CameraModule | null => {
  try {
    return require('expo-camera') as CameraModule;
  } catch {
    return null;
  }
};

const cameraModule = loadCameraModule();

export const DoorScanScreen = () => {
  const navigation = useNavigation<DoorScanNavigation>();
  const { params } = useRoute<DoorScanRoute>();
  const [torchOn, setTorchOn] = useState(false);
  const [permission, requestPermission] = cameraModule?.useCameraPermissions() ?? [null, async () => ({ granted: false })];
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [admitted, setAdmitted] = useState(params.admitted ?? 12);

  const capacity = params.capacity ?? 40;
  const guestName = params.guestName ?? 'Alex M.';
  const scannedLabel = lastScan ?? makeTicketId(String(params.activityId ?? 'demo'));

  const handleScan = useCallback(
    (data?: string) => {
      if (!data || data === lastScan) {
        return;
      }
      setLastScan(data);
      setAdmitted((current) => Math.min(capacity, current + 1));
    },
    [capacity, lastScan],
  );

  const cameraReady = Boolean(cameraModule?.CameraView && permission?.granted);
  const CameraView = cameraModule?.CameraView;
  const nowLabel = useMemo(
    () =>
      new Date().toLocaleString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    [],
  );

  return (
    <View style={styles.root}>
      {cameraReady && CameraView ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torchOn}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => handleScan(data)}
        />
      ) : (
        <View style={styles.cameraStub}>
          <View style={styles.stubPhone} />
        </View>
      )}

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <IrlobbyWordmark color={appColors.primary} size="sm" />
          <View style={styles.titleChip}>
            <Text style={styles.titleChipText}>Door scan</Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color={appColors.white} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle flash"
            onPress={() => setTorchOn((value) => !value)}
            style={styles.flashBtn}
          >
            <MaterialCommunityIcons
              name={torchOn ? 'flash' : 'flash-outline'}
              size={20}
              color={appColors.white}
            />
          </Pressable>
        </View>

        <View style={styles.viewfinder}>
          <View style={[styles.bracket, styles.bracketTL]} />
          <View style={[styles.bracket, styles.bracketTR]} />
          <View style={[styles.bracket, styles.bracketBL]} />
          <View style={[styles.bracket, styles.bracketBR]} />
        </View>
        <Text style={styles.scanHint}>Scan guest ticket</Text>

        {!permission?.granted && cameraModule ? (
          <Pressable style={styles.permissionBtn} onPress={() => void requestPermission()}>
            <Text style={styles.permissionLabel}>Enable camera</Text>
          </Pressable>
        ) : null}

        {!cameraModule ? (
          <Pressable style={styles.permissionBtn} onPress={() => handleScan(scannedLabel)}>
            <Text style={styles.permissionLabel}>Simulate scan (prototype)</Text>
          </Pressable>
        ) : null}

        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.validRow}>
            <View style={styles.validBadge}>
              <MaterialCommunityIcons name="check" size={18} color={appColors.black} />
            </View>
            <View style={styles.validCopy}>
              <Text style={styles.validTitle}>
                {guestName} · Ticket valid · 1 of {params.quantity ?? 1}
              </Text>
              <Text style={styles.validTime}>{nowLabel}</Text>
            </View>
          </View>

          <View style={styles.capacityRow}>
            <MaterialCommunityIcons name="account-group" size={22} color={appColors.primary} />
            <View>
              <Text style={styles.admittedLabel}>Admitted</Text>
              <Text style={styles.admittedCount}>
                <Text style={styles.admittedCurrent}>{admitted}</Text>
                <Text style={styles.admittedCap}> / {capacity}</Text>
              </Text>
            </View>
          </View>

          <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.doneBtn}>
            <Text style={styles.doneLabel}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: appColors.darkBackground,
  },
  cameraStub: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#2B2420',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stubPhone: {
    width: 160,
    height: 220,
    borderRadius: 24,
    backgroundColor: '#111',
    borderWidth: 8,
    borderColor: '#3A322E',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  titleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  titleChipText: {
    color: appColors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  flashBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  viewfinder: {
    alignSelf: 'center',
    width: 220,
    height: 220,
    position: 'relative',
  },
  bracket: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: appColors.primary,
  },
  bracketTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  bracketTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  bracketBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  bracketBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  scanHint: {
    textAlign: 'center',
    color: appColors.white,
    fontSize: 16,
    fontWeight: '600',
    marginTop: -24,
  },
  permissionBtn: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  permissionLabel: {
    color: appColors.white,
    fontWeight: '700',
  },
  sheet: {
    backgroundColor: '#2A2422',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.24)',
    marginBottom: 4,
  },
  validRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  validBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: appColors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validCopy: {
    flex: 1,
    gap: 2,
  },
  validTitle: {
    color: appColors.success,
    fontWeight: '700',
    fontSize: 15,
  },
  validTime: {
    color: appColors.darkMutedInk,
    fontSize: 13,
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  admittedLabel: {
    color: appColors.white,
    fontSize: 14,
  },
  admittedCount: {
    fontFamily: appTypography.heading,
  },
  admittedCurrent: {
    color: appColors.primary,
    fontSize: 28,
    fontWeight: '800',
  },
  admittedCap: {
    color: appColors.white,
    fontSize: 28,
    fontWeight: '600',
  },
  doneBtn: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: appColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneLabel: {
    color: appColors.white,
    fontFamily: appTypography.heading,
    fontSize: 18,
    fontWeight: '800',
  },
});
