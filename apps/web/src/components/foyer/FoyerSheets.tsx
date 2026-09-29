import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  FEE_NOTE,
  WHOS_COMING_NOTE,
  giftDisclaimer,
  giftIntro,
  type GatheringLike,
} from '@/lib/foyer';

export type WhosComingSheetData = {
  me: { name: string; eligible: boolean; reason?: string | null };
  dependents: Array<{ id: number; name: string; age?: number | null; eligible: boolean; reason?: string | null }>;
  note?: string | null;
};

const chips = [5, 10, 20];

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

export function GiveDialog({
  activity,
  pending,
  onGive,
  onDismiss,
}: {
  activity: GatheringLike;
  pending?: boolean;
  onGive: (amount: string) => Promise<void>;
  onDismiss: () => void;
}) {
  const suggested = Number(activity.suggested_donation ?? 10) || 10;
  const initial = chips.includes(suggested) ? suggested : ('other' as const);
  const [choice, setChoice] = useState<number | 'other'>(initial);
  const [other, setOther] = useState(initial === 'other' ? String(suggested) : '');
  const amount = choice === 'other' ? Number(other) : choice;
  const valid = Number.isFinite(amount) && amount > 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/40" role="dialog" aria-label="Want to chip in?">
      <div className="max-h-[90vh] w-full overflow-auto rounded-t-[22px] bg-white p-5">
        <h2 className="font-display text-[26px] text-[#222222]">You're going.</h2>
        <p className="font-display text-lg text-[#222222]">Want to chip in?</p>
        <p className="my-3 text-[15px] leading-6 text-[#222222]">{giftIntro(activity)}</p>
        <p className="mb-2 text-sm font-semibold">Suggested amount</p>
        <div className="mb-3 flex gap-2">
          {chips.map((value) => (
            <button
              key={value}
              type="button"
              className={`rounded-full border px-4 py-2 ${choice === value ? 'border-[#a2033f] bg-[#a2033f] text-white' : 'border-[#e1dbd7]'}`}
              onClick={() => setChoice(value)}
            >
              ${value}
            </button>
          ))}
          <button
            type="button"
            className={`rounded-full border px-4 py-2 ${choice === 'other' ? 'border-[#a2033f] bg-[#a2033f] text-white' : 'border-[#e1dbd7]'}`}
            onClick={() => setChoice('other')}
          >
            Other
          </button>
        </div>
        {choice === 'other' ? (
          <input
            aria-label="Other amount"
            className="mb-3 w-full rounded-xl border border-[#e1dbd7] px-3 py-3"
            value={other}
            onChange={(event) => setOther(event.target.value)}
          />
        ) : null}
        <div className="mb-4 rounded-2xl bg-[#f6f1ee] p-4">
          <p className="font-semibold">{giftDisclaimer(activity)}</p>
          <p className="mt-1 text-sm text-[#6e6a68]">{activity.fee_note || FEE_NOTE}</p>
        </div>
        <Button
          className="h-[54px] w-full rounded-full"
          disabled={!valid || pending}
          onClick={() => void onGive(amount.toFixed(2))}
        >
          {valid ? `Give $${Number.isInteger(amount) ? amount : amount.toFixed(2)} in browser` : 'Give in browser'}
        </Button>
        <p className="mt-2 text-center text-sm text-[#6e6a68]">Opens Safari to finish your gift.</p>
        <button type="button" className="mt-2 w-full font-semibold text-[#a2033f]" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
