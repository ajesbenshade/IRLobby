import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { AppScrollView } from '@components/AppChrome';
import { DirectoryChildSheet } from '@components/foyer/DirectoryChildSheet';
import { Avatar, PillButton } from '@components/foyer/ui';
import { Image, RefreshControl, View } from '@components/RNCompat';
import { DIRECTORY_COPY } from '@shared/directory';
import {
  birthdayShort,
  birthdaysThisWeek,
  directoryDisplayName,
  directorySections,
  directoryUsesServerSearch,
  filterDirectory,
  isBirthdayToday,
  showDirectoryViewerCard,
  childInitials,
  type DirectoryChild,
  type DirectoryMember,
} from '@shared/directory';
import { useAuth } from '@hooks/useAuth';
import type { MainStackParamList } from '@navigation/types';
import { fetchDirectory } from '@services/directoryService';
import { appColors, appTypography, radii } from '@theme/index';

const QUERY_KEY = ['directory'] as const;

/** Profile → Directory. Not a bottom tab. */
export const DirectoryScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [child, setChild] = useState<{ child: DirectoryChild; parent: DirectoryMember } | null>(null);
  const list = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => fetchDirectory(''),
  });
  const refetch = list.refetch;
  const serverSearch = directoryUsesServerSearch(list.data?.count, list.data?.results.length ?? 0);
  const searched = useQuery({
    queryKey: [...QUERY_KEY, 'q', debounced],
    queryFn: () => fetchDirectory(debounced),
    enabled: serverSearch && debounced.trim().length > 0,
  });

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(handle);
  }, [query]);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const source = serverSearch && debounced.trim() ? searched.data : list.data;
  const loading = list.isLoading || (serverSearch && debounced.trim().length > 0 && searched.isLoading);
  const failed = list.isError || source?.unavailable === true || searched.isError;
  const members = useMemo(() => {
    const rows = source?.results ?? [];
    return serverSearch ? rows : filterDirectory(rows, query);
  }, [query, serverSearch, source?.results]);
  const sections = useMemo(() => directorySections(members), [members]);
  const week = useMemo(
    () => (query.trim() ? [] : birthdaysThisWeek(list.data?.results ?? [])),
    [list.data?.results, query],
  );
  const viewerHidden = showDirectoryViewerCard(user?.profileVisibility);

  const openMember = (member: DirectoryMember) => {
    navigation.navigate('MemberProfile', { userId: member.id });
  };

  const goVisibility = () => {
    navigation.navigate('Tabs', { screen: 'Profile' });
  };

  const blocks: ReactNode[] = [
    <View key="header" style={styles.topRow}>
      <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text maxFontSizeMultiplier={1.4} style={styles.back}>
          Profile
        </Text>
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>
        {DIRECTORY_COPY.title}
      </Text>
      <View style={styles.backButton} />
    </View>,
    <View key="search" style={styles.search}>
      <MaterialCommunityIcons name="magnify" size={20} color={appColors.mutedInk} />
      <TextInput
        accessibilityLabel={DIRECTORY_COPY.searchPlaceholder}
        value={query}
        onChangeText={setQuery}
        placeholder={DIRECTORY_COPY.searchPlaceholder}
        placeholderTextColor={appColors.softInk}
        style={styles.searchInput}
        autoCorrect={false}
      />
    </View>,
  ];
  const sticky: number[] = [];

  if (!failed && !loading && viewerHidden) {
    blocks.push(
      <View key="viewer" style={styles.notice}>
        <Text style={styles.noticeTitle}>{DIRECTORY_COPY.viewerTitle}</Text>
        <Text style={styles.noticeBody}>{DIRECTORY_COPY.viewerBody}</Text>
        <PillButton label={DIRECTORY_COPY.viewerUpdate} onPress={goVisibility} />
      </View>,
    );
  }

  if (!failed && !loading && week.length > 0) {
    blocks.push(
      <View key="week" style={styles.notice}>
        <Text style={styles.noticeTitle}>{DIRECTORY_COPY.weekTitle}</Text>
        {week.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            onPress={() => {
              const parent = (list.data?.results ?? []).find((member) => member.id === item.memberId);
              if (!parent) return;
              if (item.kind === 'child') {
                const match = parent.householdChildren.find((row) => row.id === item.childId);
                if (match) setChild({ child: match, parent });
                return;
              }
              openMember(parent);
            }}
            style={styles.weekRow}
          >
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>{DIRECTORY_COPY.birthday(birthdayShort(item.month, item.day))}</Text>
            {item.daysUntil === 0 ? (
              <View style={styles.today}>
                <Text style={styles.todayText}>{DIRECTORY_COPY.today}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>,
    );
  }

  if (loading) {
    blocks.push(
      <View key="skeletons" accessibilityLabel={DIRECTORY_COPY.loading}>
        {Array.from({ length: 8 }, (_, index) => (
          <View key={index} style={styles.skeleton} />
        ))}
      </View>,
    );
  } else if (failed) {
    blocks.push(
      <View key="error" style={styles.empty}>
        <Text style={styles.emptyTitle}>{DIRECTORY_COPY.errorTitle}</Text>
        <PillButton
          label={DIRECTORY_COPY.tryAgain}
          variant="outline"
          onPress={() => {
            void list.refetch();
            if (debounced.trim()) void searched.refetch();
          }}
        />
      </View>,
    );
  } else if (members.length === 0 && query.trim()) {
    blocks.push(
      <Text key="search-empty" style={styles.searchEmpty}>
        {DIRECTORY_COPY.searchEmpty}
      </Text>,
    );
  } else if (members.length === 0) {
    blocks.push(
      <View key="empty" style={styles.empty}>
        <Text style={styles.emptyTitle}>{DIRECTORY_COPY.emptyTitle}</Text>
        <Text style={styles.emptyBody}>{DIRECTORY_COPY.emptyBody}</Text>
        <PillButton label={DIRECTORY_COPY.updateVisibility} onPress={goVisibility} />
      </View>,
    );
  } else {
    for (const section of sections) {
      sticky.push(blocks.length);
      blocks.push(
        <Text key={`letter-${section.letter}`} style={styles.letter}>
          {section.letter}
        </Text>,
      );
      blocks.push(
        <View key={`rows-${section.letter}`} style={styles.list}>
          {section.members.map((member) => (
            <View key={String(member.id)}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={directoryDisplayName(member)}
                onPress={() => openMember(member)}
                style={styles.row}
              >
                {member.avatarUrl ? (
                  <Image source={{ uri: member.avatarUrl }} style={styles.avatar} />
                ) : (
                  <Avatar initials={childInitials(member.firstName)} size={40} />
                )}
                <Text style={styles.name}>{directoryDisplayName(member)}</Text>
                <MaterialCommunityIcons name="chevron-right" size={22} color={appColors.mutedInk} />
              </Pressable>
              {member.householdChildren.length > 0 ? (
                <View style={styles.family}>
                  <Text style={styles.familyLabel}>{DIRECTORY_COPY.family}</Text>
                  {member.householdChildren.map((row) => {
                    const short = birthdayShort(row.birthMonth, row.birthDay);
                    const today = isBirthdayToday(row.birthMonth, row.birthDay);
                    return (
                      <Pressable
                        key={String(row.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`${row.firstName}, ${DIRECTORY_COPY.birthday(short)}`}
                        onPress={() => setChild({ child: row, parent: member })}
                        style={styles.childRow}
                      >
                        <Avatar initials={childInitials(row.firstName)} size={32} />
                        <View style={styles.childCopy}>
                          <Text style={styles.name}>{row.firstName}</Text>
                          <Text style={styles.meta}>{DIRECTORY_COPY.birthday(short)}</Text>
                        </View>
                        {today ? (
                          <View style={styles.today}>
                            <Text style={styles.todayText}>{DIRECTORY_COPY.today}</Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          ))}
        </View>,
      );
    }
  }

  return (
    <>
      <AppScrollView
        headerless
        stickyHeaderIndices={sticky}
        refreshControl={
          <RefreshControl
            refreshing={list.isRefetching && !list.isLoading}
            onRefresh={() => void list.refetch()}
          />
        }
        contentContainerStyle={styles.container}
      >
        {blocks}
      </AppScrollView>
      <DirectoryChildSheet
        child={child?.child ?? null}
        parent={child?.parent ?? null}
        onClose={() => setChild(null)}
        onOpenParent={(parent) => {
          setChild(null);
          openMember(parent);
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, paddingBottom: 48 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  backButton: { minWidth: 72, minHeight: 48, justifyContent: 'center' },
  back: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 16 },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: appTypography.heading,
    fontSize: 28,
    lineHeight: 34,
    color: appColors.ink,
  },
  search: {
    minHeight: 48,
    borderRadius: radii.input,
    backgroundColor: appColors.white,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, fontFamily: appTypography.bodyRegular, fontSize: 16, color: appColors.ink, paddingVertical: 10 },
  notice: { backgroundColor: appColors.white, borderRadius: radii.list, padding: 16, gap: 8 },
  noticeTitle: { fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.ink },
  noticeBody: { fontFamily: appTypography.bodyRegular, fontSize: 14, lineHeight: 20, color: appColors.mutedInk },
  weekRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  letter: {
    backgroundColor: appColors.background,
    paddingTop: 8,
    paddingBottom: 4,
    fontFamily: appTypography.bodySemibold,
    fontSize: 13,
    color: appColors.mutedInk,
  },
  list: { backgroundColor: appColors.white, borderRadius: radii.list, overflow: 'hidden' },
  row: { minHeight: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: appColors.line },
  name: { flex: 1, fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.ink },
  family: { backgroundColor: '#faf7f5', paddingBottom: 8 },
  familyLabel: {
    paddingHorizontal: 16,
    paddingTop: 8,
    fontFamily: appTypography.bodySemibold,
    fontSize: 11,
    letterSpacing: 0.4,
    color: appColors.mutedInk,
  },
  childRow: { minHeight: 52, paddingLeft: 28, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  childCopy: { flex: 1 },
  meta: { fontFamily: appTypography.bodyRegular, fontSize: 13, color: appColors.mutedInk },
  today: { backgroundColor: appColors.primarySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  todayText: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 12 },
  skeleton: { height: 56, borderRadius: 16, backgroundColor: '#efe9e5', marginBottom: 8 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  emptyTitle: { fontFamily: appTypography.heading, fontSize: 22, lineHeight: 28, color: appColors.ink, textAlign: 'center' },
  emptyBody: { fontFamily: appTypography.bodyRegular, fontSize: 15, lineHeight: 21, color: appColors.mutedInk, textAlign: 'center' },
  searchEmpty: { textAlign: 'center', color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 15, marginTop: 24 },
});
