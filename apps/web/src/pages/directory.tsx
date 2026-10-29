import { DiscoverSheet } from '@/components/DiscoverSheet';
import { useAuth } from '@/hooks/useAuth';
import {
  fetchDirectory,
  fetchMemberCard,
  sendChildBirthdayWish,
  blockMember,
  reportMember,
  sendDirectMessage,
  sendFriendRequest,
  type MemberCard,
} from '@/lib/directoryClient';
import { profileVisibility } from '@/lib/profileForm';
import {
  DIRECTORY_COPY,
  birthdayLong,
  birthdayShort,
  birthdaysThisWeek,
  childInitials,
  directoryDisplayName,
  directorySections,
  directoryUsesServerSearch,
  filterDirectory,
  isBirthdayToday,
  showDirectoryViewerCard,
  validMonthDay,
  wishButtonLabel,
  wishFriendsLine,
  wishPresets,
  type DirectoryChild,
  type DirectoryMember,
} from '@shared/directory';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

type Selection =
  | { kind: 'member'; id: number | string }
  | { kind: 'child'; child: DirectoryChild; parent: DirectoryMember }
  | null;

export default function DirectoryPage() {
  const { user } = useAuth();
  const visibility = profileVisibility(user?.profileVisibility);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selection, setSelection] = useState<Selection>(null);
  const list = useQuery({
    queryKey: ['directory'],
    queryFn: () => fetchDirectory(''),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  const serverSearch = directoryUsesServerSearch(list.data?.count, list.data?.results.length ?? 0);
  const searched = useQuery({
    queryKey: ['directory', 'q', debounced],
    queryFn: () => fetchDirectory(debounced),
    enabled: serverSearch && debounced.trim().length > 0,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(handle);
  }, [query]);

  const source = serverSearch && debounced.trim() ? searched.data : list.data;
  const loading =
    list.isLoading || (serverSearch && debounced.trim().length > 0 && searched.isLoading);
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

  const openMember = (id: number | string) => setSelection({ kind: 'member', id });

  return (
    <div className="mx-auto min-h-screen w-full bg-[#f6f1ee] px-5 pb-[calc(var(--bottom-nav-offset)+1rem)] pt-6">
      <div className="mb-3 flex items-center">
        <Link to="/app/profile" className="min-w-[72px] font-semibold text-[#a2033f]">
          Profile
        </Link>
        <h1 className="flex-1 text-center font-display text-[28px] text-[#222222]">
          {DIRECTORY_COPY.title}
        </h1>
        <span className="min-w-[72px]" />
      </div>
      <label className="flex min-h-12 items-center gap-2 rounded-xl bg-white px-3">
        <span className="sr-only">{DIRECTORY_COPY.searchPlaceholder}</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={DIRECTORY_COPY.searchPlaceholder}
          className="w-full bg-transparent py-3 outline-none"
        />
      </label>

      {!failed && !loading && showDirectoryViewerCard(visibility) ? (
        <div className="mt-4 rounded-2xl bg-white p-4">
          <p className="font-semibold">{DIRECTORY_COPY.viewerTitle}</p>
          <p className="mt-1 text-sm text-[#6e6a68]">{DIRECTORY_COPY.viewerBody}</p>
          <Link
            to="/app/profile#visibility"
            className="mt-3 inline-flex min-h-11 items-center font-semibold text-[#a2033f]"
          >
            {DIRECTORY_COPY.viewerUpdate}
          </Link>
        </div>
      ) : null}

      {!failed && !loading && week.length > 0 ? (
        <section className="mt-4 rounded-2xl bg-white p-4">
          <h2 className="font-semibold">{DIRECTORY_COPY.weekTitle}</h2>
          <ul className="mt-2">
            {week.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center gap-2 text-left"
                  onClick={() => {
                    const parent = (list.data?.results ?? []).find(
                      (member) => member.id === item.memberId,
                    );
                    if (!parent) return;
                    if (item.kind === 'child') {
                      const match = parent.householdChildren.find((row) => row.id === item.childId);
                      if (match) setSelection({ kind: 'child', child: match, parent });
                      return;
                    }
                    openMember(parent.id);
                  }}
                >
                  <span className="flex-1 font-semibold">{item.name}</span>
                  <span className="text-sm text-[#6e6a68]">
                    {DIRECTORY_COPY.birthday(birthdayShort(item.month, item.day))}
                  </span>
                  {item.daysUntil === 0 ? <TodayChip /> : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {loading ? (
        <div className="mt-4 space-y-2" aria-label={DIRECTORY_COPY.loading}>
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-2xl bg-[#efe9e5]" />
          ))}
        </div>
      ) : null}

      {!loading && failed ? (
        <div className="mt-10 text-center">
          <p className="font-display text-2xl text-[#222222]">{DIRECTORY_COPY.errorTitle}</p>
          <button
            type="button"
            className="mt-4 min-h-11 font-semibold text-[#a2033f]"
            onClick={() => {
              void list.refetch();
              if (debounced.trim()) void searched.refetch();
            }}
          >
            {DIRECTORY_COPY.tryAgain}
          </button>
        </div>
      ) : null}

      {!loading && !failed && members.length === 0 && query.trim() ? (
        <p className="mt-10 text-center text-[#6e6a68]">{DIRECTORY_COPY.searchEmpty}</p>
      ) : null}

      {!loading && !failed && members.length === 0 && !query.trim() ? (
        <div className="mt-10 px-2 text-center">
          <p className="font-display text-2xl text-[#222222]">{DIRECTORY_COPY.emptyTitle}</p>
          <p className="mt-2 text-[15px] leading-6 text-[#6e6a68]">{DIRECTORY_COPY.emptyBody}</p>
          <Link
            to="/app/profile#visibility"
            className="mt-4 inline-flex h-[54px] items-center justify-center rounded-full bg-[#a2033f] px-6 font-semibold text-white"
          >
            {DIRECTORY_COPY.updateVisibility}
          </Link>
        </div>
      ) : null}

      {!loading && !failed
        ? sections.map((section) => (
            <section key={section.letter} className="mt-3">
              <h2 className="sticky top-16 z-10 bg-[#f6f1ee] py-1 text-xs font-bold text-[#6e6a68]">
                {section.letter}
              </h2>
              <div className="overflow-hidden rounded-2xl bg-white">
                {section.members.map((member) => (
                  <div key={String(member.id)} className="border-b border-[#e1dbd7] last:border-0">
                    <button
                      type="button"
                      className="flex min-h-14 w-full items-center gap-3 px-3 text-left"
                      onClick={() => openMember(member.id)}
                    >
                      <Avatar url={member.avatarUrl} label={childInitials(member.firstName)} />
                      <span className="flex-1 font-semibold">{directoryDisplayName(member)}</span>
                      <ChevronRight className="h-5 w-5 text-[#6e6a68]" aria-hidden />
                    </button>
                    {member.householdChildren.length > 0 ? (
                      <div className="bg-[#faf7f5] pb-2">
                        <p className="px-4 pt-2 text-[11px] font-bold tracking-wide text-[#6e6a68]">
                          {DIRECTORY_COPY.family}
                        </p>
                        {member.householdChildren.map((row) => {
                          const short = birthdayShort(row.birthMonth, row.birthDay);
                          return (
                            <button
                              key={String(row.id)}
                              type="button"
                              className="flex min-h-[52px] w-full items-center gap-3 pl-8 pr-3 text-left"
                              onClick={() =>
                                setSelection({ kind: 'child', child: row, parent: member })
                              }
                            >
                              <Avatar label={childInitials(row.firstName)} />
                              <span className="min-w-0 flex-1">
                                <span className="block font-semibold">{row.firstName}</span>
                                <span className="block text-sm text-[#6e6a68]">
                                  {DIRECTORY_COPY.birthday(short)}
                                </span>
                              </span>
                              {isBirthdayToday(row.birthMonth, row.birthDay) ? <TodayChip /> : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ))
        : null}

      <MemberPane
        userId={selection?.kind === 'member' ? selection.id : null}
        onClose={() => setSelection(null)}
      />
      <ChildPane
        selection={selection?.kind === 'child' ? selection : null}
        onClose={() => setSelection(null)}
        onOpenParent={(parent) => openMember(parent.id)}
      />
    </div>
  );
}

function Avatar({ url, label }: { url?: string | null; label: string }) {
  if (url) {
    return <img src={url} alt="" className="h-10 w-10 rounded-full object-cover" />;
  }
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f9e8ee] text-xs font-semibold text-[#a2033f]">
      {label}
    </span>
  );
}

function TodayChip() {
  return (
    <span className="rounded-full bg-[#f9e8ee] px-2 py-0.5 text-xs font-semibold text-[#a2033f]">
      {DIRECTORY_COPY.today}
    </span>
  );
}

function MemberPane({ userId, onClose }: { userId: number | string | null; onClose: () => void }) {
  const card = useQuery({
    queryKey: ['directory-member', userId == null ? 'none' : String(userId)],
    queryFn: () => fetchMemberCard(userId as number | string),
    enabled: userId != null,
  });
  const [note, setNote] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const profile = card.data;
  const birthday =
    profile &&
    profile.birthdayMonth != null &&
    profile.birthdayDay != null &&
    validMonthDay(profile.birthdayMonth, profile.birthdayDay)
      ? birthdayLong(profile.birthdayMonth, profile.birthdayDay)
      : '';

  return (
    <DiscoverSheet
      open={userId != null}
      onClose={onClose}
      title={profile?.firstName || 'Profile'}
      description="Member profile"
      testId="directory-member-pane"
    >
      {card.isLoading ? <p className="text-sm text-[#6e6a68]">Loading…</p> : null}
      {card.isError ? (
        <p className="text-sm text-[#8a0a1f]">This profile could not be loaded.</p>
      ) : null}
      {profile == null && card.isSuccess ? (
        <p className="text-sm text-[#6e6a68]">
          You can&apos;t view this person. Their profile isn&apos;t available to you.
        </p>
      ) : null}
      {profile ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2">
            <Avatar url={profile.avatarUrl} label={childInitials(profile.firstName)} />
            {birthday ? <p className="text-sm text-[#6e6a68]">Birthday {birthday}</p> : null}
          </div>
          {profile.visible && profile.bio ? (
            <div>
              <p className="text-xs font-bold tracking-wide text-[#6e6a68]">ABOUT</p>
              <p className="mt-1 text-[15px] leading-6">{profile.bio}</p>
            </div>
          ) : null}
          {profile.visible ? (
            <p className="text-sm text-[#6e6a68]">{explanation(profile)}</p>
          ) : null}
          {profile.friendship === 'none' ? (
            <button
              type="button"
              className="h-[54px] w-full rounded-full bg-[#a2033f] font-semibold text-white"
              onClick={() => {
                void sendFriendRequest(profile.id)
                  .then(() => setNote('Request sent'))
                  .catch(() => setNote("Your request couldn't be sent. Please try again."));
              }}
            >
              Add friend
            </button>
          ) : null}
          {profile.friendship === 'friends' ? (
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                const text = message.trim();
                if (!text) return;
                void sendDirectMessage(profile.id, text)
                  .then(() => {
                    setMessage('');
                    setNote('Sent');
                  })
                  .catch(() => setNote("Couldn't send that message. Try again."));
              }}
            >
              <label className="block text-sm font-semibold">
                Message
                <input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#e1dbd7] px-3 py-3 font-normal"
                />
              </label>
              <button
                type="submit"
                className="h-11 w-full rounded-full bg-[#a2033f] font-semibold text-white"
              >
                Send
              </button>
            </form>
          ) : null}
          {profile.friendship !== 'self' ? (
            <div className="flex gap-4">
              <button
                type="button"
                className="min-h-11 font-semibold text-[#222222]"
                onClick={() => {
                  void reportMember(profile.id)
                    .then(() => setNote('Report sent'))
                    .catch(() => setNote("Couldn't send that report. Try again."));
                }}
              >
                Report
              </button>
              <button
                type="button"
                className="min-h-11 font-semibold text-[#222222]"
                onClick={() => {
                  void blockMember(profile.id)
                    .then(() => onClose())
                    .catch(() => setNote("Couldn't block this person. Try again."));
                }}
              >
                Block
              </button>
            </div>
          ) : null}
          {note ? <p className="text-sm text-[#6e6a68]">{note}</p> : null}
        </div>
      ) : null}
    </DiscoverSheet>
  );
}

function explanation(profile: MemberCard) {
  const contact =
    profile.phone && profile.email
      ? 'phone and email'
      : profile.phone
      ? 'phone'
      : profile.email
      ? 'email'
      : null;
  const contactLine = contact ? ` You can see their ${contact}.` : '';
  if (profile.friendship === 'friends') {
    return `You can see ${profile.firstName}'s profile because you're friends.${contactLine}`;
  }
  return `${profile.firstName}'s privacy settings let you see their profile.${contactLine}`;
}

function ChildPane({
  selection,
  onClose,
  onOpenParent,
}: {
  selection: { child: DirectoryChild; parent: DirectoryMember } | null;
  onClose: () => void;
  onOpenParent: (parent: DirectoryMember) => void;
}) {
  const parent = selection?.parent ?? null;
  const child = selection?.child ?? null;
  const card = useQuery({
    queryKey: ['directory-member', parent ? String(parent.id) : 'none'],
    queryFn: () => fetchMemberCard(parent!.id),
    enabled: parent != null,
  });
  const [wishing, setWishing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const friends = card.data?.friendship === 'friends';
  const parentHidden = card.isSuccess && card.data == null;
  const long = child ? birthdayLong(child.birthMonth, child.birthDay) : '';

  return (
    <DiscoverSheet
      open={selection != null}
      onClose={() => {
        setWishing(false);
        setNote(null);
        onClose();
      }}
      title={child?.firstName ?? 'Child'}
      description="Household child"
      testId="directory-child-pane"
    >
      {child && parent ? (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-[15px]">
            {DIRECTORY_COPY.birthday(long)}
            {isBirthdayToday(child.birthMonth, child.birthDay) ? <TodayChip /> : null}
          </p>
          <button
            type="button"
            className="font-semibold text-[#a2033f]"
            onClick={() => onOpenParent(parent)}
          >
            {DIRECTORY_COPY.childOf(directoryDisplayName(parent))}
          </button>
          {card.isLoading || parentHidden ? null : friends ? (
            wishing ? (
              <div className="space-y-2">
                {wishPresets(child.firstName).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="min-h-11 w-full rounded-full border border-[#a2033f] px-4 font-semibold text-[#a2033f]"
                    onClick={() => {
                      void sendChildBirthdayWish({
                        parentUserId: parent.id,
                        childId: child.id,
                        childFirstName: child.firstName,
                        message: preset,
                      })
                        .then(() => {
                          setNote(DIRECTORY_COPY.wishSent);
                          setWishing(false);
                        })
                        .catch(() => setNote(DIRECTORY_COPY.wishFailed));
                    }}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            ) : (
              <button
                type="button"
                className="h-[54px] w-full rounded-full bg-[#a2033f] font-semibold text-white"
                onClick={() => setWishing(true)}
              >
                {wishButtonLabel(child.firstName)}
              </button>
            )
          ) : (
            <div className="space-y-3">
              <p>{wishFriendsLine(parent.firstName)}</p>
              <button
                type="button"
                className="font-semibold text-[#a2033f]"
                onClick={() => onOpenParent(parent)}
              >
                {DIRECTORY_COPY.addFriend}
              </button>
            </div>
          )}
          {note ? <p className="text-sm text-[#6e6a68]">{note}</p> : null}
        </div>
      ) : null}
    </DiscoverSheet>
  );
}
