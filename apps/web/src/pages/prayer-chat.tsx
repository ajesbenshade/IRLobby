import { useAuth } from '@/hooks/useAuth';
import {
  fetchPrayerChat,
  fetchPrayerRequest,
  reportPrayerRequest,
  sendPrayerMessage,
  stopPraying,
} from '@/lib/prayer';
import {
  PRAYER_COPY,
  PrayerClientError,
  prayerChatBanner,
  prayerChatHeading,
} from '@shared/prayer';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, MoreHorizontal, Send, Triangle } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const whenLabel = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
};

export default function PrayerChatPage() {
  const { prayerId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const prayerQuery = useQuery({
    queryKey: ['prayer-request', prayerId],
    queryFn: () => fetchPrayerRequest(prayerId),
    enabled: Boolean(prayerId),
    retry: false,
  });
  const messagesKey = ['prayer-chat', prayerId];
  const chatQuery = useQuery({
    queryKey: messagesKey,
    queryFn: () => fetchPrayerChat(prayerId),
    enabled: Boolean(prayerId),
    refetchInterval: 8000,
    retry: false,
  });
  const messages = chatQuery.data?.messages ?? [];
  const chatError = chatQuery.isError
    ? chatQuery.error instanceof PrayerClientError
      ? chatQuery.error.message
      : PRAYER_COPY.loadFailed
    : null;
  const send = useMutation({
    mutationFn: (message: string) => sendPrayerMessage(prayerId, message),
    onSuccess: async () => {
      setText('');
      setNotice(null);
      await queryClient.invalidateQueries({ queryKey: messagesKey });
    },
    onError: (error) =>
      setNotice(error instanceof PrayerClientError ? error.message : PRAYER_COPY.sendFailed),
  });
  const title = chatQuery.data?.prayingFor || prayerQuery.data?.title || '';
  const count = chatQuery.data?.prayingCount || prayerQuery.data?.prayingCount || 0;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#f6f1ee]">
      <header className="flex items-center px-2 py-2">
        <button
          type="button"
          aria-label="Back"
          className="flex h-11 w-11 items-center justify-center text-[#a2033f]"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-[17px] font-semibold">
            {title ? prayerChatHeading(title) : PRAYER_COPY.chatKind}
          </h1>
          <p className="flex items-center justify-center gap-1 text-[13px] font-semibold text-[#a2033f]">
            <Triangle className="h-3.5 w-3.5" aria-hidden />
            {PRAYER_COPY.chatKind}
          </p>
        </div>
        <button
          type="button"
          aria-label="More"
          className="flex h-11 w-11 items-center justify-center"
          onClick={() => setMenu((open) => !open)}
        >
          <MoreHorizontal className="h-6 w-6" />
        </button>
      </header>
      {menu ? (
        <div className="mx-4 mb-2 rounded-2xl border bg-white p-2">
          <button
            type="button"
            className="block w-full px-3 py-3 text-left"
            onClick={() => {
              setMenu(false);
              void reportPrayerRequest(prayerId)
                .then((result) => {
                  setNotice(
                    result === 'sent' ? PRAYER_COPY.reportSent : PRAYER_COPY.reportUnavailable,
                  );
                })
                .catch(() => setNotice(PRAYER_COPY.reportUnavailable));
            }}
          >
            {PRAYER_COPY.report}
          </button>
          <button
            type="button"
            className="block w-full px-3 py-3 text-left"
            onClick={() => {
              setMenu(false);
              void stopPraying(prayerId)
                .then(() => navigate('/app/prayer'))
                .catch((error: unknown) => {
                  setNotice(
                    error instanceof PrayerClientError ? error.message : PRAYER_COPY.stopFailed,
                  );
                });
            }}
          >
            {PRAYER_COPY.leave}
          </button>
        </div>
      ) : null}
      <div className="mx-4 flex items-start gap-2 rounded-xl bg-[#fde8ef] px-3 py-2 text-sm font-semibold text-[#a2033f]">
        <Triangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>{prayerChatBanner(count)}</p>
      </div>
      <div className="flex-1 space-y-3 px-4 py-4">
        {chatError ? (
          <p className="pt-16 text-center text-sm text-[#6e6a68]">{chatError}</p>
        ) : messages.length === 0 && !chatQuery.isLoading ? (
          <div className="pt-16 text-center">
            <p className="font-display text-xl">{PRAYER_COPY.chatEmpty}</p>
            <p className="mt-2 text-sm text-[#6e6a68]">{PRAYER_COPY.chatEmptyBody}</p>
          </div>
        ) : null}
        {messages.map((message) => {
          const mine = String(message.senderId) === String(user?.id ?? '');
          return (
            <div
              key={String(message.id)}
              className={mine ? 'flex justify-end' : 'flex justify-start'}
            >
              <div className={mine ? 'max-w-[80%]' : 'max-w-[80%]'}>
                {message.createdAt ? (
                  <p className="mb-1 text-center text-xs text-[#6e6a68]">
                    {whenLabel(message.createdAt)}
                  </p>
                ) : null}
                {!mine ? (
                  <p className="mb-1 text-xs font-semibold text-[#6e6a68]">{message.senderName}</p>
                ) : null}
                <p
                  className={`rounded-2xl px-4 py-2 text-base ${
                    mine ? 'bg-[#a2033f] text-white' : 'bg-white text-[#222]'
                  }`}
                >
                  {message.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {notice ? <p className="px-4 pb-2 text-center text-sm text-[#6e6a68]">{notice}</p> : null}
      <form
        className="flex items-end gap-2 px-3 pb-6"
        onSubmit={(event) => {
          event.preventDefault();
          const message = text.trim();
          if (!message || send.isPending) return;
          send.mutate(message);
        }}
      >
        <label className="sr-only" htmlFor="prayer-message">
          {PRAYER_COPY.messagePlaceholder}
        </label>
        <input
          id="prayer-message"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={PRAYER_COPY.messagePlaceholder}
          className="h-12 flex-1 rounded-full border border-[#e1dbd7] bg-white px-4"
        />
        <button
          type="submit"
          aria-label={PRAYER_COPY.send}
          disabled={!text.trim() || send.isPending}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#a2033f] text-white disabled:bg-[#e1dbd7] disabled:text-[#7a7572]"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
