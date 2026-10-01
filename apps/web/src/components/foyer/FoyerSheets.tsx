import { Calendar, CalendarArrowDown, ChevronRight, Mail } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { WHOS_COMING_NOTE } from '@/lib/foyer';

export type WhosComingSheetData = {
  me: { name: string; eligible: boolean; reason?: string | null };
  dependents: Array<{
    id: number;
    name: string;
    age?: number | null;
    eligible: boolean;
    reason?: string | null;
  }>;
  note?: string | null;
};

export function WhosComingDialog({
  activityTitle,
  audience,
  data,
  pending,
  onClose,
  onConfirm,
}: {
  activityTitle: string;
  audience: string;
  data: WhosComingSheetData;
  pending?: boolean;
  onClose: () => void;
  onConfirm: (payload: { include_self: boolean; dependent_ids: number[] }) => void;
}) {
  const initialIds = useMemo(
    () => data.dependents.filter((child) => child.eligible).map((child) => child.id),
    [data.dependents],
  );
  const [includeSelf, setIncludeSelf] = useState(data.me.eligible);
  const [dependentIds, setDependentIds] = useState<number[]>(initialIds);
  const count = (includeSelf ? 1 : 0) + dependentIds.length;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end bg-black/40"
      role="dialog"
      aria-label="Who's coming?"
    >
      <div className="w-full rounded-t-[22px] bg-white p-5">
        <h2 className="font-display text-[26px] text-[#222222]">Who's coming?</h2>
        <p className="mb-3 text-sm text-[#6e6a68]">
          {activityTitle} · {audience}
        </p>
        <label
          className={`mb-2 flex items-center gap-3 rounded-2xl p-3 ${
            includeSelf ? 'bg-[#f9e8ee]' : 'bg-[#f6f1ee]'
          } ${data.me.eligible ? '' : 'opacity-50'}`}
        >
          <input
            type="checkbox"
            checked={includeSelf}
            disabled={!data.me.eligible}
            onChange={() => setIncludeSelf((value) => !value)}
          />
          <span>
            <span className="block font-semibold">Me</span>
            <span className="text-sm text-[#6e6a68]">
              {data.me.eligible ? 'Your RSVP' : data.me.reason}
            </span>
          </span>
        </label>
        {data.dependents.map((child) => {
          const selected = dependentIds.includes(child.id);
          return (
            <label
              key={child.id}
              className={`mb-2 flex items-center gap-3 rounded-2xl p-3 ${
                selected ? 'bg-[#f9e8ee]' : 'bg-[#f6f1ee]'
              } ${child.eligible ? '' : 'opacity-50'}`}
            >
              <input
                type="checkbox"
                aria-label={`${child.name} (age ${child.age ?? ''})`}
                checked={selected}
                disabled={!child.eligible}
                onChange={() =>
                  setDependentIds((current) =>
                    current.includes(child.id)
                      ? current.filter((id) => id !== child.id)
                      : [...current, child.id],
                  )
                }
              />
              <span>
                <span className="block font-semibold">
                  {child.name}
                  {child.age != null ? ` (age ${child.age})` : ''}
                </span>
                <span className="text-sm text-[#6e6a68]">
                  {child.eligible
                    ? 'In your household'
                    : child.reason || "Outside this event's age range"}
                </span>
              </span>
            </label>
          );
        })}
        <p className="my-3 text-sm text-[#6e6a68]">{data.note || WHOS_COMING_NOTE}</p>
        <Button
          className="h-[54px] w-full rounded-full"
          disabled={pending || count < 1}
          onClick={() => onConfirm({ include_self: includeSelf, dependent_ids: dependentIds })}
        >
          Confirm · {count} going
        </Button>
        <button type="button" className="mt-3 w-full text-[#a2033f]" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export function YoureGoingDialog({
  title,
  onPhotos,
  onChat,
  onAddToCalendar,
  onDismiss,
}: {
  title: string;
  onPhotos: () => void;
  onChat: () => void;
  onAddToCalendar: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end bg-black/40"
      role="dialog"
      aria-label="You're going"
    >
      <div className="w-full rounded-t-[22px] bg-white p-5">
        <h2 className="font-display text-[26px] text-[#222222]">You're going</h2>
        <p className="mb-4 text-sm text-[#6e6a68]">{title}</p>
        <button
          type="button"
          className="mb-2 h-[52px] w-full rounded-2xl bg-[#f9e8ee] font-semibold text-[#a2033f]"
          onClick={onPhotos}
        >
          Photos
        </button>
        <button
          type="button"
          className="mb-2 h-[52px] w-full rounded-2xl bg-[#f9e8ee] font-semibold text-[#a2033f]"
          onClick={onChat}
        >
          Chat
        </button>
        <button
          type="button"
          className="mb-2 h-[52px] w-full rounded-2xl bg-[#f9e8ee] font-semibold text-[#a2033f]"
          onClick={onAddToCalendar}
        >
          Add to calendar
        </button>
        <button
          type="button"
          className="mt-1 w-full font-semibold text-[#a2033f]"
          onClick={onDismiss}
        >
          Done
        </button>
      </div>
    </div>
  );
}

function CalendarChoice({
  icon,
  label,
  note,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  note?: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      className="mb-2 flex min-h-16 w-full items-center gap-3 rounded-2xl border border-[#e1dbd7] bg-[#fbf7f5] px-3 py-2 text-left"
      onClick={onPress}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f9e8ee] text-[#a2033f]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-[#222222]">{label}</span>
        {note ? <span className="block text-sm font-normal text-[#6e6a68]">{note}</span> : null}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-[#a09b98]" aria-hidden="true" />
    </button>
  );
}

export function AddToCalendarDialog({
  summary,
  onGoogle,
  onOutlook,
  onApple,
  onDismiss,
}: {
  summary: string;
  onGoogle: () => void;
  onOutlook: () => void;
  onApple: () => void;
  onDismiss: () => void;
}) {
  const choose = (open: () => void) => {
    open();
    onDismiss();
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end bg-[rgba(20,14,16,0.42)]"
      role="dialog"
      aria-label="Add to calendar"
    >
      <div className="w-full rounded-t-[22px] bg-white px-5 pb-6 pt-3">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[#e1dbd7]" />
        <h2 className="font-display text-[26px] text-[#222222]">Add to calendar</h2>
        <p className="mb-3 text-[15px] text-[#6e6a68]">{summary}</p>
        <CalendarChoice
          icon={<Calendar className="h-5 w-5" aria-hidden="true" />}
          label="Google Calendar"
          onPress={() => choose(onGoogle)}
        />
        <CalendarChoice
          icon={<Mail className="h-5 w-5" aria-hidden="true" />}
          label="Outlook"
          onPress={() => choose(onOutlook)}
        />
        <CalendarChoice
          icon={<CalendarArrowDown className="h-5 w-5" aria-hidden="true" />}
          label="Apple Calendar"
          note="Downloads an .ics file"
          onPress={() => choose(onApple)}
        />
        <p className="mb-3 mt-1 text-sm leading-5 text-[#6e6a68]">
          Opens in your calendar app. The Foyer doesn't need access to your calendar.
        </p>
        <button
          type="button"
          className="h-[54px] w-full rounded-full border border-[#e1dbd7] font-semibold text-[#222222]"
          onClick={onDismiss}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
