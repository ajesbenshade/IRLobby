import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet } from 'react-native';

import { Image, Text as NativeText, View } from '@components/RNCompat';
import { appColors, palette, radii, spacing } from '@theme/index';

type ScreenshotScene =
  | 'vibe-quiz'
  | 'discover-swipe'
  | 'match-celebration'
  | 'chat'
  | 'profile-or-results';

const getScene = (): ScreenshotScene => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const sceneParam = new URLSearchParams(window.location.search).get('scene');
    if (
      sceneParam === 'vibe-quiz' ||
      sceneParam === 'discover-swipe' ||
      sceneParam === 'match-celebration' ||
      sceneParam === 'chat' ||
      sceneParam === 'profile-or-results'
    ) {
      return sceneParam;
    }
  }

  return (process.env.EXPO_PUBLIC_SCREENSHOT_SCENE ?? 'vibe-quiz') as ScreenshotScene;
};

const avatars = {
  maya: 'https://api.dicebear.com/9.x/adventurer/png?seed=Maya',
  jonah: 'https://api.dicebear.com/9.x/adventurer/png?seed=Jonah',
  ivy: 'https://api.dicebear.com/9.x/adventurer/png?seed=Ivy',
};

const SceneFrame = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.root}>
    <View style={styles.blobPink} />
    <View style={styles.blobYellow} />
    <View style={styles.blobMint} />
    <View style={styles.phoneCanvas}>{children}</View>
  </View>
);

const StatusRow = () => (
  <View style={styles.statusRow}>
    <NativeText style={styles.statusTime}>9:41</NativeText>
    <View style={styles.statusIcons}>
      <MaterialCommunityIcons color={palette.ink} name="signal-cellular-3" size={18} />
      <MaterialCommunityIcons color={palette.ink} name="wifi" size={18} />
      <View style={styles.batteryPill}>
        <NativeText style={styles.batteryText}>100</NativeText>
      </View>
    </View>
  </View>
);

const BottomTabs = ({ active }: { active: 'Discover' | 'Events' | 'Host' | 'Chat' | 'Profile' }) => {
  const items: Array<{ key: 'Discover' | 'Events' | 'Host' | 'Chat' | 'Profile'; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }> = [
    { key: 'Discover', icon: 'compass', label: 'Discover' },
    { key: 'Events', icon: 'calendar-month-outline', label: 'Events' },
    { key: 'Host', icon: 'plus', label: 'Host' },
    { key: 'Chat', icon: 'message-text-outline', label: 'Chat' },
    { key: 'Profile', icon: 'account-circle-outline', label: 'Profile' },
  ];

  return (
    <View style={styles.tabBar}>
      {items.map((item) => {
        const isActive = item.key === active;
        const isHost = item.key === 'Host';
        return (
          <View key={item.key} style={styles.tabItem}>
            {isHost ? (
              <View style={styles.hostButton}>
                <MaterialCommunityIcons color={appColors.white} name="plus" size={28} />
              </View>
            ) : (
              <MaterialCommunityIcons
                color={isActive ? palette.primary : palette.softInk}
                name={item.icon}
                size={24}
              />
            )}
            <NativeText style={[styles.tabLabel, isActive ? styles.tabLabelActive : null]}>
              {item.label}
            </NativeText>
          </View>
        );
      })}
    </View>
  );
};

const VibeQuizScene = () => (
  <SceneFrame>
    <StatusRow />
    <View style={styles.heroBlock}>
      <NativeText style={styles.eyebrow}>Vibe quiz</NativeText>
      <NativeText style={styles.heroTitle}>Five swipes and your night gets smarter.</NativeText>
      <NativeText style={styles.heroBody}>Tell IRLobby what feels right tonight and we’ll tune Discover instantly.</NativeText>
    </View>
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: '60%' }]} />
    </View>
    <NativeText style={styles.questionCounter}>Question 3 of 5</NativeText>
    <View style={styles.quizCard}>
      <NativeText style={styles.quizQuestion}>What kind of energy are you chasing tonight?</NativeText>
      {['Low-key and cozy', 'Social but still curated', 'Loud, spontaneous, all in'].map((option, index) => (
        <View
          key={option}
          style={[styles.quizOption, index === 1 ? styles.quizOptionSelected : null]}
        >
          <NativeText
            style={[styles.quizOptionLabel, index === 1 ? styles.quizOptionLabelSelected : null]}
          >
            {option}
          </NativeText>
        </View>
      ))}
    </View>
    <BottomTabs active="Discover" />
  </SceneFrame>
);

const DiscoverScene = () => (
  <SceneFrame>
    <StatusRow />
    <View style={styles.heroBlock}>
      <NativeText style={styles.eyebrow}>For you</NativeText>
      <NativeText style={styles.heroTitle}>Plans worth leaving for</NativeText>
      <NativeText style={styles.heroBody}>Swipe through what’s happening near you tonight.</NativeText>
    </View>
    <View style={styles.filterRow}>
      <View style={styles.filterPillStrong}>
        <NativeText style={styles.filterPillStrongText}>Vibe filters (1)</NativeText>
      </View>
      <View style={styles.filterPill}>
        <NativeText style={styles.filterPillText}>Map view</NativeText>
      </View>
    </View>
    <View style={styles.liveNowPill}>
      <NativeText style={styles.liveNowText}>live now</NativeText>
    </View>
    <View style={styles.activityCardWrap}>
      <View style={styles.activityCardShadow} />
      <View style={styles.activityCard}> 
        <LinearGradient colors={[palette.primary, palette.primaryDeep]} style={styles.activityMedia}>
          <View style={styles.mediaBadge}>
            <MaterialCommunityIcons color={appColors.white} name="map-marker-radius" size={16} />
            <NativeText style={styles.mediaBadgeText}>1.2 mi</NativeText>
          </View>
        </LinearGradient>
        <View style={styles.activityBody}>
          <NativeText style={styles.activityTitle}>Rooftop tacos and a sunset DJ set</NativeText>
          <NativeText style={styles.activityMeta}>Tonight · 7:30 PM · Echo Park</NativeText>
          <View style={styles.tagRow}>
            {['food crawl', 'music', 'outdoors'].map((tag) => (
              <View key={tag} style={styles.tagPill}>
                <NativeText style={styles.tagText}>{tag}</NativeText>
              </View>
            ))}
          </View>
          <View style={styles.swipeRow}>
            <View style={styles.swipeActionMuted}>
              <MaterialCommunityIcons color={palette.mutedInk} name="close" size={22} />
            </View>
            <View style={styles.swipeActionPrimary}>
              <MaterialCommunityIcons color={appColors.white} name="heart" size={22} />
            </View>
          </View>
        </View>
      </View>
    </View>
    <BottomTabs active="Discover" />
  </SceneFrame>
);

const MatchCelebrationScene = () => (
  <SceneFrame>
    <StatusRow />
    <View style={styles.matchBackgroundCard}>
      <NativeText style={styles.matchBackgroundEyebrow}>Matched activity</NativeText>
      <NativeText style={styles.matchBackgroundTitle}>Midnight ramen run</NativeText>
      <NativeText style={styles.matchBackgroundBody}>Two of you swiped right on the same late-night plan.</NativeText>
    </View>
    <LinearGradient colors={[palette.primary, palette.primaryDeep, palette.accent]} style={styles.matchOverlay}>
      <View style={styles.confettiDotOne} />
      <View style={styles.confettiDotTwo} />
      <View style={styles.confettiDotThree} />
      <NativeText style={styles.matchHeart}>❤️</NativeText>
      <NativeText style={styles.matchHeadline}>It’s a match!</NativeText>
      <NativeText style={styles.matchSubline}>You and Maya both swiped right.</NativeText>
      <NativeText style={styles.matchActivity}>Ready for Midnight ramen run?</NativeText>
      <View style={styles.matchPrimaryButton}>
        <NativeText style={styles.matchPrimaryText}>Start chatting</NativeText>
      </View>
      <NativeText style={styles.matchSecondaryText}>Maybe later</NativeText>
    </LinearGradient>
  </SceneFrame>
);

const ChatScene = () => (
  <SceneFrame>
    <StatusRow />
    <View style={styles.chatHeader}>
      <View style={styles.chatHeaderIdentity}>
        <Image source={{ uri: avatars.maya }} style={styles.avatarLarge} />
        <View>
          <NativeText style={styles.chatTitle}>Maya</NativeText>
          <NativeText style={styles.chatSubtitle}>Midnight ramen run · starts in 42m</NativeText>
        </View>
      </View>
      <MaterialCommunityIcons color={palette.mutedInk} name="dots-horizontal" size={24} />
    </View>
    <View style={styles.chatDatePill}>
      <NativeText style={styles.chatDateText}>Tonight</NativeText>
    </View>
    <View style={styles.chatThread}>
      <View style={styles.chatBubbleInbound}>
        <NativeText style={styles.chatBubbleInboundText}>Still good for Little Tokyo at 9? I found a spot with no line.</NativeText>
      </View>
      <View style={styles.chatBubbleOutbound}>
        <NativeText style={styles.chatBubbleOutboundText}>Perfect. I’m leaving Silver Lake now and can meet you outside.</NativeText>
      </View>
      <View style={styles.chatBubbleInbound}>
        <NativeText style={styles.chatBubbleInboundText}>Love it. I’ll pin the place in 2 min.</NativeText>
      </View>
    </View>
    <View style={styles.chatComposer}>
      <NativeText style={styles.chatComposerPlaceholder}>Message Maya…</NativeText>
      <View style={styles.chatSendButton}>
        <MaterialCommunityIcons color={appColors.white} name="send" size={18} />
      </View>
    </View>
    <BottomTabs active="Chat" />
  </SceneFrame>
);

const ProfileScene = () => (
  <SceneFrame>
    <StatusRow />
    <View style={styles.profileHeader}>
      <Image source={{ uri: avatars.jonah }} style={styles.profileAvatar} />
      <NativeText style={styles.profileName}>Jonah, 28</NativeText>
      <NativeText style={styles.profileHandle}>Silver Lake · down for food crawls, vinyl bars, and deep talks</NativeText>
    </View>
    <View style={styles.profileStatsRow}>
      {[
        { value: '12', label: 'matches' },
        { value: '4.9', label: 'rating' },
        { value: '7', label: 'hosted' },
      ].map((item) => (
        <View key={item.label} style={styles.statCard}>
          <NativeText style={styles.statValue}>{item.value}</NativeText>
          <NativeText style={styles.statLabel}>{item.label}</NativeText>
        </View>
      ))}
    </View>
    <View style={styles.resultsCard}>
      <NativeText style={styles.resultsEyebrow}>Your vibe</NativeText>
      <NativeText style={styles.resultsTitle}>Thoughtful spark</NativeText>
      <NativeText style={styles.resultsBody}>You gravitate toward curated nights with a little chemistry and a clear plan.</NativeText>
      <View style={styles.tagRow}>
        {['deep talks', 'cocktail bars', 'live music'].map((tag) => (
          <View key={tag} style={styles.tagPillStrong}>
            <NativeText style={styles.tagTextStrong}>{tag}</NativeText>
          </View>
        ))}
      </View>
    </View>
    <BottomTabs active="Profile" />
  </SceneFrame>
);

export const StoreScreenshotStudio = () => {
  const scene = getScene();

  switch (scene) {
    case 'discover-swipe':
      return <DiscoverScene />;
    case 'match-celebration':
      return <MatchCelebrationScene />;
    case 'chat':
      return <ChatScene />;
    case 'profile-or-results':
      return <ProfileScene />;
    case 'vibe-quiz':
    default:
      return <VibeQuizScene />;
  }
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.background,
  },
  phoneCanvas: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  blobPink: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#FFD2E0',
    top: -40,
    right: -60,
  },
  blobYellow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#FFF1AE',
    left: -70,
    top: 170,
  },
  blobMint: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: '#CFF7EE',
    right: -90,
    bottom: 120,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  statusTime: {
    color: palette.ink,
    fontSize: 24,
    fontFamily: 'Outfit_700Bold',
  },
  statusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  batteryPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
  },
  batteryText: {
    color: palette.ink,
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
  heroBlock: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  eyebrow: {
    color: palette.primary,
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
  },
  heroTitle: {
    color: palette.ink,
    fontSize: 46,
    lineHeight: 48,
    letterSpacing: -1.8,
    fontFamily: 'Outfit_800ExtraBold',
    maxWidth: 360,
  },
  heroBody: {
    color: palette.mutedInk,
    fontSize: 18,
    lineHeight: 28,
    fontFamily: 'Outfit_400Regular',
    maxWidth: 360,
  },
  progressTrack: {
    height: 10,
    backgroundColor: palette.line,
    borderRadius: 999,
    marginTop: spacing.xl,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: palette.primary,
    borderRadius: 999,
  },
  questionCounter: {
    color: palette.mutedInk,
    marginTop: spacing.sm,
    fontSize: 15,
    fontFamily: 'Outfit_500Medium',
  },
  quizCard: {
    marginTop: spacing.lg,
    backgroundColor: palette.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: palette.line,
    gap: spacing.md,
    shadowColor: palette.ink,
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  quizQuestion: {
    color: palette.ink,
    fontSize: 28,
    lineHeight: 34,
    fontFamily: 'Outfit_700Bold',
  },
  quizOption: {
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: radii.lg,
    backgroundColor: palette.surfaceMuted,
    borderWidth: 1,
    borderColor: palette.line,
  },
  quizOptionSelected: {
    backgroundColor: palette.primarySoft,
    borderColor: palette.primary,
  },
  quizOptionLabel: {
    color: palette.ink,
    fontSize: 18,
    fontFamily: 'Outfit_600SemiBold',
  },
  quizOptionLabelSelected: {
    color: palette.primaryDeep,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  filterPillStrong: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: '#FFF0B8',
    borderWidth: 1,
    borderColor: '#F6E18D',
  },
  filterPillStrongText: {
    color: palette.primary,
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: palette.line,
  },
  filterPillText: {
    color: palette.primary,
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
  },
  liveNowPill: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#FFF0B8',
    borderWidth: 1,
    borderColor: '#F6E18D',
  },
  liveNowText: {
    color: palette.primary,
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  },
  activityCardWrap: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  activityCardShadow: {
    position: 'absolute',
    top: 8,
    width: 350,
    height: 430,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 46, 99, 0.12)',
    transform: [{ rotate: '-7deg' }, { scale: 0.96 }],
  },
  activityCard: {
    width: 350,
    borderRadius: 32,
    backgroundColor: palette.surface,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.line,
    shadowColor: palette.ink,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  activityMedia: {
    height: 210,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  mediaBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  mediaBadgeText: {
    color: appColors.white,
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  activityBody: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  activityTitle: {
    color: palette.ink,
    fontSize: 28,
    lineHeight: 32,
    fontFamily: 'Outfit_700Bold',
  },
  activityMeta: {
    color: palette.mutedInk,
    fontSize: 15,
    fontFamily: 'Outfit_500Medium',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tagPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: palette.surfaceMuted,
  },
  tagText: {
    color: palette.mutedInk,
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  swipeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  swipeActionMuted: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: palette.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeActionPrimary: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchBackgroundCard: {
    marginTop: 180,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: radii.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: palette.line,
    gap: spacing.sm,
  },
  matchBackgroundEyebrow: {
    color: palette.primary,
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  matchBackgroundTitle: {
    color: palette.ink,
    fontSize: 30,
    fontFamily: 'Outfit_700Bold',
  },
  matchBackgroundBody: {
    color: palette.mutedInk,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Outfit_400Regular',
  },
  matchOverlay: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: 210,
    borderRadius: 32,
    paddingHorizontal: spacing.xl,
    paddingVertical: 42,
    alignItems: 'center',
    overflow: 'hidden',
  },
  confettiDotOne: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFF0B8',
    top: 44,
    left: 42,
  },
  confettiDotTwo: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#D5FBFF',
    top: 74,
    right: 56,
  },
  confettiDotThree: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFD2E0',
    top: 142,
    right: 34,
  },
  matchHeart: {
    fontSize: 102,
    marginBottom: spacing.md,
  },
  matchHeadline: {
    color: appColors.white,
    fontSize: 48,
    lineHeight: 50,
    textAlign: 'center',
    fontFamily: 'Outfit_800ExtraBold',
  },
  matchSubline: {
    color: appColors.white,
    opacity: 0.96,
    textAlign: 'center',
    fontSize: 22,
    lineHeight: 30,
    fontFamily: 'Outfit_600SemiBold',
    marginTop: spacing.sm,
  },
  matchActivity: {
    color: '#FFF0B8',
    fontSize: 18,
    textAlign: 'center',
    fontFamily: 'Outfit_700Bold',
    marginTop: spacing.md,
  },
  matchPrimaryButton: {
    marginTop: spacing.xl,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 999,
    backgroundColor: appColors.white,
  },
  matchPrimaryText: {
    color: palette.primary,
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
  },
  matchSecondaryText: {
    color: appColors.white,
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    marginTop: spacing.md,
  },
  chatHeader: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chatHeaderIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.surfaceMuted,
  },
  chatTitle: {
    color: palette.ink,
    fontSize: 24,
    fontFamily: 'Outfit_700Bold',
  },
  chatSubtitle: {
    color: palette.mutedInk,
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
  },
  chatDatePill: {
    alignSelf: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
  },
  chatDateText: {
    color: palette.mutedInk,
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  chatThread: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  chatBubbleInbound: {
    alignSelf: 'flex-start',
    maxWidth: '78%',
    padding: spacing.md,
    borderRadius: 24,
    backgroundColor: palette.surface,
    borderBottomLeftRadius: 8,
  },
  chatBubbleInboundText: {
    color: palette.ink,
    fontSize: 18,
    lineHeight: 26,
    fontFamily: 'Outfit_500Medium',
  },
  chatBubbleOutbound: {
    alignSelf: 'flex-end',
    maxWidth: '80%',
    padding: spacing.md,
    borderRadius: 24,
    backgroundColor: palette.primary,
    borderBottomRightRadius: 8,
  },
  chatBubbleOutboundText: {
    color: appColors.white,
    fontSize: 18,
    lineHeight: 26,
    fontFamily: 'Outfit_500Medium',
  },
  chatComposer: {
    marginTop: 'auto',
    marginBottom: 110,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
  },
  chatComposerPlaceholder: {
    flex: 1,
    color: palette.softInk,
    fontSize: 17,
    fontFamily: 'Outfit_500Medium',
  },
  chatSendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeader: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  profileAvatar: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: palette.surfaceMuted,
  },
  profileName: {
    color: palette.ink,
    fontSize: 34,
    fontFamily: 'Outfit_800ExtraBold',
    marginTop: spacing.md,
  },
  profileHandle: {
    color: palette.mutedInk,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    fontFamily: 'Outfit_500Medium',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  profileStatsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  statCard: {
    flex: 1,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
  },
  statValue: {
    color: palette.primary,
    fontSize: 28,
    fontFamily: 'Outfit_800ExtraBold',
  },
  statLabel: {
    color: palette.mutedInk,
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  resultsCard: {
    marginTop: spacing.xl,
    backgroundColor: palette.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: palette.line,
    gap: spacing.sm,
  },
  resultsEyebrow: {
    color: palette.primary,
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  resultsTitle: {
    color: palette.ink,
    fontSize: 30,
    fontFamily: 'Outfit_800ExtraBold',
  },
  resultsBody: {
    color: palette.mutedInk,
    fontSize: 17,
    lineHeight: 26,
    fontFamily: 'Outfit_500Medium',
  },
  tagPillStrong: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: palette.primarySoft,
  },
  tagTextStrong: {
    color: palette.primaryDeep,
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 6,
    height: 84,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: palette.line,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  tabItem: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  hostButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -26,
    shadowColor: palette.ink,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  tabLabel: {
    color: palette.softInk,
    fontSize: 12,
    marginTop: 6,
    fontFamily: 'Outfit_600SemiBold',
  },
  tabLabelActive: {
    color: palette.primary,
    fontFamily: 'Outfit_700Bold',
  },
});