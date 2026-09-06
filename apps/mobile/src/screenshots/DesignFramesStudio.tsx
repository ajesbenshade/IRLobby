import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { View } from '@components/RNCompat';
import type { MainStackParamList } from '@navigation/types';
import { CreateActivityScreen } from '@screens/main/CreateActivityScreen';
import { BuyTicketScreen } from '@screens/main/tickets/BuyTicketScreen';
import { DoorScanScreen } from '@screens/main/tickets/DoorScanScreen';
import { TicketWalletScreen } from '@screens/main/tickets/TicketWalletScreen';
import { AuthProvider } from '@providers/AuthProvider';
import { QueryProvider } from '@providers/queryClient';
import { appColors } from '@theme/index';

const Stack = createNativeStackNavigator<MainStackParamList>();

const BUY_PARAMS: MainStackParamList['BuyTicket'] = {
  activityId: 'preview-rooftop',
  title: 'Rooftop sunset hang',
  location: 'Mission Dolores',
  time: '2025-06-07T19:00:00',
  ticketPrice: 15,
  ticketsAvailable: 40,
};

const WALLET_PARAMS: MainStackParamList['TicketWallet'] = {
  activityId: 'preview-rooftop',
  title: 'Rooftop sunset hang',
  location: 'Mission Dolores',
  time: '2025-06-14T19:00:00',
  ticketId: 'IR-8F3A7C',
  quantity: 1,
  ticketPrice: 15,
};

const SCAN_PARAMS: MainStackParamList['DoorScan'] = {
  activityId: 'preview-rooftop',
  title: 'Rooftop sunset hang',
  admitted: 12,
  capacity: 40,
  guestName: 'Alex M.',
  quantity: 1,
};

type FrameKey = 'A' | 'B' | 'C' | 'D';

const FrameCreate = () => <CreateActivityScreen />;
const FrameBuy = () => <BuyTicketScreen />;
const FrameWallet = () => <TicketWalletScreen />;
const FrameScan = () => <DoorScanScreen />;

export const DesignFramesStudio = () => {
  const [frame, setFrame] = useState<FrameKey>('A');

  return (
    <QueryProvider>
      <AuthProvider>
      <View style={styles.root}>
        <NavigationContainer key={frame}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {frame === 'A' ? (
              <Stack.Screen name="Tabs" component={FrameCreate} />
            ) : null}
            {frame === 'B' ? (
              <Stack.Screen name="BuyTicket" component={FrameBuy} initialParams={BUY_PARAMS} />
            ) : null}
            {frame === 'C' ? (
              <Stack.Screen name="TicketWallet" component={FrameWallet} initialParams={WALLET_PARAMS} />
            ) : null}
            {frame === 'D' ? (
              <Stack.Screen name="DoorScan" component={FrameScan} initialParams={SCAN_PARAMS} />
            ) : null}
          </Stack.Navigator>
        </NavigationContainer>
        <View style={styles.switcher}>
          {(['A', 'B', 'C', 'D'] as const).map((key) => (
            <Pressable
              key={key}
              onPress={() => setFrame(key)}
              style={[styles.chip, frame === key ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, frame === key ? styles.chipTextActive : null]}>
                Frame {key}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      </AuthProvider>
    </QueryProvider>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: appColors.background,
  },
  switcher: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    gap: 8,
    padding: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(28,21,32,0.72)',
  },
  chip: {
    flex: 1,
    minHeight: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: appColors.primary,
  },
  chipText: {
    color: appColors.white,
    fontWeight: '700',
  },
  chipTextActive: {
    color: appColors.white,
  },
});
