import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScrollView, View } from '@components/RNCompat';
import { PillButton } from '@components/foyer/ui';
import { appColors, appTypography } from '@theme/index';
import { CIRCLE_COPY, CIRCLE_DESCRIPTION_MAX, CIRCLE_NAME_MAX, CircleClientError, buildCircleCreate } from '@shared/circles';
import type { MainStackParamList } from '@navigation/types';
import { createCircle } from '@services/circleService';

type Navigation = NativeStackNavigationProp<MainStackParamList, 'CircleCreate'>;

export const CreateCircleScreen = () => {
  const navigation = useNavigation<Navigation>();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const draft = buildCircleCreate({ name, description });
  const canCreate = name.trim().length > 0 && draft.ok;

  const create = useMutation({
    mutationFn: () => {
      if (!draft.ok) throw new CircleClientError(draft.message);
      return createCircle(draft.payload);
    },
    onSuccess: async (circle) => {
      await queryClient.invalidateQueries({ queryKey: ['circles'] });
      await queryClient.invalidateQueries({ queryKey: ['prayer-circles'] });
      navigation.replace('CircleDetail', { circleId: circle.id, showInvite: true });
    },
    onError: (createError) => {
      setError(createError instanceof CircleClientError ? createError.message : CIRCLE_COPY.saveFailed);
    },
  });

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.navSide}>
          <Text style={styles.navAction}>{CIRCLE_COPY.cancel}</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.navTitle}>
          {CIRCLE_COPY.createTitle}
        </Text>
        <View style={styles.navSide} />
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>{CIRCLE_COPY.nameLabel}</Text>
        <TextInput
          accessibilityLabel={CIRCLE_COPY.nameLabel}
          value={name}
          onChangeText={setName}
          placeholder={CIRCLE_COPY.namePlaceholder}
          placeholderTextColor={appColors.softInk}
          maxLength={CIRCLE_NAME_MAX}
          onBlur={() => setNameTouched(true)}
          style={styles.input}
        />
        {nameTouched && !name.trim() ? <Text style={styles.hint}>{CIRCLE_COPY.nameRequired}</Text> : null}
        <Text style={styles.label}>{CIRCLE_COPY.descriptionLabel}</Text>
        <TextInput
          accessibilityLabel={CIRCLE_COPY.descriptionLabel}
          value={description}
          onChangeText={setDescription}
          maxLength={CIRCLE_DESCRIPTION_MAX}
          multiline
          style={[styles.input, styles.details]}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PillButton
          label={CIRCLE_COPY.createCta}
          disabled={!canCreate}
          loading={create.isPending}
          onPress={() => {
            setError(null);
            create.mutate();
          }}
          testID="circle-create-submit"
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: appColors.background },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, minHeight: 48 },
  navSide: { minWidth: 72, minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  navTitle: { flex: 1, textAlign: 'center', fontFamily: appTypography.bodySemibold, fontSize: 17, color: appColors.ink },
  navAction: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 17 },
  body: { padding: 20, gap: 8, paddingBottom: 40 },
  label: { marginTop: 12, fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.ink },
  input: {
    minHeight: 52,
    borderRadius: 16,
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
  error: { color: appColors.danger, fontFamily: appTypography.bodyMedium, fontSize: 15 },
});
