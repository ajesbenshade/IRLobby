import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, TextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { API_ROUTES } from '@shared/schema';

import { DatePickerSheet, PickerField } from '@components/foyer/DatePickerSheet';
import { InlineError, PillButton, SectionLabel } from '@components/foyer/ui';
import { MapLocationSettingRow } from '@components/foyer/MapLocationSettingRow';
import { Image, View } from '@components/RNCompat';
import { useLegalSheet } from '@components/foyer/LegalWebViewSheet';
import { useAppConfig } from '@services/appConfig';
import {
  COMMON_COPY,
  FAMILY_COPY,
  FRIEND_COPY,
  MAP_COPY,
  MESSAGING_COPY,
  LEGAL_VIEW_COPY,
  PICKER_COPY,
  PROFILE_COPY,
  VISIBILITY_OPTIONS,
  type VisibilityLevel,
} from '@constants/foyerCopy';
import { birthDayLimits, defaultBirthMonth, formatDayShort, parseIsoDate, toIsoDate, type DayValue } from '@foyer/dates';
import { copyChurchCalendarLink, openChurchCalendarSubscription } from '@foyer/openCalendar';
import {
  ageFromIso,
  buildProfilePatch,
  formatPhoneForField,
  isDraftDirty,
  isUnder13Rejection,
  phoneError,
  phoneToggleEnabled,
  type ProfileDraft,
} from '@foyer/profileForm';
import { useAuth } from '@hooks/useAuth';
import type { MainStackParamList } from '@navigation/types';
import { api } from '@services/apiClient';
import { createChurch, fetchChurches, fetchFamilyMembers, fetchFriends, type ChurchRecord } from '@services/foyerService';
import { loadSettings, toPayload } from '@screens/main/SettingsScreen';
import { appColors, appTypography, radii } from '@theme/index';
import { getErrorMessage } from '@utils/error';
import { imageAssetToUploadDataUrl } from '@utils/profileImages';

const emptyDraft: ProfileDraft = {
  name: '',
  city: '',
  dateOfBirth: null,
  sex: '',
  churchId: null,
  visibility: 'only_me',
  phone: '',
  showEmail: false,
  showPhone: false,
  dmFromSharedEvents: false,
};

export const FoyerProfileCard = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const queryClient = useQueryClient();
  const { user, refreshProfile } = useAuth();
  const appConfig = useAppConfig();
  const legalSheet = useLegalSheet();
  const [draft, setDraft] = useState<ProfileDraft>(emptyDraft);
  const [baseline, setBaseline] = useState<ProfileDraft>(emptyDraft);
  const [locationOn, setLocationOn] = useState(false);
  const [locationBaseline, setLocationBaseline] = useState(false);
  const [churchQuery, setChurchQuery] = useState('');
  const [churchName, setChurchName] = useState('');
  const [open, setOpen] = useState(false);
  const [birthOpen, setBirthOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [birthError, setBirthError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimer.current) {
        clearTimeout(copiedTimer.current);
      }
    },
    [],
  );

  const settingsQuery = useQuery({ queryKey: ['mobile-settings'], queryFn: loadSettings });
  const friendsQuery = useQuery({ queryKey: ['foyer-friends'], queryFn: fetchFriends, retry: false });
  const familyQuery = useQuery({ queryKey: ['foyer-household'], queryFn: fetchFamilyMembers, retry: false });

  useEffect(() => {
    const next: ProfileDraft = {
      name: [user?.firstName, user?.lastName].filter(Boolean).join(' '),
      city: user?.city ?? '',
      dateOfBirth: user?.dateOfBirth ?? null,
      sex: user?.sex ?? '',
      churchId: user?.churchId ?? null,
      visibility: user?.profileVisibility ?? 'only_me',
      phone: formatPhoneForField(user?.phone),
      showEmail: Boolean(user?.showEmail),
      showPhone: Boolean(user?.showPhone),
      dmFromSharedEvents: Boolean(user?.dmFromSharedEvents),
    };
    setDraft(next);
    setBaseline(next);
    setChurchName(user?.church?.name ?? '');
    setChurchQuery(user?.church?.name ?? '');
  }, [user]);

  useEffect(() => {
    const value = settingsQuery.data?.privacy.locationSharing ?? false;
    setLocationOn(value);
    setLocationBaseline(value);
  }, [settingsQuery.data]);

  const churches = useQuery({
    queryKey: ['foyer-churches', churchQuery],
    queryFn: () => fetchChurches(churchQuery),
    enabled: open,
  });

  const isMinor = (() => {
    const age = ageFromIso(draft.dateOfBirth);
    return age != null && age < 18;
  })();
  const phoneProblem = phoneError(draft.phone);
  const dirty = isDraftDirty(draft, baseline) || locationOn !== locationBaseline;
  const canSave = dirty && !phoneProblem;

  const update = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
    setSaved(false);
    if (key === 'dateOfBirth') {
      setBirthError(null);
    }
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.patch(API_ROUTES.USER_PROFILE, buildProfilePatch(draft, { isMinor }));
      if (locationOn !== locationBaseline && settingsQuery.data) {
        await api.patch(
          API_ROUTES.USER_PROFILE,
          toPayload({ ...settingsQuery.data, privacy: { ...settingsQuery.data.privacy, locationSharing: locationOn } }),
        );
        await queryClient.invalidateQueries({ queryKey: ['mobile-settings'] });
      }
      await refreshProfile();
    },
    onSuccess: () => {
      setError(null);
      setBirthError(null);
      setSaved(true);
    },
    onError: (saveError) => {
      const message = getErrorMessage(saveError, 'Unable to save your profile.');
      if (isUnder13Rejection(message)) {
        // Inline under Birth date; Save stays enabled so they can pick another date.
        setBirthError(PICKER_COPY.under13);
        setError(null);
        return;
      }
      setError(message);
    },
  });

  const pickPhoto = async () => {
    // The system photo picker needs no library permission (add-only access is used for saving).
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets[0]) {
      return;
    }
    const dataUrl = await imageAssetToUploadDataUrl(result.assets[0]);
    await api.patch(API_ROUTES.USER_PROFILE, { avatar_url: dataUrl });
    await refreshProfile();
  };

  const chooseChurch = (church: ChurchRecord) => {
    update('churchId', church.id);
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
  const birthValue: DayValue | null = useMemo(() => parseIsoDate(draft.dateOfBirth), [draft.dateOfBirth]);
  const familyCount = familyQuery.data?.length ?? user?.householdChildCount ?? 0;
  const friendCount = friendsQuery.data?.length ?? 0;

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.screenTitle}>
        {PROFILE_COPY.title}
      </Text>
      <View style={styles.photoButton}>
        {user?.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.firstName || 'A').slice(0, 1)}</Text>
          </View>
        )}
        <PillButton label={PROFILE_COPY.changePhoto} variant="outline" onPress={() => void pickPhoto()} style={styles.changePill} />
      </View>

      <SectionLabel>{PROFILE_COPY.account}</SectionLabel>
      <Label text={PROFILE_COPY.name} />
      <TextInput accessibilityLabel={PROFILE_COPY.name} value={draft.name} onChangeText={(value) => update('name', value)} style={styles.input} />
      <Label text={PROFILE_COPY.city} />
      <TextInput accessibilityLabel={PROFILE_COPY.city} value={draft.city} onChangeText={(value) => update('city', value)} style={styles.input} />
      <PickerField
        label={PROFILE_COPY.birthDate}
        value={birthValue ? formatDayShort(birthValue) : ''}
        placeholder="Choose a date"
        error={birthError}
        errorStrong
        onPress={() => setBirthOpen(true)}
        testID="profile-birth-date"
      />
      <Label text={PROFILE_COPY.sex} />
      <View style={styles.segment}>
        {(['male', 'female'] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: draft.sex === value }}
            onPress={() => update('sex', value)}
            style={[styles.segmentItem, draft.sex === value ? styles.segmentOn : null]}
          >
            <Text style={[styles.segmentText, draft.sex === value ? styles.segmentTextOn : null]}>
              {value === 'male' ? PROFILE_COPY.male : PROFILE_COPY.female}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.helper}>{PROFILE_COPY.sexHelper}</Text>

      <View style={styles.rowsCard}>
        <NavRow
          icon="account-multiple-outline"
          label={PROFILE_COPY.myFamilyRow}
          count={FAMILY_COPY.membersCount(familyCount)}
          onPress={() => navigation.navigate('Household')}
        />
        <NavRow
          icon="account-group-outline"
          label={PROFILE_COPY.friendsRow}
          count={FRIEND_COPY.profileRowCount(friendCount)}
          onPress={() => navigation.navigate('Friends')}
          last
        />
      </View>

      <SectionLabel>{PROFILE_COPY.church}</SectionLabel>
      <Label text={PROFILE_COPY.yourChurch} />
      <View style={styles.searchRow}>
        <MaterialCommunityIcons name="magnify" size={20} color={appColors.mutedInk} />
        <TextInput
          accessibilityLabel={PROFILE_COPY.searchChurches}
          value={churchQuery}
          onChangeText={(value) => {
            setChurchQuery(value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={PROFILE_COPY.searchChurches}
          placeholderTextColor={appColors.softInk}
          style={styles.searchInput}
        />
        <MaterialCommunityIcons name="chevron-down" size={20} color={appColors.mutedInk} />
      </View>
      {open ? (
        <View style={styles.menu}>
          {results.map((church) => (
            <Pressable key={church.id} onPress={() => chooseChurch(church)} style={styles.menuRow}>
              <Text style={styles.menuText}>{church.name}</Text>
              {draft.churchId === church.id ? <Text style={styles.check}>✓</Text> : null}
            </Pressable>
          ))}
          {typed ? (
            <Pressable onPress={() => void addTypedChurch()} style={styles.menuRow}>
              <Text style={styles.add}>Add "{typed}"</Text>
            </Pressable>
          ) : null}
          <Text style={styles.helper}>{PROFILE_COPY.churchAddHelper}</Text>
        </View>
      ) : null}
      {churchName ? <Text style={styles.helper}>Selected: {churchName}</Text> : null}
      <Text style={styles.helper}>{PROFILE_COPY.churchHelper}</Text>

      <SectionLabel>{PROFILE_COPY.visibility}</SectionLabel>
      <Text accessibilityRole="header" style={styles.serifHeading}>
        {PROFILE_COPY.visibilityHeading}
      </Text>
      <View style={styles.rowsCard} accessibilityRole="radiogroup">
        {VISIBILITY_OPTIONS.map((option, index) => {
          const selected = draft.visibility === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              onPress={() => update('visibility', option.value as VisibilityLevel)}
              style={[styles.radioRow, index < VISIBILITY_OPTIONS.length - 1 ? styles.rowDivider : null]}
            >
              <View style={[styles.radio, selected ? styles.radioOn : null]}>
                {selected ? <View style={styles.radioDot} /> : null}
              </View>
              <View style={styles.radioCopy}>
                <View style={styles.radioTitleRow}>
                  <Text style={styles.radioLabel}>{option.label}</Text>
                  {option.value === 'only_me' ? (
                    <View style={styles.defaultTag}>
                      <Text style={styles.defaultTagText}>{PROFILE_COPY.defaultTag}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.helper}>{option.helper}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.helper}>{PROFILE_COPY.visibilityFooter}</Text>

      <SectionLabel>{MAP_COPY.settingSection}</SectionLabel>
      <MapLocationSettingRow />

      <SectionLabel>{PROFILE_COPY.contactInfo}</SectionLabel>
      <View style={styles.rowsCard}>
        <View style={styles.contactBlock}>
          <Label text={PROFILE_COPY.email} />
          <View style={styles.readOnly}>
            <Text style={styles.readOnlyText}>{user?.email ?? ''}</Text>
            <MaterialCommunityIcons name="lock-outline" size={18} color={appColors.mutedInk} />
          </View>
        </View>
        <ToggleRow
          label={PROFILE_COPY.showOnProfile}
          accessibilityLabel={`${PROFILE_COPY.email}: ${PROFILE_COPY.showOnProfile}`}
          value={draft.showEmail}
          onChange={(value) => update('showEmail', value)}
        />
      </View>
      <View style={styles.rowsCard}>
        <View style={styles.contactBlock}>
          <Label text={PROFILE_COPY.phone} />
          <TextInput
            accessibilityLabel={PROFILE_COPY.phone}
            value={draft.phone}
            onChangeText={(value) => {
              update('phone', value);
              if (!phoneToggleEnabled(value)) {
                update('showPhone', false);
              }
            }}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            placeholder={PROFILE_COPY.phonePlaceholder}
            placeholderTextColor={appColors.softInk}
            style={[styles.input, phoneProblem ? styles.inputError : null]}
          />
          <Text style={[styles.helper, phoneProblem ? styles.errorText : null]}>{PROFILE_COPY.phoneHint}</Text>
        </View>
        <ToggleRow
          label={PROFILE_COPY.showOnProfile}
          accessibilityLabel={`${PROFILE_COPY.phone}: ${PROFILE_COPY.showOnProfile}`}
          value={draft.showPhone && phoneToggleEnabled(draft.phone)}
          disabled={!phoneToggleEnabled(draft.phone)}
          onChange={(value) => update('showPhone', value)}
        />
      </View>
      <Text style={styles.helper}>{PROFILE_COPY.contactHelper}</Text>

      <SectionLabel>{MESSAGING_COPY.section}</SectionLabel>
      <View style={styles.rowsCard}>
        {isMinor ? (
          <View style={styles.contactBlock}>
            <Text style={styles.radioLabel}>{MESSAGING_COPY.minorTitle}</Text>
            <Text style={styles.helper}>{MESSAGING_COPY.minorHelper}</Text>
          </View>
        ) : (
          <ToggleRow
            label={MESSAGING_COPY.eventsToggle}
            helper={MESSAGING_COPY.eventsHelper}
            accessibilityLabel={MESSAGING_COPY.eventsToggle}
            value={draft.dmFromSharedEvents}
            onChange={(value) => update('dmFromSharedEvents', value)}
          />
        )}
        <NavRow
          icon="account-cancel-outline"
          label={MESSAGING_COPY.blockedPeople}
          onPress={() => navigation.navigate('Messaging')}
          last
        />
      </View>

      <SectionLabel>{PROFILE_COPY.location}</SectionLabel>
      <View style={styles.rowsCard}>
        <ToggleRow
          label="Use my location to find nearby gatherings"
          helper="Never shown to other people."
          accessibilityLabel="Use my location to find nearby gatherings"
          value={locationOn}
          onChange={(value) => {
            setSaved(false);
            setLocationOn(value);
          }}
        />
      </View>

      <InlineError message={phoneProblem && dirty ? PROFILE_COPY.phoneHint : error} />
      <PillButton label={COMMON_COPY.save} disabled={!canSave} loading={saveMutation.isPending} onPress={() => saveMutation.mutate()} />
      {saved ? (
        <Text accessibilityLiveRegion="polite" style={styles.savedText}>
          {PROFILE_COPY.saved}
        </Text>
      ) : null}
      <Text style={styles.pull}>{PROFILE_COPY.pullToRefresh}</Text>

      <SectionLabel>{PROFILE_COPY.contactAdmins.toUpperCase()}</SectionLabel>
      <Text style={styles.helper}>{PROFILE_COPY.contactAdminsLead}</Text>
      {appConfig.adminEmail ? (
        <View style={styles.rowsCard} testID="church-contact-card">
          <View style={styles.adminCard}>
            {appConfig.adminName ? <Text style={styles.navLabel}>{appConfig.adminName}</Text> : null}
            <Text style={styles.helper}>{PROFILE_COPY.churchAdminRole}</Text>
            <Text style={styles.helper} selectable>{appConfig.adminEmail}</Text>
            {appConfig.adminPhone ? <Text style={styles.helper} selectable>{appConfig.adminPhone}</Text> : null}
          </View>
          {appConfig.adminContactUrl ? (
            <PillButton
              label={PROFILE_COPY.emailAdmins}
              onPress={() => void Linking.openURL(appConfig.adminContactUrl as string).catch(() => undefined)}
              testID="email-admins"
            />
          ) : null}
        </View>
      ) : (
        <Text style={styles.helper} testID="church-contact-missing">{PROFILE_COPY.contactMissing}</Text>
      )}
      <View style={styles.rowsCard}>
        {appConfig.termsUrl ? (
          <NavRow icon="file-document-outline" label={PROFILE_COPY.termsRow} onPress={() => legalSheet.open(appConfig.termsUrl as string, LEGAL_VIEW_COPY.termsTitle)} />
        ) : null}
        {appConfig.privacyUrl ? (
          <NavRow icon="shield-lock-outline" label={PROFILE_COPY.privacyRow} onPress={() => legalSheet.open(appConfig.privacyUrl as string, LEGAL_VIEW_COPY.privacyTitle)} />
        ) : null}
        <NavRow icon="account-remove-outline" label={PROFILE_COPY.deleteRow} danger onPress={() => navigation.navigate('Account')} last />
      </View>
      <Text style={styles.helper}>{PROFILE_COPY.versionLine}</Text>
      {legalSheet.element}

      <Text style={styles.calendarSection}>CALENDAR</Text>
      <View style={styles.calendarCard}>
        <View style={styles.calendarHeading}>
          <View style={styles.calendarIcon}>
            <MaterialCommunityIcons name="calendar-month-outline" size={22} color={appColors.primary} />
          </View>
          <Text style={styles.calendarTitle}>Church calendar</Text>
        </View>
        <Text style={styles.calendarBody}>
          Subscribe to see every Franconia gathering in your own calendar. It updates automatically.
        </Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Subscribe to church calendar"
          onPress={openChurchCalendarSubscription}
          style={styles.subscribeButton}
        >
          <Text style={styles.subscribeText}>Subscribe to church calendar</Text>
        </Pressable>
        <Text style={styles.calendarNote}>Opens in Apple Calendar, or copy the link for Google or Outlook.</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Copy link"
          onPress={() => {
            void copyChurchCalendarLink()
              .then(() => {
                setLinkCopied(true);
                if (copiedTimer.current) {
                  clearTimeout(copiedTimer.current);
                }
                copiedTimer.current = setTimeout(() => setLinkCopied(false), 2000);
              })
              .catch(() => setLinkCopied(false));
          }}
          style={styles.copyRow}
        >
          <MaterialCommunityIcons name="content-copy" size={16} color={appColors.primary} />
          <Text style={styles.copyText}>Copy link</Text>
        </Pressable>
        {linkCopied ? (
          <Text accessibilityLiveRegion="polite" style={styles.copied}>
            Link copied
          </Text>
        ) : null}
      </View>
      <DatePickerSheet
        visible={birthOpen}
        mode="birthdate"
        title={PROFILE_COPY.birthDate}
        value={birthValue}
        limits={birthDayLimits()}
        onCancel={() => setBirthOpen(false)}
        onDone={(value) => {
          update('dateOfBirth', toIsoDate(value));
          setBirthOpen(false);
        }}
      />
    </View>
  );
};

const Label = ({ text }: { text: string }) => <Text style={styles.label}>{text}</Text>;

const NavRow = ({
  icon,
  label,
  count,
  onPress,
  last,
  danger,
}: {
  danger?: boolean;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  count?: string;
  onPress: () => void;
  last?: boolean;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={count ? `${label}, ${count}` : label}
    onPress={onPress}
    style={[styles.navRow, last ? null : styles.rowDivider]}
  >
    <MaterialCommunityIcons name={icon} size={22} color={danger ? '#8a0a1f' : appColors.primary} />
    <Text style={[styles.navLabel, danger ? { color: '#8a0a1f' } : null]}>{label}</Text>
    {count ? <Text style={styles.navCount}>{count}</Text> : null}
    <MaterialCommunityIcons name="chevron-right" size={22} color={appColors.mutedInk} />
  </Pressable>
);

const ToggleRow = ({
  label,
  helper,
  value,
  disabled,
  onChange,
  accessibilityLabel,
}: {
  label: string;
  helper?: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  accessibilityLabel: string;
}) => (
  <View style={styles.toggleRow}>
    <View style={styles.toggleCopy}>
      <Text style={styles.radioLabel}>{label}</Text>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
    <Switch
      accessibilityLabel={accessibilityLabel}
      value={value}
      disabled={disabled}
      onValueChange={onChange}
      trackColor={{ false: '#e1dbd7', true: appColors.primary }}
      thumbColor={disabled ? '#f6f1ee' : '#ffffff'}
    />
  </View>
);

const styles = StyleSheet.create({
  adminCard: { padding: 14, gap: 2 },
  card: { gap: 10, marginBottom: 12 },
  screenTitle: { fontFamily: appTypography.bodySemibold, fontSize: 17, lineHeight: 24, color: appColors.ink, textAlign: 'center' },
  photoButton: { alignItems: 'center', gap: 10 },
  changePill: { minWidth: 160 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: appColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: appColors.white, fontSize: 28, fontFamily: appTypography.bodySemibold },
  label: { fontFamily: appTypography.bodySemibold, fontSize: 13, color: appColors.ink },
  input: {
    minHeight: 54,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
    paddingHorizontal: 14,
    color: appColors.ink,
  },
  inputError: { borderColor: appColors.primary, borderWidth: 1.8 },
  errorText: { color: appColors.primary },
  searchRow: {
    minHeight: 54,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, minHeight: 48, color: appColors.ink },
  segment: { flexDirection: 'row', gap: 8 },
  segmentItem: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 6,
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
  helper: { color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 12.5, lineHeight: 18 },
  menu: { backgroundColor: appColors.white, borderRadius: radii.list, borderWidth: 1, borderColor: appColors.line },
  menuRow: { minHeight: 48, padding: 12, borderBottomWidth: 1, borderBottomColor: appColors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  menuText: { flex: 1, color: appColors.ink, fontFamily: appTypography.bodyRegular, lineHeight: 22 },
  check: { color: appColors.primary },
  add: { flex: 1, color: appColors.primary, fontFamily: appTypography.bodySemibold, lineHeight: 22 },
  rowsCard: { backgroundColor: appColors.white, borderRadius: radii.list, overflow: 'hidden' },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: appColors.line },
  navRow: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  navLabel: { flex: 1, flexShrink: 1, fontFamily: appTypography.bodySemibold, color: appColors.ink, fontSize: 16 },
  navCount: { flexShrink: 1, color: appColors.mutedInk, textAlign: 'right', fontFamily: appTypography.bodyRegular },
  serifHeading: { fontFamily: appTypography.heading, fontSize: 20, lineHeight: 28, color: appColors.ink },
  radioRow: { minHeight: 56, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#cec8c4', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  radioOn: { borderColor: appColors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: appColors.primary },
  radioCopy: { flex: 1, flexShrink: 1, gap: 2 },
  radioTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  radioLabel: { fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.ink, flexShrink: 1 },
  defaultTag: { backgroundColor: appColors.primarySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  defaultTagText: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 11.5 },
  contactBlock: { padding: 16, gap: 6 },
  readOnly: {
    minHeight: 54,
    borderRadius: radii.input,
    backgroundColor: '#efe9e5',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  readOnlyText: { flex: 1, color: appColors.mutedInk, fontFamily: appTypography.bodyRegular },
  toggleRow: { minHeight: 56, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: appColors.line },
  toggleCopy: { flex: 1, flexShrink: 1, gap: 2 },
  savedText: { textAlign: 'center', color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 14 },
  pull: { textAlign: 'center', color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 13 },
  calendarSection: {
    marginTop: 16,
    fontFamily: appTypography.bodySemibold,
    fontSize: 11.5,
    letterSpacing: 0.6,
    color: appColors.mutedInk,
  },
  calendarCard: { backgroundColor: appColors.white, borderRadius: radii.list, padding: 16, gap: 12 },
  calendarHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  calendarIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: appColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarTitle: { flex: 1, fontFamily: appTypography.bodySemibold, color: appColors.ink, fontSize: 17 },
  calendarBody: { fontFamily: appTypography.bodyRegular, fontSize: 15, lineHeight: 21, color: appColors.mutedInk },
  subscribeButton: {
    minHeight: 54,
    borderRadius: 999,
    backgroundColor: appColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  subscribeText: { color: appColors.white, fontFamily: appTypography.bodySemibold, fontSize: 16 },
  calendarNote: { fontFamily: appTypography.bodyRegular, fontSize: 13, lineHeight: 18, color: appColors.mutedInk },
  copyRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  copyText: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 16 },
  copied: { textAlign: 'center', color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 13 },
  error: { color: appColors.danger },
});
