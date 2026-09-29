import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoyerHeader } from '@components/FoyerHeader';
import { ScrollView, View } from '@components/RNCompat';
import { AppButton } from '@components/ui/Button';
import {
  CALENDAR_ADDRESS_WARNING,
  FEE_NOTE,
  parseCapacity,
  parseSuggestedDonation,
  type AudienceGender,
  type HostKind,
} from '@foyer/logic';
import { compressGatheringPhoto } from '@foyer/photos';
import { useAuth } from '@hooks/useAuth';
import type { MainStackParamList } from '@navigation/types';
import { createActivity, updateActivity } from '@services/activityService';
import { uploadGatheringPhoto } from '@services/foyerService';
import { appColors, appTypography, radii } from '@theme/index';
import { getErrorMessage } from '@utils/error';

type FoyerHostFormProps = {
  activityId?: number | string;
};

export const FoyerHostForm = ({ activityId }: FoyerHostFormProps) => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { user } = useAuth();
  const isEditing = Boolean(activityId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [place, setPlace] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [capacity, setCapacity] = useState('');
  const [audience, setAudience] = useState<AudienceGender>('everyone');
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [listOnCalendar, setListOnCalendar] = useState(false);
  const [acceptGifts, setAcceptGifts] = useState(false);
  const [suggested, setSuggested] = useState('10');
  const [hostAsChurch, setHostAsChurch] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const capacityResult = parseCapacity(capacity);
      if (!capacityResult.ok) {
        throw new Error(capacityResult.message);
      }
      const payload = {
        title: title.trim(),
        description: description.trim(),
        location: place.trim(),
        latitude: 0,
        longitude: 0,
        time: start.trim(),
        end_time: end.trim() || undefined,
        capacity: capacityResult.capacity,
        audience_gender: audience,
        age_min: ageMin.trim() ? Number(ageMin) : null,
        age_max: ageMax.trim() ? Number(ageMax) : null,
        list_on_church_calendar: listOnCalendar,
        donation_enabled: acceptGifts,
        suggested_donation: acceptGifts ? parseSuggestedDonation(suggested) : null,
        host_kind: (hostAsChurch ? 'church' : 'person') as HostKind,
      };
      const saved = isEditing && activityId
        ? await updateActivity(activityId, payload as never)
        : await createActivity(payload as never);
      if (photoUri) {
        const compressed = await compressGatheringPhoto(photoUri);
        await uploadGatheringPhoto(saved.id, compressed);
      }
      return saved;
    },
    onSuccess: () => {
      navigation.navigate('Tabs', { screen: 'Activity' });
    },
    onError: (saveError) => {
      setError(getErrorMessage(saveError, 'Unable to post this gathering.'));
    },
  });

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is needed to add a cover photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const submit = () => {
    const capacityResult = parseCapacity(capacity);
    if (!capacityResult.ok) {
      setError(capacityResult.message);
      return;
    }
    if (!title.trim() || !place.trim() || !start.trim()) {
      setError('Add a title, place, and start time.');
      return;
    }
    setError(null);
    saveMutation.mutate();
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()}>
          <Text style={styles.topAction}>Cancel</Text>
        </Pressable>
        <Text style={styles.navTitle}>Host a gathering</Text>
        <Pressable accessibilityRole="button" onPress={submit}>
          <Text style={styles.topAction}>Post</Text>
        </Pressable>
      </SafeAreaView>
      <ScrollView contentContainerStyle={styles.content}>
        <FoyerHeader />
        <Pressable accessibilityRole="button" accessibilityLabel="Add a cover photo" onPress={() => void pickPhoto()} style={styles.cover}>
          <Text style={styles.coverTitle}>{photoUri ? 'Cover photo selected' : 'Add a cover photo'}</Text>
          <Text style={styles.helper}>Choose from library or take a photo</Text>
        </Pressable>

        <Field label="Title" value={title} onChange={setTitle} placeholder="Women's Fall Brunch" />
        <Field label="Description" value={description} onChange={setDescription} multiline placeholder="Egg casseroles, apple crisp, and good conversation." />
        <Field label="Place" value={place} onChange={setPlace} placeholder="Fellowship Hall, Franconia Mennonite Church" />
        <Field label="Date & time" value={start} onChange={setStart} placeholder="Sat, Oct 17, 2026 9:30 AM" />
        <Field label="Ends" value={end} onChange={setEnd} placeholder="11:00 AM" />
        <Field
          label="Capacity"
          value={capacity}
          onChange={setCapacity}
          placeholder="No limit"
          keyboardType="number-pad"
          helper="Leave blank for no limit. Up to 500."
        />

        <Text style={styles.label}>Audience</Text>
        <View style={styles.segment}>
          {([
            ['everyone', 'Everyone'],
            ['men', 'Men'],
            ['women', 'Women'],
          ] as const).map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: audience === value }}
              onPress={() => setAudience(value)}
              style={[styles.segmentItem, audience === value ? styles.segmentOn : null]}
            >
              <Text style={[styles.segmentText, audience === value ? styles.segmentTextOn : null]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Age range</Text>
        <View style={styles.ageRow}>
          <Field label="Min" value={ageMin} onChange={setAgeMin} placeholder="18" keyboardType="number-pad" />
          <Field label="Max" value={ageMax} onChange={setAgeMax} placeholder="Any" keyboardType="number-pad" />
        </View>
        <Text style={styles.helper}>Leave max blank for no upper limit. Children in a household can be added if they fit the range.</Text>

        <CheckRow
          label="Post to the church website calendar"
          value={listOnCalendar}
          onChange={setListOnCalendar}
        />
        <View style={styles.warn}>
          <Text style={styles.warnText}>{CALENDAR_ADDRESS_WARNING}</Text>
        </View>

        <CheckRow label="Accept gifts" value={acceptGifts} onChange={setAcceptGifts} />
        <Text style={styles.helper}>After someone RSVPs, they can choose to chip in. Gifts open in Safari.</Text>
        {acceptGifts ? (
          <>
            <Field label="Suggested amount" value={suggested} onChange={setSuggested} placeholder="$10" keyboardType="decimal-pad" />
            <Text style={styles.helper}>{FEE_NOTE}</Text>
          </>
        ) : null}

        {user?.isChurchAdmin ? (
          <View style={styles.admin}>
            <Text style={styles.adminLabel}>Admin only</Text>
            <CheckRow
              label="Host as Franconia Mennonite Church"
              value={hostAsChurch}
              onChange={setHostAsChurch}
            />
            <Text style={styles.helper}>The church is shown as host and gifts go to the church.</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton onPress={submit} loading={saveMutation.isPending} disabled={saveMutation.isPending}>
          Post gathering
        </AppButton>
        <Text style={styles.footer}>Chat opens for people who are going.</Text>
      </ScrollView>
    </View>
  );
};

const Field = ({
  label,
  value,
  onChange,
  placeholder,
  helper,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helper?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
}) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      accessibilityLabel={label}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={appColors.softInk}
      multiline={multiline}
      keyboardType={keyboardType}
      style={[styles.input, multiline ? styles.inputMulti : null]}
    />
    {helper ? <Text style={styles.helper}>{helper}</Text> : null}
  </View>
);

const CheckRow = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) => (
  <View style={styles.checkRow}>
    <Text style={styles.checkLabel}>{label}</Text>
    <Switch
      accessibilityLabel={label}
      value={value}
      onValueChange={onChange}
      trackColor={{ false: appColors.line, true: appColors.primary }}
      thumbColor={appColors.white}
    />
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: appColors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: appColors.background,
  },
  navTitle: { fontFamily: appTypography.bodySemibold, fontSize: 17, color: appColors.ink },
  topAction: { fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.primary },
  content: { padding: 20, gap: 14, paddingBottom: 48 },
  cover: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  coverTitle: { fontFamily: appTypography.bodySemibold, color: appColors.primary, fontSize: 16 },
  field: { gap: 6 },
  label: { fontFamily: appTypography.bodySemibold, fontSize: 13, color: appColors.ink },
  input: {
    minHeight: 48,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
    paddingHorizontal: 14,
    color: appColors.ink,
    fontFamily: appTypography.bodyRegular,
  },
  inputMulti: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' },
  helper: { fontFamily: appTypography.bodyRegular, fontSize: 12.5, color: appColors.mutedInk, lineHeight: 18 },
  segment: { flexDirection: 'row', backgroundColor: appColors.white, borderRadius: 10, padding: 4, gap: 4 },
  segmentItem: { flex: 1, minHeight: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: appColors.primaryWash },
  segmentText: { fontFamily: appTypography.bodyMedium, color: appColors.mutedInk },
  segmentTextOn: { color: appColors.primary, fontFamily: appTypography.bodySemibold },
  ageRow: { flexDirection: 'row', gap: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  checkLabel: { flex: 1, fontFamily: appTypography.bodySemibold, fontSize: 15, color: appColors.ink },
  warn: { backgroundColor: appColors.warnBg, borderRadius: radii.list, padding: 12 },
  warnText: { color: appColors.warnText, fontFamily: appTypography.bodyRegular, fontSize: 13, lineHeight: 18 },
  admin: { borderRadius: radii.list, borderWidth: 1, borderColor: appColors.line, padding: 12, gap: 8, backgroundColor: appColors.white },
  adminLabel: { fontFamily: appTypography.bodySemibold, fontSize: 12, color: appColors.mutedInk, textTransform: 'uppercase' },
  error: { color: appColors.danger, fontFamily: appTypography.bodyMedium },
  footer: { textAlign: 'center', color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 13 },
});
