import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { API_ROUTES } from '@shared/schema';

import { Image, View } from '@components/RNCompat';
import { AppButton } from '@components/ui/Button';
import { householdCountLabel } from '@foyer/logic';
import { openChurchCalendarSubscription } from '@foyer/openCalendar';
import { useAuth } from '@hooks/useAuth';
import type { MainStackParamList } from '@navigation/types';
import { api } from '@services/apiClient';
import { createChurch, fetchChurches, type ChurchRecord } from '@services/foyerService';
import { appColors, appTypography, radii } from '@theme/index';
import { getErrorMessage } from '@utils/error';
import { imageAssetToUploadDataUrl } from '@utils/profileImages';

export const FoyerProfileCard = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { user, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | ''>('');
  const [churchQuery, setChurchQuery] = useState('');
  const [churchId, setChurchId] = useState<number | null>(null);
  const [churchName, setChurchName] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const full = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
    setName(full);
    setBirthDate(user?.dateOfBirth ?? '');
    setSex(user?.sex ?? '');
    setChurchId(user?.churchId ?? null);
    setChurchName(user?.church?.name ?? '');
    setChurchQuery(user?.church?.name ?? '');
  }, [user]);

  const churches = useQuery({
    queryKey: ['foyer-churches', churchQuery],
    queryFn: () => fetchChurches(churchQuery),
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const [firstName, ...rest] = name.trim().split(/\s+/);
      await api.patch(API_ROUTES.USER_PROFILE, {
        first_name: firstName ?? '',
        last_name: rest.join(' '),
        date_of_birth: birthDate.trim() || null,
        sex: sex || null,
        church_id: churchId,
      });
      await refreshProfile();
    },
    onSuccess: () => setError(null),
    onError: (saveError) => setError(getErrorMessage(saveError, 'Unable to save your profile.')),
  });

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets[0]) {
      return;
    }
    const dataUrl = await imageAssetToUploadDataUrl(result.assets[0]);
    await api.patch(API_ROUTES.USER_PROFILE, { avatar_url: dataUrl });
    await refreshProfile();
  };

  const chooseChurch = (church: ChurchRecord) => {
    setChurchId(church.id);
    setChurchName(church.name);
    setChurchQuery(church.name);
    setOpen(false);
  };

  const addTypedChurch = async () => {
    const typed = churchQuery.trim();
    if (!typed) {
      return;
    }
    const created = await createChurch(typed);
    chooseChurch(created);
  };

  const results = churches.data ?? [];
  const typed = churchQuery.trim();

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Profile</Text>
        <Pressable accessibilityRole="button" onPress={() => saveMutation.mutate()}>
          <Text style={styles.save}>Save</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" onPress={() => void pickPhoto()} style={styles.photoButton}>
        {user?.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.firstName || 'A').slice(0, 1)}</Text>
          </View>
        )}
        <Text style={styles.change}>Change profile photo</Text>
      </Pressable>

      <Label text="Name" />
      <TextInput accessibilityLabel="Name" value={name} onChangeText={setName} style={styles.input} />
      <Label text="Birth date" />
      <TextInput
        accessibilityLabel="Birth date"
        value={birthDate}
        onChangeText={setBirthDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={appColors.softInk}
        style={styles.input}
      />
      <Label text="Sex" />
      <View style={styles.segment}>
        {(['male', 'female'] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: sex === value }}
            onPress={() => setSex(value)}
            style={[styles.segmentItem, sex === value ? styles.segmentOn : null]}
          >
            <Text style={[styles.segmentText, sex === value ? styles.segmentTextOn : null]}>
              {value === 'male' ? 'Male' : 'Female'}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.helper}>Only used for men's or women's events</Text>

      <Label text="Are you a church member, and where?" />
      <TextInput
        accessibilityLabel="Search churches"
        value={churchQuery}
        onChangeText={(value) => {
          setChurchQuery(value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search churches"
        placeholderTextColor={appColors.softInk}
        style={styles.input}
      />
      {open ? (
        <View style={styles.menu}>
          {results.map((church) => (
            <Pressable key={church.id} onPress={() => chooseChurch(church)} style={styles.menuRow}>
              <Text style={styles.menuText}>{church.name}</Text>
              {churchId === church.id ? <Text style={styles.check}>✓</Text> : null}
            </Pressable>
          ))}
          {typed ? (
            <Pressable onPress={() => void addTypedChurch()} style={styles.menuRow}>
              <Text style={styles.add}>Add "{typed}"</Text>
            </Pressable>
          ) : null}
          <Text style={styles.helper}>Shows what you type if your church isn't listed</Text>
        </View>
      ) : null}
      {churchName ? <Text style={styles.helper}>Selected: {churchName}</Text> : null}
      <Text style={styles.helper}>Not a member anywhere? Leave this blank.</Text>

      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('Household')}
        style={styles.household}
      >
        <Text style={styles.householdLabel}>Household</Text>
        <Text style={styles.householdCount}>{householdCountLabel(user?.householdChildCount ?? 0)}</Text>
      </Pressable>
      <Pressable accessibilityRole="link" accessibilityLabel="Subscribe to church calendar" onPress={openChurchCalendarSubscription} style={styles.subscribeCard}>
        <Text style={styles.householdLabel}>Subscribe to church calendar</Text>
        <Text style={styles.helper}>The Foyer does not need access to your calendar.</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {saveMutation.isPending ? <AppButton loading>Save</AppButton> : null}
    </View>
  );
};

const Label = ({ text }: { text: string }) => <Text style={styles.label}>{text}</Text>;

const styles = StyleSheet.create({
  card: { gap: 10, marginBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  screenTitle: { fontFamily: appTypography.bodySemibold, fontSize: 17, color: appColors.ink },
  save: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 16 },
  photoButton: { alignItems: 'center', gap: 8 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: appColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: appColors.white, fontSize: 28, fontFamily: appTypography.bodySemibold },
  change: { color: appColors.primary, fontFamily: appTypography.bodySemibold },
  label: { fontFamily: appTypography.bodySemibold, fontSize: 13, color: appColors.ink },
  input: {
    minHeight: 48,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
    paddingHorizontal: 14,
    color: appColors.ink,
  },
  segment: { flexDirection: 'row', gap: 8 },
  segmentItem: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: appColors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.white,
  },
  segmentOn: { borderColor: appColors.primary, backgroundColor: appColors.primaryWash },
  segmentText: { color: appColors.mutedInk, fontFamily: appTypography.bodyMedium },
  segmentTextOn: { color: appColors.primary, fontFamily: appTypography.bodySemibold },
  helper: { color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 12.5 },
  menu: { backgroundColor: appColors.white, borderRadius: radii.list, borderWidth: 1, borderColor: appColors.line },
  menuRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: appColors.line, flexDirection: 'row', justifyContent: 'space-between' },
  menuText: { color: appColors.ink, fontFamily: appTypography.bodyRegular },
  check: { color: appColors.primary },
  add: { color: appColors.primary, fontFamily: appTypography.bodySemibold },
  household: {
    marginTop: 8,
    backgroundColor: appColors.white,
    borderRadius: radii.list,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  householdLabel: { fontFamily: appTypography.bodySemibold, color: appColors.ink },
  householdCount: { color: appColors.mutedInk },
  subscribeCard: { backgroundColor: appColors.white, borderRadius: radii.list, padding: 16, gap: 4 },
  error: { color: appColors.danger },
});
