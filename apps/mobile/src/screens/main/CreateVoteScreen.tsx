import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Radio } from '@components/foyer/Choice';
import { DatePickerSheet } from '@components/foyer/DatePickerSheet';
import { TimePickerSheet } from '@components/foyer/TimePickerSheet';
import { VoteAudienceFields } from '@components/voting/VoteAudienceFields';
import { VoteRubric } from '@components/voting/VoteRubric';
import { ScrollView, View } from '@components/RNCompat';
import { useAuth } from '@hooks/useAuth';
import type { MainStackParamList } from '@navigation/types';
import { formatDayWithWeekday, formatTimeOfDay, hostDayLimits, timeSlots, toIsoDateTime, type DayValue } from '@foyer/dates';
import { createVote, fetchVoteCircles } from '@services/votingService';
import { appColors, appTypography, radii } from '@theme/index';
import {
  DEFAULT_OPTIONS,
  OPTION_MAX,
  RUBRIC_SEEN_KEY,
  VOTING_COPY,
  VoteClientError,
  addOption,
  buildVoteCreate,
  initialAdminCircleIds,
  removeOption,
  setOption,
  type ResultsMode,
  type VoteCreatePayload,
} from '@shared/voting';

type Navigation = NativeStackNavigationProp<MainStackParamList, 'VotingCreate'>;

export const CreateVoteScreen = () => {
  const navigation = useNavigation<Navigation>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isChurchAdmin = Boolean(user?.isChurchAdmin);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<string[]>(DEFAULT_OPTIONS);
  const [circleIds, setCircleIds] = useState<Array<number | string>>([]);
  const [untouched, setUntouched] = useState(true);
  const [wholeChurch, setWholeChurch] = useState(false);
  const [day, setDay] = useState<DayValue | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [resultsMode, setResultsMode] = useState<ResultsMode>('after_close');
  const [error, setError] = useState<string | null>(null);
  const [rubricSeen, setRubricSeen] = useState(false);
  const [rubricReady, setRubricReady] = useState(false);
  const circles = useQuery({
    queryKey: ['vote-circles'],
    queryFn: () => fetchVoteCircles(),
    retry: false,
  });
  const circleRows = circles.data?.circles ?? [];
  const closesAt = day && minutes != null ? toIsoDateTime(day, minutes) : '';
  const dayLimits = useMemo(() => hostDayLimits(), []);
  const slots = useMemo(() => timeSlots(), []);

  useEffect(() => {
    let live = true;
    void AsyncStorage.getItem(RUBRIC_SEEN_KEY)
      .then((value) => {
        if (live) setRubricSeen(value === '1');
      })
      .finally(() => {
        if (live) setRubricReady(true);
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const rows = circles.data?.circles ?? [];
    setCircleIds((current) => initialAdminCircleIds(rows, untouched, current));
  }, [circles.data, untouched]);

  const circlesStatus = circles.isLoading
    ? 'loading'
    : circles.isError
      ? 'error'
      : circles.data?.unavailable
        ? 'unavailable'
        : circleRows.length === 0
          ? 'empty'
          : 'ready';

  const draft = buildVoteCreate({
    title,
    description,
    options,
    circleIds,
    wholeChurch,
    closesAt,
    resultsMode,
    isChurchAdmin,
  });

  const post = useMutation({
    mutationFn: async (payload: VoteCreatePayload) => {
      const vote = await createVote(payload);
      await AsyncStorage.setItem(RUBRIC_SEEN_KEY, '1');
      return vote;
    },
    onSuccess: async (vote) => {
      await queryClient.invalidateQueries({ queryKey: ['votes'] });
      navigation.replace('VotingDetail', { voteId: vote.id });
    },
    onError: (postError) => {
      setError(postError instanceof VoteClientError ? postError.message : VOTING_COPY.postFailed);
    },
  });

  const submit = () => {
    if (!draft.ok) {
      setError(draft.message);
      return;
    }
    setError(null);
    post.mutate(draft.payload);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.navSide}>
          <Text style={styles.navAction}>{VOTING_COPY.cancel}</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.navTitle}>
          {VOTING_COPY.createTitle}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: post.isPending }}
          onPress={submit}
          style={styles.navSide}
          testID="vote-post"
        >
          <Text style={[styles.navAction, !draft.ok ? styles.navActionMuted : null]}>{VOTING_COPY.post}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {rubricReady ? <VoteRubric startCollapsed={rubricSeen} /> : null}
        <Text style={styles.label}>{VOTING_COPY.titleLabel}</Text>
        <TextInput
          accessibilityLabel={VOTING_COPY.titleLabel}
          value={title}
          onChangeText={setTitle}
          placeholder={VOTING_COPY.titlePlaceholder}
          placeholderTextColor={appColors.softInk}
          style={styles.input}
        />
        <Text style={styles.hint}>{VOTING_COPY.required}</Text>
        <Text style={styles.label}>{VOTING_COPY.descriptionLabel}</Text>
        <TextInput
          accessibilityLabel={VOTING_COPY.descriptionLabel}
          value={description}
          onChangeText={setDescription}
          placeholder={VOTING_COPY.descriptionPlaceholder}
          placeholderTextColor={appColors.softInk}
          multiline
          style={[styles.input, styles.details]}
        />
        <Text style={styles.hint}>{VOTING_COPY.descriptionHelper}</Text>
        <Text style={styles.label}>{VOTING_COPY.choicesLabel}</Text>
        {options.map((option, index) => (
          <View key={index} style={styles.optionRow}>
            <TextInput
              accessibilityLabel={`${VOTING_COPY.optionLabel} ${index + 1}`}
              value={option}
              onChangeText={(value) => setOptions((current) => setOption(current, index, value))}
              style={[styles.input, styles.optionInput]}
            />
            {options.length > 2 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={VOTING_COPY.removeOption}
                onPress={() => setOptions((current) => removeOption(current, index))}
              >
                <Text style={styles.remove}>{VOTING_COPY.removeOption}</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        {options.length < OPTION_MAX ? (
          <Pressable accessibilityRole="button" onPress={() => setOptions((current) => addOption(current))}>
            <Text style={styles.add}>+ {VOTING_COPY.addOption}</Text>
          </Pressable>
        ) : null}
        <VoteAudienceFields
          circles={circleRows}
          selectedIds={circleIds}
          onChangeSelected={(ids) => {
            setUntouched(false);
            setCircleIds(ids);
          }}
          wholeChurch={wholeChurch}
          onChangeWholeChurch={setWholeChurch}
          isChurchAdmin={isChurchAdmin}
          circlesStatus={circlesStatus}
        />
        <Text style={styles.label}>{VOTING_COPY.closesLabel}</Text>
        <View style={styles.when}>
          <Pressable accessibilityRole="button" onPress={() => setDateOpen(true)} style={styles.whenButton}>
            <Text style={styles.whenText}>{day ? formatDayWithWeekday(day) : VOTING_COPY.date}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setTimeOpen(true)} style={styles.whenButton}>
            <Text style={styles.whenText}>{minutes != null ? formatTimeOfDay(minutes) : VOTING_COPY.time}</Text>
          </Pressable>
        </View>
        <Text style={styles.label}>{VOTING_COPY.resultsLabel}</Text>
        {(
          [
            ['after_close', VOTING_COPY.resultsAfter],
            ['live', VOTING_COPY.resultsLive],
          ] as const
        ).map(([value, label]) => {
          const selected = resultsMode === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setResultsMode(value)}
              style={styles.mode}
            >
              <Radio selected={selected} />
              <Text style={styles.modeText}>{label}</Text>
            </Pressable>
          );
        })}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <DatePickerSheet
        mode="day"
        visible={dateOpen}
        title={VOTING_COPY.closesLabel}
        value={day}
        limits={dayLimits}
        onCancel={() => setDateOpen(false)}
        onDone={(value) => {
          setDay(value);
          setDateOpen(false);
        }}
      />
      <TimePickerSheet
        visible={timeOpen}
        title={VOTING_COPY.time}
        slots={slots}
        value={minutes}
        onCancel={() => setTimeOpen(false)}
        onDone={(value) => {
          if (value != null) setMinutes(value);
          setTimeOpen(false);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: appColors.background },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, minHeight: 48 },
  navSide: { minWidth: 88, minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  navTitle: { flex: 1, textAlign: 'center', fontFamily: appTypography.bodySemibold, fontSize: 17, color: appColors.ink },
  navAction: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 17 },
  navActionMuted: { color: '#c9a3b2' },
  body: { padding: 20, gap: 8, paddingBottom: 40 },
  label: { marginTop: 12, fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.ink },
  input: {
    minHeight: 52,
    borderRadius: radii.input ?? 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: appTypography.bodyRegular,
    fontSize: 16,
    color: appColors.ink,
  },
  details: { minHeight: 110, textAlignVertical: 'top' },
  hint: { color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 14 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionInput: { flex: 1 },
  remove: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 14 },
  add: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 15, marginTop: 4 },
  when: { gap: 8 },
  whenButton: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  whenText: { fontFamily: appTypography.bodyRegular, fontSize: 16, color: appColors.ink },
  mode: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  modeText: { fontFamily: appTypography.bodyRegular, fontSize: 17, color: appColors.ink },
  error: { color: appColors.danger, fontFamily: appTypography.bodyMedium, fontSize: 15 },
});
