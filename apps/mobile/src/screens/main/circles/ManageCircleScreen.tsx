import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScrollView, View } from '@components/RNCompat';
import { appColors, appTypography } from '@theme/index';
import { CIRCLE_COPY, CircleClientError, isLastAdmin, sameId } from '@shared/circles';
import { useAuth } from '@hooks/useAuth';
import type { MainStackParamList } from '@navigation/types';
import {
  approveJoinRequest,
  declineJoinRequest,
  fetchCircleMembers,
  fetchJoinRequests,
  makeCircleAdmin,
  removeCircleAdmin,
  removeCircleMember,
} from '@services/circleService';

type Navigation = NativeStackNavigationProp<MainStackParamList, 'CircleManage'>;
type Tab = 'requests' | 'members' | 'admins';

export const ManageCircleScreen = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProp<MainStackParamList, 'CircleManage'>>();
  const { circleId, name } = route.params;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('requests');
  const [notice, setNotice] = useState<string | null>(null);

  const requests = useQuery({
    queryKey: ['circle-requests', String(circleId)],
    queryFn: () => fetchJoinRequests(circleId),
    retry: false,
  });
  const members = useQuery({
    queryKey: ['circle-members', String(circleId)],
    queryFn: () => fetchCircleMembers(circleId),
    retry: false,
  });
  const rows = members.data ?? [];

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['circle-requests', String(circleId)] });
    await queryClient.invalidateQueries({ queryKey: ['circle-members', String(circleId)] });
    await queryClient.invalidateQueries({ queryKey: ['circle', String(circleId)] });
    await queryClient.invalidateQueries({ queryKey: ['circles'] });
    await queryClient.invalidateQueries({ queryKey: ['prayer-circles'] });
  };

  const fail = (error: unknown) => setNotice(error instanceof CircleClientError ? error.message : CIRCLE_COPY.saveFailed);
  const guardLastAdmin = (personId: number | string) => {
    if (!isLastAdmin(rows, personId)) return false;
    setNotice(CIRCLE_COPY.lastAdmin);
    return true;
  };

  const approve = useMutation({
    mutationFn: (requestId: number | string) => approveJoinRequest(circleId, requestId),
    onSuccess: refresh,
    onError: fail,
  });
  const decline = useMutation({
    mutationFn: (requestId: number | string) => declineJoinRequest(circleId, requestId),
    onSuccess: refresh,
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (userId: number | string) => removeCircleMember(circleId, userId),
    onSuccess: refresh,
    onError: fail,
  });
  const promote = useMutation({
    mutationFn: (userId: number | string) => makeCircleAdmin(circleId, userId),
    onSuccess: refresh,
    onError: fail,
  });
  const demote = useMutation({
    mutationFn: (userId: number | string) => removeCircleAdmin(circleId, userId),
    onSuccess: refresh,
    onError: fail,
  });

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => navigation.goBack()} style={styles.back}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={appColors.primary} />
        </Pressable>
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={styles.title}>
            {CIRCLE_COPY.manage}
          </Text>
          {name ? <Text style={styles.subtitle}>{name}</Text> : null}
        </View>
      </View>
      <View style={styles.segment}>
        {(
          [
            ['requests', CIRCLE_COPY.requests],
            ['members', CIRCLE_COPY.members],
            ['admins', CIRCLE_COPY.admins],
          ] as const
        ).map(([value, label]) => {
          const selected = tab === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setTab(value)}
              style={[styles.segmentItem, selected ? styles.segmentOn : null]}
            >
              <Text style={[styles.segmentText, selected ? styles.segmentTextOn : null]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {notice ? <Text style={styles.error}>{notice}</Text> : null}
        {tab === 'requests' ? (
          <>
            {requests.isError ? <Text style={styles.error}>{CIRCLE_COPY.loadFailed}</Text> : null}
            {!requests.isLoading && (requests.data ?? []).length === 0 ? (
              <Text style={styles.empty}>{CIRCLE_COPY.noRequests}</Text>
            ) : null}
            {(requests.data ?? []).map((row) => (
              <View key={String(row.id)} style={styles.card}>
                <Text style={styles.name}>{row.user.name}</Text>
                <View style={styles.actions}>
                  <Pressable accessibilityRole="button" onPress={() => approve.mutate(row.id)} style={styles.primary}>
                    <Text style={styles.primaryText}>{CIRCLE_COPY.approve}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => decline.mutate(row.id)} style={styles.secondary}>
                    <Text style={styles.secondaryText}>{CIRCLE_COPY.decline}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        ) : null}
        {tab === 'members'
          ? rows.map((person) => {
              const self = user ? sameId(user.id, person.id) : false;
              return (
                <View key={String(person.id)} style={styles.card}>
                  <Text style={styles.name}>{person.name}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setNotice(null);
                      if (guardLastAdmin(person.id)) return;
                      remove.mutate(person.id);
                    }}
                    style={styles.secondary}
                  >
                    <Text style={styles.secondaryText}>{self ? CIRCLE_COPY.leave : CIRCLE_COPY.removeMember}</Text>
                  </Pressable>
                </View>
              );
            })
          : null}
        {tab === 'admins' ? (
          <>
            {rows
              .filter((person) => person.isAdmin)
              .map((person) => (
                <View key={String(person.id)} style={styles.card}>
                  <Text style={styles.name}>{person.name}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setNotice(null);
                      if (guardLastAdmin(person.id)) return;
                      demote.mutate(person.id);
                    }}
                    style={styles.secondary}
                  >
                    <Text style={styles.secondaryText}>{CIRCLE_COPY.removeAdmin}</Text>
                  </Pressable>
                </View>
              ))}
            {rows
              .filter((person) => !person.isAdmin)
              .map((person) => (
                <View key={String(person.id)} style={styles.card}>
                  <Text style={styles.name}>{person.name}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setNotice(null);
                      promote.mutate(person.id);
                    }}
                    style={styles.secondary}
                  >
                    <Text style={styles.secondaryText}>{CIRCLE_COPY.makeAdmin}</Text>
                  </Pressable>
                </View>
              ))}
          </>
        ) : null}
        {members.isError && tab !== 'requests' ? <Text style={styles.error}>{CIRCLE_COPY.loadFailed}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: appColors.background },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, minHeight: 56, gap: 4 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titles: { flex: 1 },
  title: { fontFamily: appTypography.bodySemibold, fontSize: 17, color: appColors.ink },
  subtitle: { fontFamily: appTypography.bodyRegular, fontSize: 13, color: appColors.mutedInk },
  segment: { flexDirection: 'row', backgroundColor: '#efe8e4', borderRadius: 14, padding: 4, marginHorizontal: 16, marginTop: 8 },
  segmentItem: { flex: 1, minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: appColors.white },
  segmentText: { fontFamily: appTypography.bodySemibold, fontSize: 14, color: appColors.mutedInk },
  segmentTextOn: { color: appColors.primary },
  body: { padding: 16, gap: 12, paddingBottom: 40 },
  card: {
    backgroundColor: appColors.white,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
  },
  name: { fontFamily: appTypography.bodySemibold, fontSize: 17, color: appColors.ink },
  actions: { flexDirection: 'row', gap: 8 },
  primary: { minHeight: 40, borderRadius: 999, backgroundColor: appColors.primary, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: appColors.white, fontFamily: appTypography.bodySemibold, fontSize: 15 },
  secondary: { alignSelf: 'flex-start', minHeight: 40, borderRadius: 999, borderWidth: 1, borderColor: appColors.line, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: appColors.ink, fontFamily: appTypography.bodySemibold, fontSize: 15 },
  empty: { textAlign: 'center', marginTop: 24, color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 16 },
  error: { color: appColors.danger, fontFamily: appTypography.bodyRegular, fontSize: 15 },
});
