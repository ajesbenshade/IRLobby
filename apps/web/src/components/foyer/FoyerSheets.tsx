import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { WHOS_COMING_NOTE } from '@/lib/foyer';

export type WhosComingSheetData = {
  me: { name: string; eligible: boolean; reason?: string | null };
  dependents: Array<{ id: number; name: string; age?: number | null; eligible: boolean; reason?: string | null }>;
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
    <div className="fixed inset-0 z-[80] flex items-end bg-black/40" role="dialog" aria-label="Who's coming?">
      <div className="w-full rounded-t-[22px] bg-white p-5">
        <h2 className="font-display text-[26px] text-[#222222]">Who's coming?</h2>
        <p className="mb-3 text-sm text-[#6e6a68]">
          {activityTitle} · {audience}
        </p>
        <label className={`mb-2 flex items-center gap-3 rounded-2xl p-3 ${includeSelf ? 'bg-[#f9e8ee]' : 'bg-[#f6f1ee]'} ${data.me.eligible ? '' : 'opacity-50'}`}>
          <input
            type="checkbox"
            checked={includeSelf}
            disabled={!data.me.eligible}
            onChange={() => setIncludeSelf((value) => !value)}
          />
          <span>
            <span className="block font-semibold">Me</span>
            <span className="text-sm text-[#6e6a68]">{data.me.eligible ? 'Your RSVP' : data.me.reason}</span>
          </span>
        </label>
        {data.dependents.map((child) => {
          const selected = dependentIds.includes(child.id);
          return (
            <label
              key={child.id}
              className={`mb-2 flex items-center gap-3 rounded-2xl p-3 ${selected ? 'bg-[#f9e8ee]' : 'bg-[#f6f1ee]'} ${child.eligible ? '' : 'opacity-50'}`}
            >
              <input
                type="checkbox"
                aria-label={`${child.name} (age ${child.age ?? ''})`}
                checked={selected}
                disabled={!child.eligible}
                onChange={() =>
                  setDependentIds((current) =>
                    current.includes(child.id) ? current.filter((id) => id !== child.id) : [...current, child.id],
                  )
                }
              />
              <span>
                <span className="block font-semibold">
                  {child.name}
                  {child.age != null ? ` (age ${child.age})` : ''}
                </span>
                <span className="text-sm text-[#6e6a68]">
                  {child.eligible ? 'In your household' : child.reason || "Outside this event's age range"}
                </span>
              </span>
            </label>
          );
        })}
        <p className="my-3 text-sm text-[#6e6a68]">{data.note || WHOS_COMING_NOTE}</p>
        <Button className="h-[54px] w-full rounded-full" disabled={pending || count < 1} onClick={() => onConfirm({ include_self: includeSelf, dependent_ids: dependentIds })}>
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
  onDismiss,
}: {
  title: string;
  onPhotos: () => void;
  onChat: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/40" role="dialog" aria-label="You're going">
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
        <button type="button" className="mt-1 w-full font-semibold text-[#a2033f]" onClick={onDismiss}>
          Done
        </button>
      </div>
    </div>
  );
}
