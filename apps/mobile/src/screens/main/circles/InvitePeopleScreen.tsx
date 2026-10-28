import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PillButton } from '@components/foyer/ui';
import { ScrollView, View } from '@components/RNCompat';
import { appColors, appTypography } from '@theme/index';
import { CIRCLE_COPY, CIRCLE_INVITE_BATCH_MAX, CircleClientError, sameId } from '@shared/circles';
import type { MainStackParamList } from '@navigation/types';
import { searchCirclePeople, sendCircleInvites } from '@services/circleService';

import { useDebounced } from './useDebounced';

type Navigation = NativeStackNavigationProp<MainStackParamList, 'CircleInvite'>;

export const InvitePeopleScreen = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProp<MainStackParamList, 'CircleInvite'>>();
  const { circleId } = route.params;
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Array<number | string>>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const debounced = useDebounced(query);
  const people = useQuery({
    queryKey: ['circle-people', String(circleId), debounced],
    queryFn: () => searchCirclePeople(circleId, debounced),
    retry: false,
  });

  const toggle = (id: number | string) => {
    setSelected((current) => {
      if (current.some((item) => sameId(item, id))) return current.filter((item) => !sameId(item, id));
      if (current.length >= CIRCLE_INVITE_BATCH_MAX) return current;
      return [...current, id];
    });
  };

  const send = useMutation({
    mutationFn: () => sendCircleInvites(circleId, selected),
    onSuccess: (result) => {
      const sent = new Set(result.invites.map((invite) => String(invite.invitee.id)));
      setSelected((current) => current.filter((id) => !sent.has(String(id))));
      if (result.errors.length > 0) {
        setNotice(result.errors.map((error) => error.detail).join('\n'));
        return;
      }
      navigation.goBack();
    },
    onError: (error) => setNotice(error instanceof CircleClientError ? error.message : CIRCLE_COPY.sendFailed),
  });

  const rows = people.data ?? [];

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => navigation.goBack()} style={styles.back}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={appColors.primary} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          {CIRCLE_COPY.inviteCta}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <TextInput
          accessibilityLabel={CIRCLE_COPY.peopleSearch}
          value={query}
          onChangeText={setQuery}
          placeholder={CIRCLE_COPY.peopleSearch}
          placeholderTextColor={appColors.softInk}
          style={styles.search}
          autoCorrect={false}
        />
        {people.isError ? <Text style={styles.error}>{CIRCLE_COPY.loadFailed}</Text> : null}
        {!people.isLoading && rows.length === 0 ? <Text style={styles.empty}>{CIRCLE_COPY.noPeople}</Text> : null}
        {rows.map((person) => {
          const invited = person.inviteState === 'invited';
          const checked = selected.some((id) => sameId(id, person.id));
          return (
            <Pressable
              key={String(person.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked, disabled: invited }}
              disabled={invited}
              onPress={() => toggle(person.id)}
              style={styles.row}
            >
              <Text style={styles.name}>{person.name}</Text>
              {invited ? <Text style={styles.side}>{CIRCLE_COPY.invited}</Text> : null}
              {checked && !invited ? <MaterialCommunityIcons name="check" size={22} color={appColors.primary} /> : null}
            </Pressable>
          );
        })}
        {notice ? <Text style={styles.error}>{notice}</Text> : null}
        <PillButton
          label={CIRCLE_COPY.sendInvites}
          disabled={selected.length === 0}
          loading={send.isPending}
          onPress={() => {
            setNotice(null);
            send.mutate();
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: appColors.background },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, minHeight: 52, gap: 4 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontFamily: appTypography.bodySemibold, fontSize: 17, color: appColors.ink },
  body: { padding: 20, gap: 12, paddingBottom: 40 },
  search: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
    paddingHorizontal: 14,
    fontFamily: appTypography.bodyRegular,
    fontSize: 16,
    color: appColors.ink,
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: appColors.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
  },
  name: { flex: 1, fontFamily: appTypography.bodyRegular, fontSize: 17, color: appColors.ink },
  side: { color: appColors.mutedInk, fontFamily: appTypography.bodySemibold, fontSize: 14 },
  empty: { textAlign: 'center', color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 16 },
  error: { color: appColors.danger, fontFamily: appTypography.bodyRegular, fontSize: 15 },
});
