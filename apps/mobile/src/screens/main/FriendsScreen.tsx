import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { type ReactElement } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AppScrollView } from '@components/AppChrome';
import { Avatar, EmptyState, PillButton } from '@components/foyer/ui';
import { Image, RefreshControl, View } from '@components/RNCompat';
import { isFoyerMode } from '@constants/appMode';
import { FRIEND_COPY } from '@constants/foyerCopy';
import {
  CONNECTIONS_COPY,
  connectionContextLine,
  connectionDestination,
  connectionInitials,
  connectionRowKey,
  type ConnectionPeer,
} from '@shared/connections';
import type { MainStackParamList } from '@navigation/types';
import { fetchConnections } from '@services/connectionsService';
import { appColors, appTypography, radii } from '@theme/index';

const sectionCopy = {
  gathering: {
    header: CONNECTIONS_COPY.gatheringHeader,
    emptyTitle: CONNECTIONS_COPY.gatheringEmptyTitle,
    emptyBody: CONNECTIONS_COPY.gatheringEmptyBody,
  },
  praying: {
    header: CONNECTIONS_COPY.prayingHeader,
    emptyTitle: CONNECTIONS_COPY.prayingEmptyTitle,
    emptyBody: CONNECTIONS_COPY.prayingEmptyBody,
  },
} as const;

/**
 * Profile → Connections. Gathering with, then Praying for.
 * Foyer draws its own title because the stack header is hidden.
 * Legacy mode keeps the native "Connections" header.
 */
export const FriendsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const foyer = isFoyerMode();
  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: ['connections'],
    queryFn: fetchConnections,
  });

  const openPeer = (peer: ConnectionPeer) => {
    const destination = connectionDestination(peer);
    if (!destination) return;
    if (destination.kind === 'profile') {
      navigation.navigate('MemberProfile', { userId: destination.userId });
      return;
    }
    navigation.navigate('PrayerDetail', { prayerId: destination.prayerId });
  };

  const showSections = !isLoading && !isError;
  const nodes: ReactElement[] = [];
  const sticky: number[] = [];

  if (foyer) {
    nodes.push(
      <View key="top" style={styles.topRow}>
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text maxFontSizeMultiplier={1.4} style={styles.back}>
            {FRIEND_COPY.backToProfile}
          </Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          {CONNECTIONS_COPY.title}
        </Text>
        <View style={styles.backButton} />
      </View>,
    );
  }

  nodes.push(
    <Text key="intro" style={styles.intro}>
      {CONNECTIONS_COPY.intro}
    </Text>,
  );

  if (isLoading) {
    nodes.push(
      <Text key="loading" style={styles.status}>
        {CONNECTIONS_COPY.loading}
      </Text>,
    );
  } else if (isError) {
    nodes.push(
      <View key="error" style={styles.errorBlock}>
        <Text style={styles.error}>{CONNECTIONS_COPY.error}</Text>
        <PillButton
          label={CONNECTIONS_COPY.retry}
          variant="outline"
          disabled={isRefetching}
          onPress={() => void refetch()}
        />
      </View>,
    );
  } else if (showSections) {
    (['gathering', 'praying'] as const).forEach((kind) => {
      sticky.push(nodes.length);
      const peers = data?.[kind] ?? [];
      nodes.push(
        <View key={`${kind}-header`} collapsable={false} style={styles.stickyHeader}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {sectionCopy[kind].header(peers.length)}
          </Text>
        </View>,
      );
      nodes.push(
        <View key={`${kind}-body`}>
          {peers.length === 0 ? (
            <EmptyState title={sectionCopy[kind].emptyTitle} body={sectionCopy[kind].emptyBody} />
          ) : (
            <View style={styles.list}>
              {peers.map((peer, index) => (
                <ConnectionRow
                  key={connectionRowKey(peer, index)}
                  peer={peer}
                  divider={index < peers.length - 1}
                  onPress={() => openPeer(peer)}
                />
              ))}
            </View>
          )}
        </View>,
      );
    });
  }

  return (
    <AppScrollView
      headerless={foyer}
      stickyHeaderIndices={sticky.length > 0 ? sticky : undefined}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
    >
      {nodes}
    </AppScrollView>
  );
};

const ConnectionRow = ({
  peer,
  divider,
  onPress,
}: {
  peer: ConnectionPeer;
  divider: boolean;
  onPress: () => void;
}) => {
  const line = connectionContextLine(peer);
  const destination = connectionDestination(peer);
  const label = line ? `${peer.displayName}, ${line}` : peer.displayName;
  const body = (
    <>
      {peer.avatarUrl ? (
        <Image source={{ uri: peer.avatarUrl }} style={styles.photo} accessible={false} />
      ) : (
        <Avatar initials={connectionInitials(peer.displayName)} size={40} />
      )}
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.name}>
          {peer.displayName}
        </Text>
        {line ? (
          <Text numberOfLines={1} style={styles.context}>
            {line}
          </Text>
        ) : null}
      </View>
      {destination ? <MaterialCommunityIcons name="chevron-right" size={22} color={appColors.mutedInk} /> : null}
    </>
  );
  if (!destination) {
    return <View style={[styles.row, divider ? styles.divider : null]}>{body}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.row, divider ? styles.divider : null]}
    >
      {body}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, gap: 8, paddingBottom: 48 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButton: { minWidth: 72, minHeight: 48, justifyContent: 'center' },
  back: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 16 },
  title: {
    flex: 1,
    fontFamily: appTypography.bodySemibold,
    fontSize: 17,
    lineHeight: 24,
    color: appColors.ink,
    textAlign: 'center',
  },
  intro: { color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 15, lineHeight: 21 },
  status: { color: appColors.mutedInk, textAlign: 'center', paddingVertical: 28 },
  errorBlock: { gap: 12, alignItems: 'center', paddingVertical: 24 },
  error: { color: '#8a0a1f', fontFamily: appTypography.bodyMedium, fontSize: 15, textAlign: 'center' },
  stickyHeader: { backgroundColor: appColors.background, paddingTop: 12, paddingBottom: 8 },
  sectionTitle: { fontFamily: appTypography.bodySemibold, fontSize: 15, lineHeight: 21, color: appColors.ink },
  list: { backgroundColor: appColors.white, borderRadius: radii.list, overflow: 'hidden' },
  row: { minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: appColors.line },
  photo: { width: 40, height: 40, borderRadius: 20, backgroundColor: appColors.line },
  copy: { flex: 1, gap: 2 },
  name: { fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.ink },
  context: { fontFamily: appTypography.bodyRegular, fontSize: 13, color: appColors.mutedInk },
});
