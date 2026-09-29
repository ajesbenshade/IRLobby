import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { Text } from 'react-native-paper';

import { AppScrollView } from '@components/AppChrome';
import { View } from '@components/RNCompat';
import { AppButton } from '@components/ui/Button';
import { formatBornLine } from '@foyer/logic';
import { addHouseholdChild, fetchHousehold, removeHouseholdChild } from '@services/foyerService';
import { appColors, appTypography, radii } from '@theme/index';
import { getErrorMessage } from '@utils/error';

export const HouseholdScreen = () => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const childrenQuery = useQuery({ queryKey: ['foyer-household'], queryFn: fetchHousehold });

  const addMutation = useMutation({
    mutationFn: () => addHouseholdChild({ name: name.trim(), date_of_birth: birthDate.trim() }),
    onSuccess: async () => {
      setName('');
      setBirthDate('');
      setAdding(false);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['foyer-household'] });
    },
    onError: (addError) => setError(getErrorMessage(addError, 'Unable to add this child.')),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => removeHouseholdChild(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['foyer-household'] });
    },
  });

  return (
    <AppScrollView contentContainerStyle={styles.container}>
      <Pressable accessibilityRole="button" onPress={() => navigation.goBack()}>
        <Text style={styles.back}>Profile</Text>
      </Pressable>
      <Text style={styles.title}>Household</Text>
      <Text style={styles.intro}>
        Add children under 18 so you can RSVP for them. Only you can see this list.
      </Text>
      <Text style={styles.section}>CHILDREN UNDER 18</Text>
      <View style={styles.list}>
        {(childrenQuery.data ?? []).map((child) => (
          <View key={child.id} style={styles.row}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{child.name.replace(/\s+/g, '').slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={styles.copy}>
              <Text style={styles.name}>{child.name}</Text>
              <Text style={styles.meta}>{formatBornLine(child.date_of_birth, child.age)}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => removeMutation.mutate(child.id)}>
              <Text style={styles.remove}>Remove</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {adding ? (
        <View style={styles.form}>
          <TextInput
            accessibilityLabel="Child name"
            value={name}
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor={appColors.softInk}
            style={styles.input}
          />
          <TextInput
            accessibilityLabel="Child birth date"
            value={birthDate}
            onChangeText={setBirthDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={appColors.softInk}
            style={styles.input}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <AppButton
            disabled={!name.trim() || !birthDate.trim() || addMutation.isPending}
            loading={addMutation.isPending}
            onPress={() => addMutation.mutate()}
          >
            Save child
          </AppButton>
        </View>
      ) : (
        <AppButton variant="outline" onPress={() => setAdding(true)}>
          + Add child
        </AppButton>
      )}

      <View style={styles.note}>
        <Text style={styles.noteTitle}>Teens 13 and older</Text>
        <Text style={styles.noteBody}>
          Teens can have their own account instead of being listed here. They RSVP for themselves and join chats on their own.
        </Text>
      </View>
      <Text style={styles.footer}>Birth dates are used only to check age ranges on events.</Text>
    </AppScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14, paddingBottom: 48 },
  back: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 16 },
  title: { fontFamily: appTypography.bodySemibold, fontSize: 17, color: appColors.ink, textAlign: 'center', marginTop: -28 },
  intro: { fontFamily: appTypography.bodyRegular, fontSize: 15, color: appColors.ink, lineHeight: 22 },
  section: { fontFamily: appTypography.bodySemibold, fontSize: 12, color: appColors.mutedInk, letterSpacing: 0.4 },
  list: { backgroundColor: appColors.white, borderRadius: radii.list, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: appColors.line },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: appColors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 12 },
  copy: { flex: 1 },
  name: { fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.ink },
  meta: { fontFamily: appTypography.bodyRegular, fontSize: 13, color: appColors.mutedInk },
  remove: { color: appColors.primary, fontFamily: appTypography.bodySemibold },
  form: { gap: 10 },
  input: {
    minHeight: 48,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
    paddingHorizontal: 14,
    color: appColors.ink,
  },
  error: { color: appColors.danger },
  note: { backgroundColor: appColors.primarySoft, borderRadius: radii.list, padding: 14, gap: 4 },
  noteTitle: { color: appColors.primary, fontFamily: appTypography.bodySemibold },
  noteBody: { color: appColors.ink, fontFamily: appTypography.bodyRegular, lineHeight: 20 },
  footer: { color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 13 },
});
