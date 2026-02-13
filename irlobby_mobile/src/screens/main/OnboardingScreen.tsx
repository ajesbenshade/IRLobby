import * as Contacts from 'expo-contacts';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { Button, HelperText, Surface, Switch, Text, TextInput } from 'react-native-paper';

import { useAuth } from '@hooks/useAuth';
import { config } from '@constants/config';
import { createInvite, updateOnboarding } from '@services/authService';
import { getErrorMessage } from '@utils/error';

const MAX_INTERESTS = 20;

export const OnboardingScreen = () => {
  const { refreshProfile, signOut } = useAuth();
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [interestsInput, setInterestsInput] = useState('');
  const [indoor, setIndoor] = useState(false);
  const [outdoor, setOutdoor] = useState(true);
  const [smallGroups, setSmallGroups] = useState(true);
  const [weekendPreferred, setWeekendPreferred] = useState(true);

  const [inviteName, setInviteName] = useState('');
  const [inviteContact, setInviteContact] = useState('');

  const interests = useMemo(
    () =>
      interestsInput
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, MAX_INTERESTS),
    [interestsInput],
  );

  const onboardingMutation = useMutation({
    mutationFn: async (onboardingCompleted: boolean) =>
      updateOnboarding({
        bio,
        city,
        age_range: ageRange,
        interests,
        activity_preferences: {
          indoor,
          outdoor,
          smallGroups,
          weekendPreferred,
        },
        onboarding_completed: onboardingCompleted,
      }),
    onSuccess: async () => {
      await refreshProfile();
    },
  });

  const inviteMutation = useMutation({
    mutationFn: createInvite,
  });

  const sendManualInvite = async () => {
    if (!inviteContact.trim()) {
      return;
    }

    const invite = await inviteMutation.mutateAsync({
      contact_name: inviteName,
      contact_value: inviteContact.trim(),
      channel: inviteContact.includes('@') ? 'email' : 'sms',
    });

    const inviteLink = `${config.apiBaseUrl.replace('/api', '')}/invite/${invite.token}`;
    await Share.share({
      message: `Join me on IRLobby: ${inviteLink}`,
    });

    setInviteName('');
    setInviteContact('');
  };

  const importContactsAndInvite = async () => {
    const permission = await Contacts.requestPermissionsAsync();
    if (permission.status !== 'granted') {
      return;
    }

    const result = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
      pageSize: 200,
    });

    const firstInvitable = result.data.find(
      (contact) =>
        (contact.phoneNumbers && contact.phoneNumbers.length > 0) ||
        (contact.emails && contact.emails.length > 0),
    );

    if (!firstInvitable) {
      return;
    }

    const contactValue =
      firstInvitable.phoneNumbers?.[0]?.number ?? firstInvitable.emails?.[0]?.email ?? '';

    if (!contactValue) {
      return;
    }

    const invite = await inviteMutation.mutateAsync({
      contact_name: firstInvitable.name,
      contact_value: contactValue,
      channel: firstInvitable.phoneNumbers?.length ? 'sms' : 'email',
    });

    const inviteLink = `${config.apiBaseUrl.replace('/api', '')}/invite/${invite.token}`;
    await Share.share({
      message: `Join me on IRLobby: ${inviteLink}`,
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Surface elevation={2} style={styles.card}>
        <Text variant="headlineSmall">Finish your profile</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Tell us what you enjoy so we can improve your matches.
        </Text>

        <TextInput label="Short bio" value={bio} onChangeText={setBio} multiline style={styles.input} />
        <TextInput label="City" value={city} onChangeText={setCity} style={styles.input} />
        <TextInput
          label="Age range (e.g. 25-34)"
          value={ageRange}
          onChangeText={setAgeRange}
          style={styles.input}
        />
        <TextInput
          label="Hobbies (comma separated)"
          value={interestsInput}
          onChangeText={setInterestsInput}
          style={styles.input}
        />

        <View style={styles.preferenceRow}>
          <Text>Indoor activities</Text>
          <Switch value={indoor} onValueChange={setIndoor} />
        </View>
        <View style={styles.preferenceRow}>
          <Text>Outdoor activities</Text>
          <Switch value={outdoor} onValueChange={setOutdoor} />
        </View>
        <View style={styles.preferenceRow}>
          <Text>Prefer small groups</Text>
          <Switch value={smallGroups} onValueChange={setSmallGroups} />
        </View>
        <View style={styles.preferenceRow}>
          <Text>Prefer weekends</Text>
          <Switch value={weekendPreferred} onValueChange={setWeekendPreferred} />
        </View>

        {onboardingMutation.error && (
          <HelperText type="error" visible>
            {getErrorMessage(onboardingMutation.error, 'Unable to save onboarding.')}
          </HelperText>
        )}

        <View style={styles.actionRow}>
          <Button
            mode="text"
            onPress={() => onboardingMutation.mutate(true)}
            disabled={onboardingMutation.isPending}
          >
            Skip for now
          </Button>
          <Button
            mode="contained"
            onPress={() => onboardingMutation.mutate(true)}
            loading={onboardingMutation.isPending}
          >
            Complete
          </Button>
        </View>

        <View style={styles.divider} />

        <Text variant="titleMedium">Invite friends</Text>
        <TextInput
          label="Friend name (optional)"
          value={inviteName}
          onChangeText={setInviteName}
          style={styles.input}
        />
        <TextInput
          label="Phone or email"
          value={inviteContact}
          onChangeText={setInviteContact}
          style={styles.input}
        />

        {inviteMutation.error && (
          <HelperText type="error" visible>
            {getErrorMessage(inviteMutation.error, 'Unable to create invite.')}
          </HelperText>
        )}

        <Button mode="outlined" onPress={sendManualInvite} loading={inviteMutation.isPending}>
          Create invite link
        </Button>
        <Button mode="outlined" onPress={importContactsAndInvite} loading={inviteMutation.isPending}>
          Allow contacts and invite
        </Button>
        <Button mode="text" onPress={() => void signOut()}>
          Sign out
        </Button>
      </Surface>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  subtitle: {
    opacity: 0.75,
  },
  input: {
    backgroundColor: 'transparent',
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#cbd5e1',
    marginVertical: 8,
  },
});
