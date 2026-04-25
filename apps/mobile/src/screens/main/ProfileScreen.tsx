import { useMutation } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Button, HelperText, Text } from "react-native-paper";
import { API_ROUTES } from "@shared/schema";

import {
  AccentPill,
  AppScrollView,
  EmptyStatePanel,
  PageHeader,
  PanelCard,
  SectionIntro,
} from "@components/AppChrome";
import { TextInput } from "@components/PaperCompat";
import { Image, Text as NativeText, View } from "@components/RNCompat";
import { ProfileCompletionRing } from "@components/ProfileCompletionRing";
import { DEFAULT_PROFILE_AVATARS } from "@constants/profileAvatars";
import { useAuth } from "@hooks/useAuth";
import { api } from "@services/apiClient";
import { updateOnboarding } from "@services/authService";
import { appColors, appTypography, palette, radii } from "@theme/index";
import { getErrorMessage } from "@utils/error";
import { imageAssetToUploadDataUrl } from "@utils/profileImages";

import type { MainStackParamList } from "@navigation/types";

export const ProfileScreen = () => {
  const MAX_INTERESTS = 20;
  const MAX_PHOTOS = 12;

  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { user, signOut, refreshProfile } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [interestInput, setInterestInput] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [photoInput, setPhotoInput] = useState("");
  const [photoAlbum, setPhotoAlbum] = useState<string[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    setFirstName(user?.firstName ?? "");
    setLastName(user?.lastName ?? "");
    setBio(user?.bio ?? "");
    setCity(user?.city ?? "");
    setAvatarUrl(user?.avatarUrl ?? "");
    setInterests(user?.interests ?? []);
    setPhotoAlbum(user?.photoAlbum ?? []);
    setInterestInput("");
    setPhotoInput("");
    setImageError(null);
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.patch(API_ROUTES.USER_PROFILE, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        bio: bio.trim(),
        location: city.trim(),
        avatar_url: avatarUrl.trim(),
      });

      await updateOnboarding({
        bio: bio.trim(),
        city: city.trim(),
        avatar_url: avatarUrl.trim(),
        interests,
        photo_album: photoAlbum,
      });
    },
    onSuccess: async () => {
      await refreshProfile();
    },
  });

  const addInterest = () => {
    const next = interestInput.trim();
    if (
      !next ||
      interests.includes(next) ||
      interests.length >= MAX_INTERESTS
    ) {
      return;
    }
    setInterests((previous) => [...previous, next]);
    setInterestInput("");
  };

  const removeInterest = (value: string) => {
    setInterests((previous) =>
      previous.filter((interest) => interest !== value)
    );
  };

  const addPhotoByUrl = () => {
    const next = photoInput.trim();
    if (!next || photoAlbum.length >= MAX_PHOTOS) {
      return;
    }
    setPhotoAlbum((previous) => [...previous, next]);
    setPhotoInput("");
  };

  const removePhotoAt = (index: number) => {
    setPhotoAlbum((previous) =>
      previous.filter((_, currentIndex) => currentIndex !== index)
    );
  };

  const pickAvatarFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setImageError(
        "Media library permission is required to update your avatar."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      try {
        const dataUrl = await imageAssetToUploadDataUrl(result.assets[0]);
        setAvatarUrl(dataUrl);
        setImageError(null);
      } catch (error) {
        console.warn("[ProfileScreen] Failed to load selected avatar", error);
        setImageError(
          getErrorMessage(
            error,
            "Unable to prepare that photo. Try a different image."
          )
        );
      }
    }
  };

  const addPhotoFromLibrary = async () => {
    if (photoAlbum.length >= MAX_PHOTOS) {
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setImageError("Media library permission is required to add photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.7,
      selectionLimit: MAX_PHOTOS - photoAlbum.length,
    });

    if (!result.canceled) {
      try {
        const selected = result.assets.filter((asset) => Boolean(asset.uri));
        const dataUrls = await Promise.all(
          selected.map(imageAssetToUploadDataUrl)
        );
        setPhotoAlbum((previous) =>
          [...previous, ...dataUrls].slice(0, MAX_PHOTOS)
        );
        setImageError(null);
      } catch (error) {
        console.warn(
          "[ProfileScreen] Failed to load selected album photo(s)",
          error
        );
        setImageError(
          getErrorMessage(
            error,
            "Unable to prepare one of those photos. Try fewer images."
          )
        );
      }
    }
  };

  return (
    <AppScrollView contentContainerStyle={styles.container}>
      <PageHeader
        eyebrow="Your vibe"
        title="Show people why they should say yes"
        subtitle="Shape the profile people scan before they join your plan, match with you, or open the chat."
      />

      <ProfileCompletionRing />

      <View style={styles.heroShell}>
        <LinearGradient
          colors={[palette.primary, palette.primaryDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGradient}
        />
        <View style={styles.heroContent}>
          <View style={styles.heroTopRow}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarPreview} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>
                  {(firstName || user?.email || "U").charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.heroCopy}>
              <NativeText style={styles.heroBadge}>Public vibe</NativeText>
              <Text variant="titleLarge" style={styles.heroName}>
                {[firstName, lastName].filter(Boolean).join(" ") ||
                  user?.email ||
                  "Your profile"}
              </Text>
              <Text style={styles.heroEmail}>
                {user?.email ?? "Not signed in"}
              </Text>
              <Text style={styles.heroSubline}>
                {bio?.trim() ||
                  "Add a quick line so people know what kind of energy you bring."}
              </Text>
            </View>
          </View>
          <Button
            mode="contained"
            onPress={pickAvatarFromLibrary}
            style={styles.inlineButton}
            buttonColor="rgba(255,255,255,0.18)"
            textColor={appColors.white}
          >
            Update avatar
          </Button>
          <View style={styles.defaultAvatarSection}>
            <NativeText style={styles.defaultAvatarTitle}>
              Starter avatars
            </NativeText>
            <View style={styles.defaultAvatarGrid}>
              {DEFAULT_PROFILE_AVATARS.map((avatar) => {
                const isSelected = avatarUrl === avatar.url;
                return (
                  <Pressable
                    key={avatar.id}
                    onPress={() => {
                      setAvatarUrl(avatar.url);
                      setImageError(null);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      styles.defaultAvatarButton,
                      isSelected && styles.defaultAvatarButtonSelected,
                    ]}
                  >
                    <Image
                      source={{ uri: avatar.url }}
                      style={styles.defaultAvatarImage}
                    />
                    <NativeText
                      style={
                        isSelected
                          ? styles.defaultAvatarSelectedText
                          : styles.defaultAvatarText
                      }
                    >
                      {avatar.label}
                    </NativeText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </View>

      {imageError ? (
        <HelperText type="error" visible>
          {imageError}
        </HelperText>
      ) : null}

      <PanelCard>
        <SectionIntro
          eyebrow="Intro"
          title="Give people the quick read"
          subtitle="How you show up across plans and chats."
        />
        <View style={styles.row}>
          <TextInput
            label="First name"
            value={firstName}
            onChangeText={setFirstName}
            mode="outlined"
            style={[styles.input, styles.half]}
          />
          <TextInput
            label="Last name"
            value={lastName}
            onChangeText={setLastName}
            mode="outlined"
            style={[styles.input, styles.half]}
          />
        </View>
        <TextInput
          label="City"
          value={city}
          onChangeText={setCity}
          mode="outlined"
          style={styles.input}
        />
        <TextInput
          label="Bio"
          value={bio}
          onChangeText={setBio}
          multiline
          mode="outlined"
          style={styles.input}
        />
      </PanelCard>

      <PanelCard>
        <SectionIntro
          eyebrow="Interests"
          title={`What are you into? (${interests.length}/${MAX_INTERESTS})`}
          subtitle="Keep these short and specific so the app can surface better plans and more compatible people."
        />
        <View style={styles.row}>
          <TextInput
            label="Add interest"
            value={interestInput}
            onChangeText={setInterestInput}
            mode="outlined"
            style={[styles.input, styles.flexInput]}
          />
          <Button
            mode="outlined"
            onPress={addInterest}
            disabled={!interestInput.trim()}
          >
            Add
          </Button>
        </View>
        {interests.length > 0 ? (
          <View style={styles.inlineWrap}>
            {interests.map((interest) => (
              <View key={interest} style={styles.interestChip}>
                <Text style={styles.interestText}>{interest}</Text>
                <Button
                  mode="text"
                  compact
                  onPress={() => removeInterest(interest)}
                >
                  Remove
                </Button>
              </View>
            ))}
          </View>
        ) : (
          <EmptyStatePanel
            title="No interests yet"
            description="Add a few interests so your profile feels specific, social, and easier to match around."
          />
        )}
      </PanelCard>

      <PanelCard>
        <SectionIntro
          eyebrow="Media"
          title={`Photo album (${photoAlbum.length}/${MAX_PHOTOS})`}
          subtitle="Give people a sense of who you are before they open the chat or show up to the plan."
        />
        <View style={styles.row}>
          <TextInput
            label="Photo URL"
            value={photoInput}
            onChangeText={setPhotoInput}
            autoCapitalize="none"
            mode="outlined"
            style={[styles.input, styles.flexInput]}
          />
          <Button
            mode="outlined"
            onPress={addPhotoByUrl}
            disabled={!photoInput.trim()}
          >
            Add
          </Button>
        </View>
        <Button
          mode="outlined"
          onPress={addPhotoFromLibrary}
          disabled={photoAlbum.length >= MAX_PHOTOS}
          style={styles.inlineButton}
        >
          Add from library
        </Button>
        {photoAlbum.length > 0 ? (
          <View style={styles.albumGrid}>
            {photoAlbum.map((photo, index) => (
              <View
                key={`${index}-${photo.slice(0, 24)}`}
                style={styles.albumTile}
              >
                <Image source={{ uri: photo }} style={styles.albumPreview} />
                <NativeText numberOfLines={1} style={styles.albumText}>
                  {photo.startsWith("data:")
                    ? `Photo ${index + 1}`
                    : `Photo ${index + 1}`}
                </NativeText>
                <Button
                  mode="text"
                  compact
                  onPress={() => removePhotoAt(index)}
                >
                  Remove
                </Button>
              </View>
            ))}
          </View>
        ) : (
          <EmptyStatePanel
            title="No photo album yet"
            description="A few photos make your profile feel trusted, lived-in, and easier to say yes to."
          />
        )}
      </PanelCard>

      <PanelCard>
        <SectionIntro
          eyebrow="Shortcuts"
          title="Everything around your profile"
          subtitle="Keep the side destinations grouped here instead of mixing them into the main edit flow."
        />
        <View style={styles.navWrap}>
          <Button
            mode="outlined"
            onPress={() => navigation.navigate("Settings")}
          >
            Settings
          </Button>
          <Button
            mode="outlined"
            onPress={() => navigation.navigate("Friends")}
          >
            Connections
          </Button>
          <Button
            mode="outlined"
            onPress={() => navigation.navigate("Reviews")}
          >
            Reviews
          </Button>
          <Button
            mode="outlined"
            onPress={() => navigation.navigate("Notifications")}
          >
            Notifications
          </Button>
          <Button
            mode="outlined"
            onPress={() => navigation.navigate("HelpSupport")}
          >
            Help & Support
          </Button>
          <Button
            mode="outlined"
            onPress={() => navigation.navigate("PrivacyPolicy")}
          >
            Privacy
          </Button>
          <Button
            mode="outlined"
            onPress={() => navigation.navigate("TermsOfService")}
          >
            Terms
          </Button>
        </View>
      </PanelCard>

      {updateMutation.error ? (
        <HelperText type="error" visible>
          {getErrorMessage(updateMutation.error, "Unable to update profile.")}
        </HelperText>
      ) : null}

      {updateMutation.isSuccess ? (
        <PanelCard tone="accent">
          <AccentPill tone="secondary">Saved</AccentPill>
          <Text style={styles.savedText}>Profile glow-up saved.</Text>
        </PanelCard>
      ) : null}

      <PanelCard>
        <SectionIntro
          eyebrow="Actions"
          title="Keep it current"
          subtitle="Save edits, pull the latest version, or end your session from here."
        />
        <View style={styles.actionRow}>
          <Button
            mode="contained"
            buttonColor={appColors.primary}
            onPress={() => updateMutation.mutate()}
            loading={updateMutation.isPending}
            style={styles.primaryAction}
          >
            Save glow-up
          </Button>
          <Button
            mode="outlined"
            onPress={() => void refreshProfile()}
            style={styles.secondaryAction}
          >
            Refresh
          </Button>
        </View>
        <Button
          mode="text"
          onPress={() => void signOut()}
          style={styles.signOut}
          textColor={appColors.danger}
        >
          Sign out
        </Button>
      </PanelCard>
    </AppScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  heroCard: {
    gap: 12,
    borderColor: "#bff0e6",
  },
  heroShell: {
    borderRadius: radii.xl,
    overflow: "hidden",
    position: "relative",
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    gap: 16,
    padding: 24,
  },
  heroBadge: {
    color: appColors.white,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    opacity: 0.85,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroName: {
    color: appColors.white,
    fontFamily: appTypography.headingDisplay,
    letterSpacing: -0.8,
  },
  heroEmail: {
    color: "rgba(255,255,255,0.75)",
  },
  heroSubline: {
    color: "rgba(255,255,255,0.92)",
    lineHeight: 20,
  },
  input: {
    backgroundColor: appColors.card,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  flexInput: {
    flex: 1,
  },
  half: {
    flex: 1,
  },
  inlineWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  interestChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: "#ffe7f0",
    borderWidth: 1,
    borderColor: "#ffc9da",
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 4,
  },
  interestText: {
    color: appColors.primaryDeep,
    fontWeight: "700",
  },
  albumGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  avatarPreview: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    borderColor: "#ffffff",
  },
  avatarFallback: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffe4ee",
    borderWidth: 3,
    borderColor: "#ffffff",
  },
  avatarFallbackText: {
    color: appColors.primaryDeep,
    fontSize: 32,
    fontFamily: appTypography.headingDisplay,
  },
  inlineButton: {
    alignSelf: "flex-start",
  },
  defaultAvatarSection: {
    gap: 8,
  },
  defaultAvatarTitle: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  defaultAvatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  defaultAvatarButton: {
    minWidth: 88,
    alignItems: "center",
    gap: 4,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.34)",
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  defaultAvatarButtonSelected: {
    borderColor: appColors.white,
    backgroundColor: "rgba(255,255,255,0.26)",
  },
  defaultAvatarImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#edf2f8",
  },
  defaultAvatarText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    fontWeight: "700",
  },
  defaultAvatarSelectedText: {
    color: appColors.white,
    fontSize: 11,
    fontWeight: "800",
  },
  albumTile: {
    width: "47%",
    gap: 6,
    backgroundColor: "#fffafc",
    borderWidth: 1,
    borderColor: "#f3dfe8",
    borderRadius: 20,
    padding: 8,
  },
  albumPreview: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 18,
    backgroundColor: "#edf2f8",
  },
  albumText: {
    color: appColors.mutedInk,
  },
  navWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  savedText: {
    color: appColors.ink,
    fontFamily: appTypography.heading,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryAction: {
    flexGrow: 1,
  },
  secondaryAction: {
    flexGrow: 1,
  },
  signOut: {
    alignSelf: "flex-start",
  },
});
