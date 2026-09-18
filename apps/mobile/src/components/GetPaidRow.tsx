import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text } from 'react-native';

import { View } from '@components/RNCompat';
import { GET_PAID_COPY, STRIPE_CONNECT_CHIP } from '@constants/tickets';
import { useAuth } from '@hooks/useAuth';
import type { MainStackParamList } from '@navigation/types';
import { fetchStripeConnectStatus, stripeConnectChipLabel } from '@services/paymentService';
import { appColors } from '@theme/index';

type ProfileMenuIcon = keyof typeof MaterialCommunityIcons.glyphMap;

export const ProfileMenuRow = ({
  icon,
  title,
  subtitle,
  chip,
  highlight = false,
  danger = false,
  onPress,
}: {
  icon: ProfileMenuIcon;
  title: string;
  subtitle?: string;
  chip?: string;
  highlight?: boolean;
  danger?: boolean;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={title}
    onPress={onPress}
    style={[styles.menuRow, highlight ? styles.menuRowHighlight : null]}
  >
    <View style={[styles.menuIconWrap, highlight ? styles.menuIconWrapHighlight : null]}>
      <MaterialCommunityIcons
        name={icon}
        size={20}
        color={danger || highlight ? appColors.primary : appColors.ink}
      />
    </View>
    <View style={styles.menuCopy}>
      <Text style={[styles.menuTitle, highlight || danger ? styles.menuTitleAccent : null]}>{title}</Text>
      {subtitle ? <Text style={styles.menuSubtitle}>{subtitle}</Text> : null}
    </View>
    {chip ? (
      <View style={styles.menuChip}>
        <Text style={styles.menuChipLabel}>{chip}</Text>
      </View>
    ) : null}
    <MaterialCommunityIcons name="chevron-right" size={22} color={appColors.softInk} />
  </Pressable>
);

export const GetPaidRow = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { user } = useAuth();
  const statusQuery = useQuery({
    queryKey: ['stripe-connect-status'],
    queryFn: fetchStripeConnectStatus,
  });

  const chip = stripeConnectChipLabel(statusQuery.data, Boolean(user?.canSellTickets));
  const highlight = chip !== STRIPE_CONNECT_CHIP.ready;

  return (
    <ProfileMenuRow
      icon="wallet"
      title={GET_PAID_COPY.rowTitle}
      subtitle={GET_PAID_COPY.rowSubtitle}
      chip={statusQuery.isLoading ? '…' : chip}
      highlight={highlight}
      onPress={() => navigation.navigate('GetPaid')}
    />
  );
};

const styles = StyleSheet.create({
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: appColors.line,
  },
  menuRowHighlight: {
    marginHorizontal: -12,
    paddingHorizontal: 16,
    backgroundColor: appColors.primarySoft,
    borderTopColor: 'transparent',
    borderRadius: 16,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.cardStrong,
  },
  menuIconWrapHighlight: {
    backgroundColor: appColors.white,
  },
  menuCopy: {
    flex: 1,
    gap: 2,
  },
  menuTitle: {
    color: appColors.ink,
    fontWeight: '700',
    fontSize: 16,
  },
  menuTitleAccent: {
    color: appColors.primary,
  },
  menuSubtitle: {
    color: appColors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
  },
  menuChip: {
    borderRadius: 999,
    backgroundColor: 'rgba(28,21,32,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  menuChipLabel: {
    color: appColors.mutedInk,
    fontSize: 12,
    fontWeight: '700',
  },
});
