import type { ConversationMessage } from '@services/chatService';

export const canSendMessage = (text: string, canSend: boolean) => canSend && text.trim().length > 0;

/** `Today 4:12 PM`, `Yesterday 9:05 AM`, or `Oct 3, 4:12 PM`. */
export const formatDividerTime = (iso: string, now = new Date()): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const hours = date.getHours();
  const time = `${hours % 12 === 0 ? 12 : hours % 12}:${String(date.getMinutes()).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (dayDiff === 0) {
    return `Today ${time}`;
  }
  if (dayDiff === 1) {
    return `Yesterday ${time}`;
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${time}`;
};

/** Adds a date divider before the first message and after any gap of 30+ minutes. */
export type ChatListItem =
  | { kind: 'divider'; key: string; label: string }
  | { kind: 'message'; key: string; message: ConversationMessage };

export const withDividers = (messages: ConversationMessage[], now = new Date()): ChatListItem[] => {
  const items: ChatListItem[] = [];
  let last: number | null = null;
  for (const message of messages) {
    const at = new Date(message.createdAt).getTime();
    if (last == null || (Number.isFinite(at) && at - last > 30 * 60_000)) {
      items.push({ kind: 'divider', key: `d-${message.id}`, label: formatDividerTime(message.createdAt, now) });
    }
    items.push({ kind: 'message', key: `m-${message.id}`, message });
    if (Number.isFinite(at)) {
      last = at;
    }
  }
  return items;
};
