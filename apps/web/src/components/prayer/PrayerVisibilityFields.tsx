import { Switch } from '@/components/ui/switch';
import { PRAYER_COPY, selectedCircleLabel, type PrayerCircle } from '@shared/prayer';
import { ChevronRight, UserRound } from 'lucide-react';
import { useState } from 'react';

type Props = {
  circles: PrayerCircle[];
  selectedIds: Array<number | string>;
  onChangeSelected: (ids: Array<number | string>) => void;
  wholeChurch: boolean;
  onChangeWholeChurch: (value: boolean) => void;
  circlesStatus: 'loading' | 'ready' | 'empty' | 'unavailable' | 'error';
};

/** Circle picker plus the whole-church toggle. The toggle starts off. */
export default function PrayerVisibilityFields({
  circles,
  selectedIds,
  onChangeSelected,
  wholeChurch,
  onChangeWholeChurch,
  circlesStatus,
}: Props) {
  const [open, setOpen] = useState(false);

  const toggle = (id: number | string) => {
    const exists = selectedIds.some((selected) => String(selected) === String(id));
    onChangeSelected(
      exists
        ? selectedIds.filter((selected) => String(selected) !== String(id))
        : [...selectedIds, id],
    );
  };

  return (
    <div className="mt-6">
      <h2 className="text-base font-semibold text-[#222]">{PRAYER_COPY.whoCanSee}</h2>
      <button
        type="button"
        className="mt-2 flex min-h-14 w-full items-center gap-2 rounded-2xl border border-[#e1dbd7] bg-white px-4 text-left"
        onClick={() => setOpen(true)}
      >
        <UserRound className="h-5 w-5 text-[#6e6a68]" aria-hidden />
        <span>{PRAYER_COPY.visibleTo}</span>
        <span className="ml-auto truncate font-semibold">
          {selectedCircleLabel(circles, selectedIds)}
        </span>
        <ChevronRight className="h-5 w-5 text-[#6e6a68]" aria-hidden />
      </button>
      <div className="mt-3 flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-[#e1dbd7] bg-white px-4">
        <span className="font-semibold">{PRAYER_COPY.wholeChurchToggle}</span>
        <Switch
          checked={wholeChurch}
          onCheckedChange={onChangeWholeChurch}
          aria-label={PRAYER_COPY.wholeChurchToggle}
        />
      </div>
      <p className="mt-2 text-sm leading-5 text-[#6e6a68]">
        {wholeChurch ? PRAYER_COPY.wholeChurchOn : PRAYER_COPY.wholeChurchOff}
      </p>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="visible-to-title"
            className="relative z-10 w-full max-w-md rounded-t-3xl bg-white px-5 pb-8 pt-4 md:rounded-3xl"
          >
            <h2 id="visible-to-title" className="font-display text-[28px] font-bold">
              {PRAYER_COPY.visibleTo}
            </h2>
            {circlesStatus === 'loading' ? (
              <p className="mt-3 text-sm text-[#6e6a68]">{PRAYER_COPY.circlesLoading}</p>
            ) : null}
            {circlesStatus === 'empty' || circlesStatus === 'unavailable' ? (
              <p className="mt-3 text-sm text-[#6e6a68]">{PRAYER_COPY.circlesEmpty}</p>
            ) : null}
            {circlesStatus === 'error' ? (
              <p className="mt-3 text-sm text-[#6e6a68]">{PRAYER_COPY.circlesFailed}</p>
            ) : null}
            <ul className="mt-2">
              {circles.map((circle) => {
                const selected = selectedIds.some((id) => String(id) === String(circle.id));
                return (
                  <li key={String(circle.id)}>
                    <label className="flex min-h-12 items-center gap-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggle(circle.id)}
                        className="h-5 w-5 accent-[#a2033f]"
                      />
                      <span className="text-[17px]">{circle.name}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
