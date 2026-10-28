import {
  DISCOVER_FEED_FILTERS,
  PRAYER_COPY,
  discoverFeedLabel,
  type DiscoverFeedFilter,
} from '@shared/prayer';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

type Props = {
  value: DiscoverFeedFilter;
  onChange: (value: DiscoverFeedFilter) => void;
};

export default function DiscoverFeedFilter({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const label = discoverFeedLabel(value);

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-full border border-[#e1dbd7] bg-white px-4 py-2 text-[15px] font-semibold text-[#222]"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {label}
        <ChevronDown className="h-4 w-4" aria-hidden />
      </button>
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
            aria-labelledby="show-on-discover-title"
            className="relative z-10 w-full max-w-md rounded-t-3xl bg-white px-5 pb-8 pt-4 md:rounded-3xl"
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#e1dbd7]" />
            <h2
              id="show-on-discover-title"
              className="font-display text-[28px] font-bold text-[#222]"
            >
              {PRAYER_COPY.filterTitle}
            </h2>
            <ul className="mt-2">
              {DISCOVER_FEED_FILTERS.map((option) => {
                const selected = option.id === value;
                return (
                  <li key={option.id} className="border-b border-[#eee] last:border-b-0">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className="flex min-h-14 w-full items-center justify-between py-4 text-left text-[17px]"
                      onClick={() => {
                        onChange(option.id);
                        setOpen(false);
                      }}
                    >
                      {option.label}
                      {selected ? (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#a2033f] text-sm text-white">
                          ✓
                        </span>
                      ) : (
                        <span className="h-7 w-7 rounded-full border-2 border-[#c8beba]" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-sm leading-5 text-[#6e6a68]">{PRAYER_COPY.filterFootnote}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
